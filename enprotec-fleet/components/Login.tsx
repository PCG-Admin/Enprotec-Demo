import * as React from 'react';
import EnprotecLogo from './icons/EnprotecLogo';
import { signIn } from '../supabase/services/auth.service';
import type { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

const MAX_ATTEMPTS  = 5;
const LOCKOUT_MS    = 15 * 60 * 1000; // 15 minutes

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail]         = React.useState('');
  const [password, setPassword]   = React.useState('');
  const [error, setError]         = React.useState('');
  const [loading, setLoading]     = React.useState(false);
  const attemptsRef               = React.useRef<{ count: number; since: number }>({ count: 0, since: Date.now() });
  const [lockedUntil, setLockedUntil] = React.useState<number | null>(null);

  // Tick down the lockout display every second
  React.useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => {
      if (Date.now() >= lockedUntil) { setLockedUntil(null); attemptsRef.current = { count: 0, since: Date.now() }; }
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Lockout check
    if (lockedUntil && Date.now() < lockedUntil) {
      const secs = Math.ceil((lockedUntil - Date.now()) / 1000);
      setError(`Too many failed attempts. Try again in ${secs}s.`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out. Check your internet connection and try again.')), 12000),
      );
      const { user, error: authError } = await Promise.race([signIn(email.trim(), password), timeout]);
      if (authError || !user) {
        attemptsRef.current.count += 1;
        if (attemptsRef.current.count >= MAX_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_MS;
          setLockedUntil(until);
          setError(`Too many failed attempts. Account locked for 15 minutes.`);
        } else {
          const remaining = MAX_ATTEMPTS - attemptsRef.current.count;
          setError(`${authError ?? 'Login failed.'} ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
        }
        return;
      }
      attemptsRef.current = { count: 0, since: Date.now() };
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex justify-center mb-8">
            <EnprotecLogo className="h-16 w-auto" />
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">Welcome to WMS/FMS</h2>
          <p className="text-gray-500 text-sm mb-6 text-center">Sign in to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
                style={{ fontSize: '16px' }}
                placeholder="you@mindrift.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
                style={{ fontSize: '16px' }}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sky-600 text-white py-2.5 rounded-lg font-medium hover:bg-sky-700 disabled:opacity-60 transition-colors text-sm"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">© 2026 MindRift. All rights reserved.</p>
      </div>
    </div>
  );
};

export default Login;
