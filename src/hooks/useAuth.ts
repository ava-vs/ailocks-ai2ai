import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { useCallback } from 'react';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  country?: string | null;
  city?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  loading: true,
  error: null
};

const authAtom = atom<AuthState>(initialState);

// Helper to fetch JSON with proper headers
async function fetchJson(url: string, options: RequestInit = {}) {
  console.log('fetchJson: making request', { url, method: options.method || 'GET' });
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  console.log('fetchJson: response', { status: res.status, ok: res.ok });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
    console.error('fetchJson: error response', errorData);
    throw new Error(errorData.error || 'Request failed');
  }
  return res.json();
}

async function bootstrapAuth() {
  try {
    const data = await fetchJson('/.netlify/functions/auth-me');
    authAtom.set({ user: data, loading: false, error: null });
  } catch {
    authAtom.set({ user: null, loading: false, error: null });
  }
}

// Call bootstrap once when module loads (client side)
if (typeof window !== 'undefined') {
  bootstrapAuth();
}

export function useAuth() {
  const { user, loading, error } = useStore(authAtom);

  const login = useCallback(async (email: string, password: string) => {
    authAtom.set({ user: null, loading: true, error: null });
    console.log('useAuth: login attempt', { email });
    try {
      const data = await fetchJson('/.netlify/functions/auth-login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      console.log('useAuth: login success', data);
      authAtom.set({ user: data, loading: false, error: null });
    } catch (err: any) {
      console.error('useAuth: login error', err);
      authAtom.set({ user: null, loading: false, error: err.message });
      throw err;
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string, country?: string, city?: string) => {
    authAtom.set({ user: null, loading: true, error: null });
    console.log('useAuth: signup attempt', { email, name, country, city });
    try {
      const data = await fetchJson('/.netlify/functions/auth-signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, country, city })
      });
      console.log('useAuth: signup success', data);
      authAtom.set({ user: data, loading: false, error: null });
    } catch (err: any) {
      console.error('useAuth: signup error', err);
      authAtom.set({ user: null, loading: false, error: err.message });
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    authAtom.set({ ...authAtom.get(), loading: true });
    try {
      await fetch('/.netlify/functions/auth-logout', { method: 'POST', credentials: 'include' });
    } finally {
      authAtom.set({ user: null, loading: false, error: null });
    }
  }, []);

  return { user, loading, error, login, signup, logout };
} 