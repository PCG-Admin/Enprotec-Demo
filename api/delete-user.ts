import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

type DeleteUserPayload = {
  userId: string;
};

interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

export const handleDeleteUser = async (
  payload: DeleteUserPayload | undefined
): Promise<HandlerResult> => {
  console.log('[DELETE-USER] Received payload:', JSON.stringify(payload, null, 2));

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return {
      status: 500,
      body: { error: 'Supabase configuration missing on server' },
    };
  }

  if (!payload || !payload.userId) {
    return { status: 400, body: { error: 'Missing user ID' } };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Check if user exists in database
  const { data: existingUser, error: fetchError } = await supabaseAdmin
    .from('en_users')
    .select('id, email, name')
    .eq('id', payload.userId)
    .maybeSingle();

  if (fetchError) {
    console.error('[DELETE-USER] Error fetching user:', fetchError);
    return {
      status: 500,
      body: { error: fetchError.message },
    };
  }

  if (!existingUser) {
    return {
      status: 404,
      body: { error: 'User not found' },
    };
  }

  console.log('[DELETE-USER] Deleting user:', existingUser.name, existingUser.email);

  // Delete from en_users table first
  const { error: deleteProfileError } = await supabaseAdmin
    .from('en_users')
    .delete()
    .eq('id', payload.userId);

  if (deleteProfileError) {
    console.error('[DELETE-USER] Error deleting profile:', deleteProfileError);
    return {
      status: 500,
      body: { error: deleteProfileError.message },
    };
  }

  // Delete from auth.users
  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
    payload.userId
  );

  if (authDeleteError) {
    console.error('[DELETE-USER] Error deleting auth user:', authDeleteError);
    // Even if auth deletion fails, profile is already deleted
    // This might happen if auth user was already deleted
    console.warn('[DELETE-USER] Auth deletion failed but profile was deleted');
  }

  console.log('[DELETE-USER] Successfully deleted user');
  return {
    status: 200,
    body: {
      success: true,
      message: `User ${existingUser.name} (${existingUser.email}) deleted successfully`,
    },
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

  const { status, body } = await handleDeleteUser(req.body as DeleteUserPayload);
  res.status(status).json(body);
};

export default vercelHandler;
