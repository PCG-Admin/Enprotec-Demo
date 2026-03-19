import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

type CommentRecord = {
  id: string;
  comment_text: string;
  created_at: string;
  user: { name: string | null } | null;
};

const createAdminClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const sendCORS = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

const handleGet = async (req: VercelRequest, res: VercelResponse) => {
  const workflowId = req.query.workflowId;
  if (typeof workflowId !== 'string' || !workflowId.trim()) {
    return res.status(400).json({ error: 'workflowId query parameter is required.' });
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return res.status(500).json({ error: 'Supabase configuration missing on server.' });
  }

  const { data, error } = await adminClient
    .from('enprotec_workflow_comments')
    .select('id, comment_text, created_at, user:enprotec_users(name)')
    .eq('workflow_request_id', workflowId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Comments] Failed to fetch comments', error);
    return res.status(500).json({ error: error.message ?? 'Failed to fetch comments.' });
  }

  return res.status(200).json({ comments: (data as CommentRecord[]) ?? [] });
};

const handlePost = async (req: VercelRequest, res: VercelResponse) => {
  const { workflowId, userId, comment } = req.body ?? {};

  if (!workflowId || typeof workflowId !== 'string') {
    return res.status(400).json({ error: 'workflowId is required.' });
  }
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required.' });
  }
  if (!comment || typeof comment !== 'string' || !comment.trim()) {
    return res.status(400).json({ error: 'comment text is required.' });
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return res.status(500).json({ error: 'Supabase configuration missing on server.' });
  }

  const { data, error } = await adminClient
    .from('enprotec_workflow_comments')
    .insert({
      workflow_request_id: workflowId,
      user_id: userId,
      comment_text: comment.trim(),
    })
    .select('id, comment_text, created_at, user:enprotec_users(name)')
    .single();

  if (error || !data) {
    console.error('[Comments] Failed to insert comment', error);
    return res.status(500).json({ error: error?.message ?? 'Failed to add comment.' });
  }

  return res.status(201).json({ comment: data as CommentRecord });
};

const handler = async (req: VercelRequest, res: VercelResponse) => {
  sendCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return handleGet(req, res);
  }

  if (req.method === 'POST') {
    return handlePost(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed.' });
};

export default handler;
