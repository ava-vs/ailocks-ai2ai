import { useAuth } from './useAuth';
import { setLocation } from '../lib/store';
import { useEffect } from 'react';

export interface User {
  id: string; 
  name: string;
  email: string;
  country?: string | null;
  city?: string | null;
}

export function useUserSession() {
  const { user: authUser, loading, error, login, signup, logout } = useAuth();

  // Update location when user changes
  useEffect(() => {
    if (authUser && authUser.country && authUser.city) {
      setLocation({
        country: authUser.country,
        city: authUser.city,
        timezone: 'UTC', // TODO: Add timezone to user schema if needed
        isDefault: false
      });
    }
  }, [authUser]);

  // Transform auth user to match existing interface
  const currentUser: User = authUser ? {
    id: authUser.id,
    name: authUser.name,
    email: authUser.email,
    country: authUser.country,
    city: authUser.city
  } : {
    id: 'loading',
    name: 'Loading...',
    email: 'loading@example.com',
    country: null,
    city: null
  };

  return { 
    currentUser,
    isAuthenticated: !!authUser,
    isLoading: loading,
    error,
    login,
    signup,
    logout,
    // Legacy compatibility properties (will be removed gradually)
    isHydrated: !loading,
    demoUsers: { lirea: null, marco: null }, // Empty for compatibility
    demoUsersLoaded: false,
    isLirea: false,
    isMarco: false,
    setUser: () => {}, // No-op for compatibility
    switchUser: () => {} // No-op for compatibility
  };
}
