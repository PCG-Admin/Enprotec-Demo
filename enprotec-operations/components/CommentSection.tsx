import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase/client';
import { WorkflowComment, User } from '../types';

interface CommentSectionProps {
  workflowId: string;
  user: User;
}

type CommentResponse = {
  comments?: WorkflowComment[];
  comment?: WorkflowComment;
  error?: string;
};

const COMMENTS_ENDPOINT = import.meta.env.VITE_WORKFLOW_COMMENTS_ENDPOINT
  ? String(import.meta.env.VITE_WORKFLOW_COMMENTS_ENDPOINT).trim()
  : '';

const CommentSection: React.FC<CommentSectionProps> = ({ workflowId, user }) => {
  const [comments, setComments] = useState<WorkflowComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(Boolean(COMMENTS_ENDPOINT));

  const fetchCommentsViaSupabase = useCallback(async (): Promise<WorkflowComment[]> => {
    const { data, error } = await supabase
      .from('enprotec_workflow_comments')
      .select('id, comment_text, created_at, user:enprotec_users(name)')
      .eq('workflow_request_id', workflowId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return (data as WorkflowComment[]) ?? [];
  }, [workflowId]);

  const postCommentViaSupabase = useCallback(
    async (commentText: string) => {
      const { error } = await supabase.from('enprotec_workflow_comments').insert({
        workflow_request_id: workflowId,
        user_id: user.id,
        comment_text: commentText,
      });

      if (error) {
        throw error;
      }
    },
    [workflowId, user.id]
  );

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      let fetched = false;

      if (apiAvailable && COMMENTS_ENDPOINT) {
        try {
          const response = await fetch(
            `${COMMENTS_ENDPOINT}?workflowId=${encodeURIComponent(workflowId)}`
          );
          const payload = (await response.json().catch(() => ({}))) as CommentResponse;

          if (response.status !== 404 && response.status !== 405) {
            if (!response.ok) {
              throw new Error(
                payload.error || `Failed to fetch comments (status ${response.status}).`
              );
            }
            setComments(payload.comments ?? []);
            fetched = true;
          } else {
            setApiAvailable(false);
          }
        } catch (apiError) {
          if (apiError instanceof TypeError) {
            console.warn(
              '[Comments] API endpoint unreachable, falling back to Supabase client.',
              apiError
            );
            setApiAvailable(false);
          } else if (apiError instanceof Error && apiError.message.includes('status 404')) {
            console.info('[Comments] API endpoint not found, using Supabase client fallback.');
            setApiAvailable(false);
          } else {
            console.error('[Comments] Failed via API endpoint:', apiError);
          }
        }
      }

      if (!fetched) {
        const fallbackComments = await fetchCommentsViaSupabase();
        setComments(fallbackComments);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoading(false);
    }
  }, [workflowId, apiAvailable, fetchCommentsViaSupabase]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handlePostComment = async () => {
    const trimmedComment = newComment.trim();
    if (!trimmedComment || isPosting) return;
    setIsPosting(true);
    try {
      let shouldFallbackToSupabase = false;

      if (!apiAvailable || !COMMENTS_ENDPOINT) {
        await postCommentViaSupabase(trimmedComment);
        setNewComment('');
        await fetchComments();
        return;
      }

      const response = await fetch(COMMENTS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId,
          userId: user.id,
          comment: trimmedComment,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as CommentResponse;
      if (!response.ok) {
        if (response.status === 404 || response.status === 405) {
          shouldFallbackToSupabase = true;
          setApiAvailable(false);
        } else {
          throw new Error(payload.error || `Failed to post comment (status ${response.status}).`);
        }
      }

      if (response.ok && payload.comment) {
        // API already returned the inserted comment, no fallback needed.
        const newEntry = payload.comment as WorkflowComment;
        setComments(prev => [...prev, newEntry]);
      }

      if (shouldFallbackToSupabase) {
        await postCommentViaSupabase(trimmedComment);
      }

      setNewComment('');
      if (!payload.comment) {
        await fetchComments(); // Refresh comments list
      }
    } catch (err) {
      const isEndpointMissing =
        err instanceof Error && err.message.includes('Failed to post comment (status 404)');
      if (isEndpointMissing || err instanceof TypeError) {
        setApiAvailable(false);
        try {
          await postCommentViaSupabase(trimmedComment);
          setNewComment('');
          await fetchComments();
          return;
        } catch (fallbackError) {
          console.error('Fallback comment post failed:', fallbackError);
          alert(
            fallbackError instanceof Error
              ? fallbackError.message
              : 'Failed to post comment. Please try again later.'
          );
        }
      } else {
        alert(
          err instanceof Error ? err.message : 'Failed to post comment. Please try again later.'
        );
        console.error(err);
      }
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
        {loading && <p className="text-sm text-zinc-500">Loading comments...</p>}
        {!loading && comments.length === 0 && <p className="text-sm text-zinc-500">No comments yet.</p>}
        {comments.map(comment => (
          <div key={comment.id} className="text-sm">
            <p className="text-zinc-700 bg-zinc-100 p-3 rounded-lg rounded-bl-none">{comment.comment_text}</p>
            <div className="text-xs text-zinc-400 mt-1 pl-1">
              <strong>{comment.user?.name || 'Unknown User'}</strong> &mdash; {new Date(comment.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-start space-x-3" onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          handlePostComment();
        }
      }}>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows={2}
          className="flex-1 p-2 bg-white border border-zinc-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-900"
          disabled={isPosting}
        />
        <button
          type="button"
          onClick={handlePostComment}
          disabled={isPosting || !newComment.trim()}
          className="px-4 py-2 bg-zinc-200 text-zinc-800 font-semibold rounded-md hover:bg-zinc-300 disabled:bg-zinc-100 disabled:cursor-not-allowed transition-colors"
        >
          {isPosting ? '...' : 'Post'}
        </button>
      </div>
    </div>
  );
};

export default CommentSection;
