import { useStore } from '@nanostores/react';
import { ailockStore, setAilockProfile, setAilockLoading, setAilockError } from '../lib/store';
import type { FullAilockProfile } from '../lib/store';
import { getAilockProfile, gainAilockXp } from '../lib/api';
import { useCallback, useEffect, useState } from 'react';
import { useUserSession } from './useUserSession';
import toast from 'react-hot-toast';
import type { XpEventType } from '../lib/ailock/shared';

export function useAilock() {
  const { profile, isLoading, error } = useStore(ailockStore);
  const { currentUser, isAuthenticated } = useUserSession();
  const [loadAttempted, setLoadAttempted] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!isAuthenticated) return;
    
    if (!loadAttempted) {
      setLoadAttempted(true);
    }

    try {
      setAilockLoading(true);
      const profileData = await getAilockProfile(true);
      
      if (profileData) {
        // Успешно загружен профиль
        console.log('Ailock profile loaded successfully', profileData);
        // Обновляем глобальное состояние
        setAilockProfile(profileData);
      } else {
        console.warn('No profile data returned from getAilockProfile');
      }
    } catch (err) {
      console.error('Failed to load Ailock profile:', err);
      setAilockError(err instanceof Error ? err.message : 'Не удалось загрузить профиль');
    }
  }, [isAuthenticated, loadAttempted]);

  // Инициализация профиля при загрузке компонента или изменении статуса авторизации
  useEffect(() => {
    // Загружаем только если авторизованы и профиль еще не загружен или находится в процессе загрузки
    if (isAuthenticated && !profile && !loadAttempted) {
      loadProfile();
    }
  }, [isAuthenticated, profile, isLoading, loadProfile, loadAttempted]);
  
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
    loadProfile, // Экспортируем функцию загрузки профиля для возможного ручного вызова
  };
} 