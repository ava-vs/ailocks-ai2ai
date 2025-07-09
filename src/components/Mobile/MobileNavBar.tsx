import { useState, useEffect } from 'react';
import { Home, Search, MessageSquare, User, Menu, X, Target } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { useAuth } from '@/hooks/useAuth';
import { useUserSession } from '@/hooks/useUserSession';
import { appState, toggleMobileMenu } from '@/lib/store';
import { AilockInboxService, type InboxState } from '@/lib/ailock/inbox-service';
import MobileIntentPanel from './MobileIntentPanel';
import AilockInboxWidget from '../Ailock/AilockInboxWidget';

export default function MobileNavBar() {
  const { isMobileMenuOpen } = useStore(appState);
  const { user: authUser } = useAuth();
  const { currentUser } = useUserSession();
  const [showIntents, setShowIntents] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [inboxState, setInboxState] = useState<InboxState>({
    interactions: [],
    unreadCount: 0,
    lastUpdate: new Date(0),
    isLoading: false,
    error: null
  });

  // Use auth user if available, otherwise fallback to demo user
  const displayUser = authUser || currentUser;
  const userId = displayUser?.id;

  useEffect(() => {
    if (userId && userId !== 'loading') {
      initializeInboxService();
    }
  }, [userId]);

  const initializeInboxService = async () => {
    if (!userId || userId === 'loading') return;
    
    try {
      const inboxService = AilockInboxService.getInstance();
      await inboxService.init(userId);
      
      // Subscribe to inbox updates
      const unsubscribe = inboxService.subscribe((state: InboxState) => {
        setInboxState(state);
      });

      // Cleanup on unmount
      return () => {
        unsubscribe();
      };
    } catch (error) {
      console.error('Failed to initialize mobile inbox service:', error);
    }
  };

  const toggleIntents = () => {
    setShowIntents(!showIntents);
  };

  const handleInboxClick = () => {
    if (inboxState.error) {
      // If there's an error, retry instead of opening
      const inboxService = AilockInboxService.getInstance();
      inboxService.backgroundRefresh();
    } else {
      setShowInbox(true);
    }
  };

  // Get inbox button style based on state
  const getInboxButtonStyle = () => {
    if (inboxState.error) {
      return 'text-yellow-500';
    }
    if (inboxState.isLoading) {
      return 'text-blue-400';
    }
    return 'text-white/60 hover:text-white';
  };

  return (
    <>
      {/* Fixed bottom navigation bar */}
      <div className="fixed bottom-0 left-0 right-0 h-12 bg-slate-900/95 backdrop-blur-lg border-t border-white/10 z-40 flex items-center justify-around px-2">
        <NavItem href="/" icon={Home} label="Home" />
        <NavItem href="/query-history" icon={Search} label="History" />
        
        {/* Enhanced Inbox button with error handling */}
        <button 
          onClick={handleInboxClick}
          className={`flex flex-col items-center justify-center w-16 h-full transition-colors relative ${getInboxButtonStyle()}`}
          title={inboxState.error ? `Error: ${inboxState.error}. Tap to retry.` : `Inbox${inboxState.unreadCount > 0 ? ` (${inboxState.unreadCount} unread)` : ''}`}
        >
          <MessageSquare className={`w-5 h-5 ${inboxState.isLoading ? 'animate-pulse' : ''}`} />
          <span className="text-[10px] mt-0.5">Inbox</span>
          
          {/* Unread badge */}
          {inboxState.unreadCount > 0 && !inboxState.error && (
            <span className="absolute top-1 right-3 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center text-white text-[8px] font-bold min-w-[12px]">
              {inboxState.unreadCount > 9 ? '9+' : inboxState.unreadCount}
            </span>
          )}
          
          {/* Error indicator */}
          {inboxState.error && (
            <span className="absolute top-1 right-3 w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center text-white text-[8px] font-bold">
              !
            </span>
          )}
          
          {/* Loading indicator */}
          {inboxState.isLoading && !inboxState.error && (
            <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          )}
        </button>
        
        <NavItem href="/my-ailock" icon={User} label="Ailock" />
        <button 
          onClick={toggleIntents}
          className="flex flex-col items-center justify-center w-16 h-full text-white/60 hover:text-white transition-colors relative"
        >
          <Target className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Intents</span>
          {/* Notification indicator */}
          <span className="absolute top-1 right-3 w-2 h-2 bg-blue-500 rounded-full"></span>
        </button>
      </div>

      {/* Mobile Intent Panel (slides up from bottom) */}
      <MobileIntentPanel isOpen={showIntents} onClose={() => setShowIntents(false)} />

      {/* Mobile Inbox Modal */}
      <AilockInboxWidget
        isOpen={showInbox}
        onClose={() => setShowInbox(false)}
        className="md:hidden"
      />
    </>
  );
}

function NavItem({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    // This check now runs only on the client, after hydration.
    setIsActive(window.location.pathname === href);
  }, [href]);

  return (
    <a 
      href={href}
      className={`flex flex-col items-center justify-center w-16 h-full ${
        isActive ? 'text-blue-400' : 'text-white/60 hover:text-white'
      } transition-colors`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] mt-0.5">{label}</span>
    </a>
  );
}