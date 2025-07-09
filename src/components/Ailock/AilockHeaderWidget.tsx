import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { useUserSession } from '@/hooks/useUserSession';
import { useAuth } from '@/hooks/useAuth';
import { ailockApi } from '@/lib/ailock/api';
import type { FullAilockProfile } from '@/lib/ailock/shared';
import { getLevelInfo } from '@/lib/ailock/shared';
import { AilockInboxService, type InboxState } from '@/lib/ailock/inbox-service';
import AilockQuickStatus from './AilockQuickStatus';
import AilockInboxWidget from './AilockInboxWidget';

export default function AilockHeaderWidget() {
  const { currentUser } = useUserSession();
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<FullAilockProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isQuickStatusOpen, setIsQuickStatusOpen] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
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
      loadProfile();
      initializeInboxService();
    }
  }, [userId]);

  // Initialize inbox service
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
      console.error('Failed to initialize inbox service:', error);
    }
  };

  // Listen for profile updates from other components
  useEffect(() => {
    const handleProfileUpdate = () => {
      if (userId && userId !== 'loading') {
        loadProfile();
      }
    };

    window.addEventListener('ailock-profile-updated', handleProfileUpdate);
    
    return () => {
      window.removeEventListener('ailock-profile-updated', handleProfileUpdate);
    };
  }, [userId]);

  const loadProfile = async () => {
    if (!userId || userId === 'loading') return;
    
    try {
      setLoading(true);
      const ailockProfile = await ailockApi.getProfile(userId);
      setProfile(ailockProfile);
      console.log('✅ Ailock profile loaded successfully:', ailockProfile?.name);
    } catch (error) {
      console.error('Failed to load Ailock profile for header:', error);
      // For authenticated users, we might not have an Ailock profile yet
      if (authUser) {
        console.log('Creating new Ailock profile for authenticated user...');
        // The profile will be created automatically when needed
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInbox = () => {
    setIsInboxOpen(true);
  };

  const handleRetryInbox = () => {
    const inboxService = AilockInboxService.getInstance();
    inboxService.backgroundRefresh();
  };

  // Get inbox button style and tooltip based on state
  const getInboxButtonStyle = () => {
    if (inboxState.error) {
      return {
        className: 'text-yellow-500 hover:text-yellow-600',
        tooltip: `Failed to update inbox: ${inboxState.error}. Click to retry.`,
        onClick: handleRetryInbox
      };
    }
    if (inboxState.isLoading) {
      return {
        className: 'text-blue-400 animate-pulse',
        tooltip: 'Updating inbox...',
        onClick: handleOpenInbox
      };
    }
    return {
      className: 'text-white/70 hover:text-white',
      tooltip: inboxState.unreadCount > 0 ? `Inbox (${inboxState.unreadCount} unread)` : 'Inbox',
      onClick: handleOpenInbox
    };
  };

  if (loading || !profile) {
    return (
      <div className="hidden md:flex items-center space-x-3">
        <div className="w-10 h-10 bg-white/5 rounded-lg animate-pulse" />
        <div className="w-32 h-6 bg-white/5 rounded animate-pulse" />
      </div>
    );
  }

  const levelInfo = getLevelInfo(profile.xp);

  const getAvatarGradient = () => {
    if (levelInfo.level >= 15) return 'from-purple-400 via-pink-400 to-yellow-400';
    if (levelInfo.level >= 10) return 'from-blue-400 via-purple-400 to-pink-400';
    if (levelInfo.level >= 5) return 'from-green-400 via-blue-400 to-purple-400';
    return 'from-cyan-400 via-blue-400 to-indigo-400';
  };

  const handleOpenFullProfile = () => {
    window.location.href = '/my-ailock';
  };

  const inboxButtonStyle = getInboxButtonStyle();

  return (
      <>
        <div className="relative flex items-center space-x-2">
          {/* Main Ailock Button */}
          <button 
            onClick={() => setIsQuickStatusOpen(true)}
            className="hidden md:flex items-center space-x-3 hover:bg-white/10 rounded-lg p-2 transition-colors cursor-pointer border border-white/20 ailock-widget"
          >
            {/* Avatar */}
            <div className="relative">
              <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getAvatarGradient()} p-0.5`}>
                <div className="w-full h-full rounded-lg bg-slate-800/90 flex items-center justify-center">
                  <img 
                    src="/images/ailock-avatar.png" 
                    alt="Ailock Avatar" 
                    className="w-8 h-8 object-contain animate-breathe"
                    style={{border: 'none', outline: 'none'}}
                  />
                </div>
              </div>
              {/* Level badge */}
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {levelInfo.level}
              </div>
            </div>

            {/* Info */}
            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-white/90">{profile.name}</span>
                <span className="text-xs text-white/60">Level {levelInfo.level}</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-24 bg-white/10 rounded-full h-1.5 overflow-hidden" title={`${levelInfo.progressXp}/${levelInfo.xpNeededForNextLevel} XP`}>
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                    style={{ width: `${levelInfo.progressPercentage}%` }}
                  ></div>
                </div>
                <span className="text-xs text-white/50">{profile.xp} XP</span>
              </div>
            </div>
            
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Enhanced Inbox Button with Error Handling */}
          <div className="relative hidden md:block">
            <button
              onClick={inboxButtonStyle.onClick}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors border border-white/20 flex items-center justify-center group"
              title={inboxButtonStyle.tooltip}
            >
              <MessageSquare className={`w-5 h-5 transition-colors ${inboxButtonStyle.className}`} />
              
              {/* Unread badge */}
              {inboxState.unreadCount > 0 && !inboxState.error && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center min-w-[20px] px-1">
                  {inboxState.unreadCount > 99 ? '99+' : inboxState.unreadCount}
                </span>
              )}
              
              {/* Error indicator */}
              {inboxState.error && (
                <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  !
                </span>
              )}
              
              {/* Loading indicator */}
              {inboxState.isLoading && !inboxState.error && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              )}
              
              {/* Enhanced tooltip on hover */}
              {inboxState.error && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                  {inboxButtonStyle.tooltip}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                </div>
              )}
            </button>
          </div>

          {/* Modals */}
          <AilockQuickStatus
            isOpen={isQuickStatusOpen}
            onClose={() => setIsQuickStatusOpen(false)}
            profile={profile}
            onOpenFullProfile={handleOpenFullProfile}
          />

          <AilockInboxWidget
            isOpen={isInboxOpen}
            onClose={() => setIsInboxOpen(false)}
          />
        </div>
      </>
    );
  }