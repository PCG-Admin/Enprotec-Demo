import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const PASSWORD_PLACEHOLDER = 'Supabase-Auth-Managed';

type UpdateUserPayload = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  sites?: string[];
  departments?: string[];
  status?: string;
};

interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

const sanitizeArray = (value?: string[] | null): string[] | null => {
  if (!value) return null;
  return Array.isArray(value) ? value : null;
};

export const handleUpdateUser = async (
  payload: UpdateUserPayload | undefined
): Promise<HandlerResult> => {
  console.log('[UPDATE-USER] Received payload:', JSON.stringify(payload, null, 2));

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return {
      status: 500,
      body: { error: 'Supabase configuration missing on server' },
    };
  }

  if (!payload || !payload.id) {
    return { status: 400, body: { error: 'Missing user ID' } };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const metadataUpdates: Record<string, unknown> = {};

  if (payload.name !== undefined) {
    metadataUpdates.name = payload.name;
  }
  if (payload.role !== undefined) {
    metadataUpdates.role = payload.role;
  }
  if (payload.sites !== undefined) {
    metadataUpdates.sites = payload.sites;
  }
  if (payload.departments !== undefined) {
    metadataUpdates.departments = payload.departments;
  }
  if (payload.status !== undefined) {
    metadataUpdates.status = payload.status;
  }

  const authUpdatePayload: Parameters<
    typeof supabaseAdmin.auth.admin.updateUserById
  >[1] = {};

  if (payload.email !== undefined) {
    authUpdatePayload.email = payload.email;
    authUpdatePayload.email_confirm = true;
  }

  if (Object.keys(metadataUpdates).length > 0) {
    authUpdatePayload.user_metadata = metadataUpdates;
  }

  if (Object.keys(authUpdatePayload).length > 0) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      payload.id,
      authUpdatePayload
    );

    if (authError) {
      return {
        status: authError.status ?? 500,
        body: { error: authError.message ?? 'Failed to update auth user' },
      };
    }
  }

  const profileUpdates: Record<string, unknown> = {};
  if (payload.name !== undefined) {
    profileUpdates.name = payload.name;
  }
  if (payload.email !== undefined) {
    profileUpdates.email = payload.email;
  }
  if (payload.role !== undefined) {
    profileUpdates.role = payload.role;
  }
  if (payload.sites !== undefined) {
    profileUpdates.sites = sanitizeArray(payload.sites);
  }
  if (payload.departments !== undefined) {
    profileUpdates.departments = sanitizeArray(payload.departments);
  }
  if (payload.status !== undefined) {
    profileUpdates.status = payload.status;
  }

  if (Object.keys(profileUpdates).length > 0) {
    profileUpdates.password = PASSWORD_PLACEHOLDER;
  }

  console.log('[UPDATE-USER] Profile updates to apply:', JSON.stringify(profileUpdates, null, 2));

  const { error: profileError, data: profileData } = await supabaseAdmin
    .from('en_users')
    .update(profileUpdates)
    .eq('id', payload.id)
    .select('*')
    .single();

  if (profileError || !profileData) {
    console.error('[UPDATE-USER] Profile update error:', profileError);
    return {
      status: 500,
      body: { error: profileError?.message ?? 'Failed to update user profile' },
    };
  }

  console.log('[UPDATE-USER] Successfully updated user profile');
  return {
    status: 200,
    body: profileData as Record<string, unknown>,
  };
};

const vercelHandler = async (req: VercelRequest, res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).send('OK');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { status, body } = await handleUpdateUser(req.body as UpdateUserPayload);
  res.status(status).json(body);
};

export default vercelHandler;
