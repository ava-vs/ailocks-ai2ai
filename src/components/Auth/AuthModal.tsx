import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login, signup, error } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    console.log('AuthModal: submitting', { mode, email, name });
    try {
      if (mode === 'login') {
        console.log('AuthModal: calling login');
        await login(email, password);
      } else {
        console.log('AuthModal: calling signup');
        await signup(email, password, name);
      }
      console.log('AuthModal: success, closing modal');
      onClose();
    } catch (err) {
      console.error('AuthModal: error', err);
      // error handled in hook
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 w-full max-w-md rounded-xl p-6 relative animate-fade-in my-auto">
        <button className="absolute top-3 right-3 text-gray-400 hover:text-gray-200" onClick={onClose}>
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-semibold text-white mb-4 text-center">
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </h2>
        {error && <p className="text-red-400 text-sm mb-3 text-center">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 rounded bg-slate-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 rounded bg-slate-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 rounded bg-slate-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium transition-colors disabled:opacity-60"
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>
        <p className="text-sm text-center text-gray-400 mt-4">
          {mode === 'login' ? (
            <>Don't have an account?{' '}
              <button className="text-blue-400 hover:underline" onClick={() => setMode('signup')}>Sign Up</button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button className="text-blue-400 hover:underline" onClick={() => setMode('login')}>Sign In</button>
            </>
          )}
        </p>
      </div>
    </div>
  );
} 