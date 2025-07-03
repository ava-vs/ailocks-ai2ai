const API_BASE = '/.netlify/functions';

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

export const createIntent = async (intentData: any) => {
  try {
    const userId = localStorage.getItem('userId');
    if (!userId) {
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

export const getAilockProfile = async () => {
  try {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    const response = await fetch(`${API_BASE}/ailock-profile?userId=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch Ailock profile');
    return await response.json();
  } catch (error) {
    console.error('Get Ailock profile error:', error);
    throw error;
  }
};

export const gainAilockXp = async (eventType: string, context: Record<string, any> = {}) => {
  try {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    
    const response = await fetch(`${API_BASE}/ailock-gain-xp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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