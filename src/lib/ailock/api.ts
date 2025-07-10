import type { FullAilockProfile, XpEventType } from './shared';
import { ailockStore, setAilockProfile, setAilockLoading, setAilockError } from '@/lib/store';

const API_BASE_URL = '/.netlify/functions';

/**
 * Fetches the full Ailock profile for a given user, creating one if it doesn't exist.
 * This is the client-side function that calls the Netlify function.
 */
export async function getProfile(userId: string): Promise<FullAilockProfile> {
  if (!userId || userId === 'loading') {
    throw new Error('Valid user ID is required to fetch Ailock profile.');
  }

  const state = (ailockStore as any).get();

  // Serve from store if we already have a fresh copy
  if (
    state.profile &&
    state.profile.userId === userId &&
    Date.now() - state.lastFetched < state.CACHE_TTL
  ) {
    return state.profile;
  }

  try {
    setAilockLoading(true);
    const response = await fetch(`${API_BASE_URL}/ailock-profile?userId=${userId}`);
    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: 'Failed to fetch profile', details: response.statusText }));
      throw new Error(errorData.details || errorData.error);
    }

    const data = await response.json();
    setAilockProfile(data.profile);
    // also update timestamp
    ailockStore.setKey('lastFetched', Date.now());
    return data.profile;
  } catch (err: any) {
    setAilockError(err.message || 'Failed to fetch profile');
    throw err;
  }
}

/**
 * Upgrades a skill for a given Ailock.
 * This is the client-side function that calls the Netlify function.
 */
export async function upgradeSkill(ailockId: string, skillId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/ailock-upgrade-skill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ailockId, skillId }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to upgrade skill', details: response.statusText }));
    throw new Error(errorData.details || errorData.error);
  }
  return response.json();
}

/**
 * Awards experience points to an Ailock for a specific event.
 * This is the client-side function that calls the Netlify function.
 */
export async function gainXp(ailockId: string, eventType: XpEventType, context: Record<string, any> = {}) {
  const response = await fetch(`${API_BASE_URL}/ailock-gain-xp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ailockId, eventType, context }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to gain XP', details: response.statusText }));
    throw new Error(errorData.details || errorData.error);
  }
  return response.json();
}

export const ailockApi = {
  getProfile,
  upgradeSkill,
  gainXp,
}; 