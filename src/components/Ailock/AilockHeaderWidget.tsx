import React, { useState, useEffect, useRef } from 'react';
import { useUserSession } from '@/hooks/useUserSession';
import { useAuth } from '@/hooks/useAuth';
import { ailockApi } from '@/lib/ailock/api';
import type { FullAilockProfile } from '@/lib/ailock/shared';
import { getLevelInfo } from '@/lib/ailock/shared';
import AilockQuickStatus from './AilockQuickStatus';

export default function AilockHeaderWidget() {
  const { currentUser } = useUserSession();
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<FullAilockProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isQuickStatusOpen, setIsQuickStatusOpen] = useState(false);

  // Use auth user if available, otherwise fallback to demo user
  const displayUser = authUser || currentUser;
  const userId = displayUser?.id;

  useEffect(() => {
    if (userId && userId !== 'loading') {
      loadProfile();
    }
  }, [userId]);

  // Listen for profile updates from other components
  useEffect(() => {
    const handleProfileUpdate = () => {
      if (userId && userId !== 'loading') {
        loadProfile();
      }
    };

    window.addEventListener('ailock-profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('ailock-profile-updated', handleProfileUpdate);
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

  if (loading || !profile) {
    return (
      <div className="flex items-center space-x-3">
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

  return (
      <>
        <div className="relative">
          <button 
            onClick={() => setIsQuickStatusOpen(true)}
            className="flex items-center space-x-3 hover:bg-white/10 rounded-lg p-2 transition-colors cursor-pointer border border-white/20 ailock-widget"
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

          <AilockQuickStatus
            isOpen={isQuickStatusOpen}
            onClose={() => setIsQuickStatusOpen(false)}
            profile={profile}
            onOpenFullProfile={handleOpenFullProfile}
          />
        </div>
      </>
    );
  }