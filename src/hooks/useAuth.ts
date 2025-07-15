import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { useCallback, useEffect } from 'react';
import { getAilockProfile } from '../lib/api'; 

interface AuthUser {
  id: string;
  email: string;
  name: string;
  country?: string | null;
  city?: string | null;
  escrow_user_id?: string | null;
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
  // Automatically attach Bearer token from localStorage if exists and header not provided
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (token && (!options.headers || !(options.headers as any)['Authorization'])) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`
    };
  }
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
  // Try to read stored auth token
  const storedToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  // If user just logged out, skip auth check
  const recentlyLoggedOut = localStorage.getItem('recentlyLoggedOut') === 'true';
  if (recentlyLoggedOut) {
    localStorage.removeItem('recentlyLoggedOut');
    localStorage.removeItem('sessionActive');
    authAtom.set({ user: null, loading: false, error: null });
    return;
  }

  try {
    // If token stored, pass it explicitly to auth-me (fetchJson still adds automatically, но явное лучше)
    const authMeOptions = storedToken ? { headers: { Authorization: `Bearer ${storedToken}` } } : {};
    const data = await fetchJson('/.netlify/functions/auth-me', authMeOptions);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sessionActive', 'true');
      if (data?.token) {
        localStorage.setItem('auth_token', data.token);
      }
      if (data?.id) {
        localStorage.setItem('userId', data.id);
      }
    }
    authAtom.set({ user: data, loading: false, error: null });
  } catch (error) {
    console.error('Bootstrap auth error:', error);
    // On error, clear session
    localStorage.removeItem('sessionActive');
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
      // save token
      if (typeof window !== 'undefined' && data?.token) {
        localStorage.setItem('auth_token', data.token);
      }
      console.log('useAuth: login success', data);
      // Store userId in localStorage for helpers that rely on it
      if (typeof window !== 'undefined' && data?.id) {
        localStorage.setItem('userId', data.id);
      }
      authAtom.set({ user: data, loading: false, error: null });
      if (typeof window !== 'undefined') {
        getAilockProfile(true); // force refresh
      }
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
      if (typeof window !== 'undefined' && data?.token) {
        localStorage.setItem('auth_token', data.token);
      }
      console.log('useAuth: signup success', data);
      authAtom.set({ user: data, loading: false, error: null });
      if (typeof window !== 'undefined') {
        const { getAilockProfile } = await import('../lib/api');
        getAilockProfile(true);
      }
    } catch (err: any) {
      console.error('useAuth: signup error', err);
      authAtom.set({ user: null, loading: false, error: err.message });
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    authAtom.set({ ...authAtom.get(), loading: true });
    try {
      const response = await fetch('/.netlify/functions/auth-logout', { 
        method: 'POST', 
        credentials: 'include' 
      });
      
      if (response.ok) {
        // Set the recentlyLoggedOut flag
        if (typeof window !== 'undefined') {
          localStorage.setItem('recentlyLoggedOut', 'true');
          localStorage.removeItem('userId');
          localStorage.removeItem('auth_token');
        }
      }
    } finally {
      authAtom.set({ user: null, loading: false, error: null });
      
      if (typeof window !== 'undefined') {
        // Redirect to the home page
        window.location.replace('/');
      }
    }
  }, []);

  return { user, loading, error, login, signup, logout };
}
