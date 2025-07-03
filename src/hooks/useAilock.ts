import { useStore } from '@nanostores/react';
import { ailockStore, setAilockProfile, setAilockLoading, setAilockError } from '../lib/store';
import type { FullAilockProfile } from '../lib/store';
import { getProfile as fetchProfile, gainXp as gainXpApi } from '../lib/ailock/api';
import { useCallback, useEffect } from 'react';
import { useUserSession } from './useUserSession';
import toast from 'react-hot-toast';

export type XpEventType = 
  | 'chat_message_sent'
  | 'voice_message_sent'
  | 'intent_created'
  | 'intent_deleted'
  | 'skill_used_successfully'
  | 'achievement_unlocked'
  | 'project_started'
  | 'project_completed'
  | 'first_login_today';

export function useAilock() {
  const { profile, isLoading, error } = useStore(ailockStore);
  const { currentUser, isAuthenticated } = useUserSession();

  const loadProfile = useCallback(async () => {
    if (!isAuthenticated || !currentUser?.id || currentUser.id === 'loading' || profile) {
      return;
    }

    setAilockLoading(true);
    try {
      const fetchedProfile = await fetchProfile(currentUser.id);
      setAilockProfile(fetchedProfile);
    } catch (err: any) {
      console.error("Failed to load Ailock profile via hook", err);
      const errorMessage = err.message || 'Could not load Ailock profile.';
      setAilockError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setAilockLoading(false);
    }
  }, [isAuthenticated, currentUser?.id, profile]);

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

    try {
      const result = await gainXpApi(profile.id, eventType, context);
      if (result.success) {
        toast.success(`+${result.xpGained} XP`, { duration: 1500, icon: '✨' });
        
        const updatedProfile = {
            ...profile,
            xp: result.newXp,
            level: result.newLevel,
            skillPoints: result.newSkillPoints
        };

        setAilockProfile(updatedProfile as FullAilockProfile);

        window.dispatchEvent(new CustomEvent('ailock-profile-updated', { detail: updatedProfile }));
        return result;
      }
    } catch (err) {
      console.error("Failed to gain XP via hook", err);
      toast.error("Failed to record XP gain.");
    }
    return null;
  }, [profile]);

  return {
    profile,
    isLoading,
    error,
    gainXp,
  };
} 