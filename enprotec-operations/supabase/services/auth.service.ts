import { supabase } from '../client';
import { User, UserRole, UserStatus } from '../../types';

// ─── Row shape returned by enprotec_users ──────────────────────────────────────────
interface EnUserRow {
  id:           string;
  name:         string;
  email:        string;
  role:         string;
  status:       string;
  fleet_role:   string | null;
  sites?:       string[] | null;
  departments?: string[] | null;
}

const toUser = (row: EnUserRow): User => ({
  id:          row.id,
  name:        row.name,
  email:       row.email,
  role:        row.role,
  status:      (row.status as UserStatus) ?? UserStatus.Active,
  fleet_role:  row.fleet_role ?? null,
  sites:       row.sites ?? null,
  departments: row.departments ?? null,
});

/** Build a minimal User from Supabase auth metadata (fallback when DB is unavailable) */
const userFromMeta = (
  authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> },
): User | null => {
  const meta = authUser.user_metadata ?? {};
  if (!meta.name && !authUser.email) return null;
  return {
    id:         authUser.id,
    name:       (meta.name as string) ?? authUser.email ?? 'User',
    email:      authUser.email ?? '',
    role:       (meta.role as string) ?? UserRole.Admin,
    status:     UserStatus.Active,
    fleet_role: null,
  };
};

// ─── Core fetch (queries enprotec_users by Supabase auth user ID) ──────────────────
export async function fetchProfile(userId: string): Promise<User | null> {
  const dbFetch = supabase
    .from('enprotec_users')
    .select('id, name, email, role, status, fleet_role, sites, departments')
    .eq('id', userId)
    .maybeSingle()
    .then(({ data, error }) => (error || !data ? null : toUser(data as EnUserRow)));

  const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 5000));
  return Promise.race([dbFetch, timeout]);
}

// ─── Sign in ──────────────────────────────────────────────────────────────────
export async function signIn(
  email: string,
  password: string,
): Promise<{ user: User | null; error: string | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { user: null, error: error.message };
  if (!data.user) return { user: null, error: 'Login failed. Please try again.' };

  const profile = await fetchProfile(data.user.id);
  if (profile) return { user: profile, error: null };

  const fallback = userFromMeta(data.user as Parameters<typeof userFromMeta>[0]);
  if (fallback) return { user: fallback, error: null };

  return { user: null, error: 'Profile not found. Contact your administrator.' };
}

// ─── Sign out ─────────────────────────────────────────────────────────────────
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ─── Auth state changes ───────────────────────────────────────────────────────
export function onAuthStateChange(callback: (user: User | null) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      const profile = await fetchProfile(session.user.id);
      callback(profile ?? userFromMeta(session.user as Parameters<typeof userFromMeta>[0]));
    }
  });
  return () => subscription.unsubscribe();
}

// ─── Get session ──────────────────────────────────────────────────────────────
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// ─── Get current user (initial load) ─────────────────────────────────────────
export async function getCurrentUser(): Promise<User | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const profile = await fetchProfile(session.user.id);
  return profile ?? userFromMeta(session.user as Parameters<typeof userFromMeta>[0]);
}

// ─── Admin: create user — calls server-side API (SUPABASE_SERVICE_ROLE_KEY) ──
export async function createFleetUser(
  email: string,
  password: string,
  name: string,
  role: string,
  fleet_role: string | null = null,
): Promise<{ error: string | null }> {
  try {
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, role, fleet_role, sites: [], departments: [] }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body?.error ?? `Failed to create user (${res.status})` };

    // If fleet_role is set, patch it via a separate update (create-user endpoint handles basic fields)
    if (fleet_role && body.id) {
      await supabase.from('enprotec_users').update({ fleet_role }).eq('id', body.id);
    }

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create user' };
  }
}

// ─── Admin: delete user — calls server-side API (SUPABASE_SERVICE_ROLE_KEY) ──
export async function deleteFleetUser(userId: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch('/api/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body?.error ?? `Failed to delete user (${res.status})` };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete user' };
  }
}
