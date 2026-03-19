import React, { useEffect, useMemo, useState } from 'react';
import MindriftLogo from './icons/MindriftLogo';
import EnprotecLogo from './icons/EnprotecLogo';
import { supabase } from '../supabase/client';

type StatusState =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; message: string };

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<StatusState>({ kind: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  const formDisabled = useMemo(() => {
    return (
      submitting ||
      password.trim().length < 8 ||
      confirmPassword.trim().length < 8 ||
      password !== confirmPassword
    );
  }, [confirmPassword, password, submitting]);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setHasRecoverySession(Boolean(data.session));
      setSessionReady(true);
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' && session) {
        setHasRecoverySession(true);
        setSessionReady(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (formDisabled) {
      return;
    }

    setSubmitting(true);
    setStatus({ kind: 'idle' });

    try {
      const trimmedPassword = password.trim();

      const { error } = await supabase.auth.updateUser({ password: trimmedPassword });

      if (error) {
        console.error('[Auth] updateUser password reset failed', error);
        setStatus({
          kind: 'error',
          message: error.message ?? 'Unable to reset password. Please try again.',
        });
        return;
      }

      setStatus({
        kind: 'success',
        message: 'Password updated. You can now return to the sign-in page.',
      });
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('[Auth] unexpected reset password error', error);
      const message =
        error instanceof Error ? error.message : 'Unable to reset password. Please try again.';
      setStatus({ kind: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToSignIn = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-100 font-sans">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg border border-zinc-200 shadow-sm">
        <div className="text-center space-y-6">
          <div className="flex flex-col items-center justify-center gap-4">
            <MindriftLogo className="h-28 w-auto max-w-xs" />
            <EnprotecLogo className="h-16 w-auto max-w-sm" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900">Reset your password</h2>
          <p className="text-sm text-zinc-500">
            {sessionReady
              ? hasRecoverySession
                ? 'Enter a new password for your account.'
                : 'Use the password reset link from your email to access this page.'
              : 'Verifying reset link…'}
          </p>
        </div>

        {sessionReady && hasRecoverySession ? (
          <form className="mt-4 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <div>
                <label htmlFor="new-password" className="sr-only">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  className="appearance-none block w-full px-3 py-3 border border-zinc-300 bg-white placeholder-zinc-500 text-zinc-900 rounded-md focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                  placeholder="New password (min 8 characters)"
                  disabled={submitting}
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="sr-only">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                  className="appearance-none block w-full px-3 py-3 border border-zinc-300 bg-white placeholder-zinc-500 text-zinc-900 rounded-md focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                  placeholder="Confirm new password"
                  disabled={submitting}
                />
              </div>
            </div>

            {password !== confirmPassword && confirmPassword.length > 0 && (
              <p className="text-xs text-red-600 text-center">Passwords must match.</p>
            )}

            {status.kind === 'error' && (
              <p className="text-sm text-red-600 text-center">{status.message}</p>
            )}

            {status.kind === 'success' && (
              <p className="text-sm text-emerald-600 text-center">{status.message}</p>
            )}

            <div className="space-y-3">
              <button
                type="submit"
                disabled={formDisabled}
                className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-sky-500 hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-100 focus:ring-sky-500 transition-colors disabled:bg-zinc-300"
              >
                {submitting ? 'Updating password…' : 'Update password'}
              </button>
              <button
                type="button"
                onClick={handleBackToSignIn}
                className="w-full text-sm font-medium text-sky-600 hover:text-sky-700"
              >
                Return to sign in
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {status.kind === 'error' && (
              <p className="text-sm text-red-600 text-center">{status.message}</p>
            )}
            <button
              type="button"
              onClick={handleBackToSignIn}
              className="w-full text-sm font-medium text-sky-600 hover:text-sky-700"
            >
              Return to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;


