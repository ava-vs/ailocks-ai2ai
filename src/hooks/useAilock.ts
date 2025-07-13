import { useStore } from '@nanostores/react';
import { ailockStore, setAilockProfile, setAilockLoading, setAilockError } from '../lib/store';
import type { FullAilockProfile } from '../lib/store';
import { getAilockProfile, gainAilockXp } from '../lib/api';
import { useCallback, useEffect } from 'react';
import { useUserSession } from './useUserSession';
import toast from 'react-hot-toast';
import type { XpEventType } from '../lib/ailock/shared';

export function useAilock() {
  const { profile, isLoading, error } = useStore(ailockStore);
  const { currentUser, isAuthenticated } = useUserSession();

  const loadProfile = useCallback(async () => {
    if (isAuthenticated && !profile) {
      getAilockProfile();
    }
  }, [isAuthenticated, profile]);

  useEffect(() => {
    if (isAuthenticated && !profile && !isLoading) {
      loadProfile();
    }
  }, [isAuthenticated, profile, isLoading, loadProfile]);
  
  const gainXp = useCallback(async (eventType: XpEventType, context: Record<string, any> = {}) => {
    if (!profile?.id) {
      console.warn("Ailock profile ID not available to gain XP.");
      return null;
    }

    const result = await gainAilockXp(eventType, context);

    if (result) {
      toast.success(`+${result.xpGained} XP`, { duration: 1500, icon: '✨' });
      getAilockProfile(true); // Force refresh
    }

    return result;
  }, [profile]);

  return {
    profile,
    isLoading,
    error,
    gainXp,
  };
} 