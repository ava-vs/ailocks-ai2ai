import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserSession } from '@/hooks/useUserSession';
import { AilockInboxService } from '@/lib/ailock/inbox-service';

/**
 * Global service initializer that sets up background services
 * when the application loads and user is authenticated
 */
export default function GlobalServiceInitializer() {
  const { user: authUser } = useAuth();
  const { currentUser } = useUserSession();

  // Use auth user if available, otherwise fallback to demo user
  const displayUser = authUser || currentUser;
  const userId = displayUser?.id;

  useEffect(() => {
    if (userId && userId !== 'loading') {
      initializeGlobalServices();
    }

    // Cleanup services when user logs out
    return () => {
      if (!userId || userId === 'loading') {
        cleanupGlobalServices();
      }
    };
  }, [userId]);

  const initializeGlobalServices = async () => {
    if (!userId || userId === 'loading') return;

    try {
      console.log('🚀 Initializing global services for user:', userId);

      // Initialize Ailock Inbox Service for background loading
      const inboxService = AilockInboxService.getInstance();
      await inboxService.init(userId);
      
      console.log('✅ Ailock Inbox Service initialized successfully');

      // Here we can initialize other global services:
      // - Real-time notifications service
      // - Background data sync
      // - Performance monitoring
      // - Analytics tracking

    } catch (error) {
      console.error('❌ Failed to initialize global services:', error);
    }
  };

  const cleanupGlobalServices = () => {
    try {
      console.log('🧹 Cleaning up global services...');
      
      // Cleanup Ailock Inbox Service
      const inboxService = AilockInboxService.getInstance();
      inboxService.cleanup();
      
      console.log('✅ Global services cleaned up successfully');
    } catch (error) {
      console.error('❌ Failed to cleanup global services:', error);
    }
  };

  // This component doesn't render anything visible
  return null;
} 