import { useState, useEffect, useCallback } from 'react';
import type { UserTask } from '../lib/ailock/shared';
import { useAuth } from './useAuth';

export function useDailyTasks() {
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    // We rely on HTTP-only cookie for authentication; user object may still be null during bootstrap,
    // so we proceed with the request and let the backend respond with 401 if not authenticated.

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/.netlify/functions/daily-tasks', {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch tasks');
      }

      const data: UserTask[] = await response.json();
      setTasks(data);

    } catch (err: any) {
      setError(err.message.includes('Not authenticated') ? 'Authentication required' : err.message);
      console.error('Failed to fetch daily tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchTasks();
    }
  }, [authLoading, fetchTasks]);
  
  // Listen for global events that might require a task refresh
  useEffect(() => {
    window.addEventListener('task-completed', fetchTasks);
    window.addEventListener('ailock-profile-updated', fetchTasks);

    return () => {
      window.removeEventListener('task-completed', fetchTasks);
      window.removeEventListener('ailock-profile-updated', fetchTasks);
    };
  }, [fetchTasks]);


  return { tasks, loading, error, refetchTasks: fetchTasks };
} 