import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import type { UserTask } from '../lib/ailock/shared';
import { useAuth } from './useAuth';
import { useStore } from '@nanostores/react';
import { ailockStore } from '../lib/store';

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
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const response = await fetch('/.netlify/functions/daily-tasks', {
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
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
  
  // === Real-time completion notifications ===
  const prevTasksRef = useRef<UserTask[]>([]);

  useEffect(() => {
    if (loading) return;

    const prevTasks = prevTasksRef.current;
    const newlyCompleted = tasks.filter((task) => {
      if (task.status !== 'completed') return false;
      const prev = prevTasks.find((t) => t.id === task.id);
      return !prev || prev.status !== 'completed';
    });

    newlyCompleted.forEach((task) => {
      const taskName = task.definition?.name || task.taskId;
      const xp = task.definition?.xpReward || 0;

      // Toast notification
      toast.success(`✅ Task "${taskName}" completed! +${xp} XP`, { duration: 4000, icon: '🎉' });

      // Dispatch global event for other listeners (e.g., widgets)
      window.dispatchEvent(
        new CustomEvent('task-completed', {
          detail: {
            taskId: task.taskId,
            taskName,
            xpGained: xp,
          },
        })
      );
    });

    // Update ref for next comparison
    prevTasksRef.current = tasks;
  }, [tasks, loading]);

  const { profile } = useStore(ailockStore);

  useEffect(() => {
    // Refetch tasks when the profile changes, as tasks might be level-dependent.
    if (profile) {
      fetchTasks();
    }
  }, [profile, fetchTasks]);

  useEffect(() => {
    window.addEventListener('task-completed', fetchTasks);
    return () => {
      window.removeEventListener('task-completed', fetchTasks);
    };
  }, [fetchTasks]);

  return { tasks, loading, error, refetchTasks: fetchTasks };
}