// AICODE-NOTE: Central API configuration point
// All serverless function calls are routed through this base path
import type { AilockInteraction } from '@/types/ailock-interactions';
import { ailockStore, setAilockProfile, setAilockLoading, setAilockError } from './store';
import type { FullAilockProfile } from './store';

const API_BASE = '/.netlify/functions';

export function buildHeaders(extra: Record<string, string> = {}): HeadersInit {
  if (typeof window === 'undefined') return { ...extra };
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra
  };
}

export const searchIntents = async (query: string) => {
  try {
    const userLocation = JSON.parse(localStorage.getItem('userLocation') || '{}');
    const userId = localStorage.getItem('userId');
    
    const params = new URLSearchParams({
      search: query,
      userCountry: userLocation.country || 'BR',
      userCity: userLocation.city || 'Rio de Janeiro',
      limit: '10'
    });
    
    // Only add userId if it's a valid UUID (not demo-user-1 or similar)
    if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      params.append('userId', userId);
    }
    
    console.log('🔍 Searching intents with params:', params.toString());
    
    const response = await fetch(`${API_BASE}/intents-list?${params}`);
    if (!response.ok) {
      console.warn(`⚠️ Search failed with status ${response.status}, returning empty results`);
      return [];
    }
    const data = await response.json();
    
    console.log('✅ Search results:', data.intents?.length || 0, 'intents found');
    return data.intents || [];
  } catch (error) {
    console.error('Search intents error:', error);
    return [];
  }
};

// AICODE-NOTE: Intent creation requires authentication
// All intent operations use localStorage-based auth token verification
export const createIntent = async (intentData: any) => {
  try {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      // AICODE-TODO: Implement proper auth error handling with redirect to login
      throw new Error('User not authenticated');
    }
    
    const response = await fetch(`${API_BASE}/intents-create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        intentData: {
          title: intentData.title,
          description: intentData.description,
          category: intentData.category,
          requiredSkills: Array.isArray(intentData.requiredSkills) 
            ? intentData.requiredSkills 
            : intentData.requiredSkills.split(',').map((s: string) => s.trim())
        },
        userId 
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to create intent and parse error' }));
      throw new Error(errorData.message || 'Failed to create intent');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Create intent error:', error);
    throw error;
  }
};

export const deleteIntent = async (intentId: string, userId: string) => {
  try {
    const response = await fetch(`${API_BASE}/intents-delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ intentId, userId })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to delete intent and parse error' }));
      throw new Error(errorData.message || 'Failed to delete intent');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Delete intent error:', error);
    throw error;
  }
};

export const getAilockProfile = async (forceRefresh = false): Promise<FullAilockProfile | null> => {
  try {
    // Получаем токен из localStorage, если он там есть
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    
    // Добавляем Authorization заголовок, если есть токен
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await fetch('/.netlify/functions/ailock-batch', {
      method: 'POST',
      headers: buildHeaders(), 
      body: JSON.stringify({ requests: [{ type: 'get_profile' }] })
    });
    if (!res.ok) throw new Error('Failed to fetch Ailock profile');
    const data = await res.json();
    // Корректно парсим batch-ответ
    const profileResult = Array.isArray(data.results)
      ? data.results.find((r: any) => r.type === 'get_profile' && r.success)
      : null;
    const profile = profileResult?.data || null;
    return profile;
  } catch (err) {
    console.error('Get Ailock profile error:', err);
    return null;
  }
};

export const gainAilockXp = async (eventType: string, context: Record<string, any> = {}) => {
  try {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    
    const response = await fetch(`${API_BASE}/ailock-gain-xp`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        userId,
        eventType,
        context
      })
    });
    
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Gain XP error:', error);
  }
};

export const getProfileByUserId = async (userId: string): Promise<FullAilockProfile | null> => {
  if (!userId) {
    console.error('User ID is required to fetch a profile.');
    return null;
  }

  try {
    const res = await fetch(`${API_BASE}/ailock-batch`, {
      method: 'POST',
      headers: buildHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        requests: [{ type: 'get_profile_by_user_id', userId }]
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Batch request failed: ${errorText}`);
    }

    const json = await res.json();
    const result = json.results?.[0];

    if (!result || !result.success) {
      throw new Error(result?.error || 'Failed to get profile by user ID from batch response');
    }

    return result.data as FullAilockProfile;

  } catch (error) {
    console.error('Get profile by user ID error:', error);
    return null;
  }
};

// === AI2AI Interaction helpers ===

export const sendAilockMessage = async ({
  toAilockId,
  message,
  type = 'collaboration_request',
  intentId,
  sessionId
}: {
  toAilockId: string;
  message: string;
  type?: 'clarify_intent' | 'provide_info' | 'collaboration_request' | 'response';
  intentId?: string;
  sessionId?: string;
}) => {
  try {
    const res = await fetch(`${API_BASE}/ailock-interaction`, {
      method: 'POST',
      headers: buildHeaders(),
      credentials: 'include',
      body: JSON.stringify({ toAilockId, message, type, intentId, sessionId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to send message');
    }
    return await res.json();
  } catch (error) {
    console.error('Send Ailock message error:', error);
    throw error;
  }
};

export const fetchInboxInteractions = async (limit = 50, offset = 0) => {
  try {
    const res = await fetch(`${API_BASE}/ailock-interaction?limit=${limit}&offset=${offset}`, {
      credentials: 'include',
      headers: buildHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch inbox');
    const data = await res.json();
    return data.interactions || [];
  } catch (error) {
    console.error('Fetch inbox error:', error);
    return [];
  }
};

export const replyAilockMessage = async ({
  originalInteractionId,
  responseContent
}: {
  originalInteractionId: string;
  responseContent: string;
}) => {
  try {
    const res = await fetch(`${API_BASE}/ailock-interaction`, {
      method: 'PATCH',
      headers: buildHeaders(),
      credentials: 'include',
      body: JSON.stringify({ originalInteractionId, responseContent })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to reply');
    }
    return await res.json();
  } catch (error) {
    console.error('Reply Ailock message error:', error);
    throw error;
  }
}; 

export const getIntentInteractions = async (intentId: string) => {
  const res = await fetch('/.netlify/functions/ailock-batch', {
    method: 'POST',
    headers: buildHeaders(),
    credentials: 'include',          // ⬅ auth cookies
    body: JSON.stringify({
      requests: [{ type: 'get_intent_interactions', intentId }]
    })
  });
  if (!res.ok) throw new Error(await res.text());

  const json = await res.json();
  const item = json.results[0];      // actual field name
  if (!item.success) throw new Error(item.error || 'Failed');
  return item.data as AilockInteraction[];
}; 