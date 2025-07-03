import { useState, useEffect } from 'react';
import { Star, Settings } from 'lucide-react';
import AilockDashboard from './AilockDashboard';
import { ailockApi } from '@/lib/ailock/api';
import type { FullAilockProfile } from '@/lib/ailock/shared';
import { getLevelInfo } from '@/lib/ailock/shared';
import { useUserSession } from '@/hooks/useUserSession';

export default function AilockWidget() {
  const { currentUser } = useUserSession();
  const [profile, setProfile] = useState<FullAilockProfile | null>(null);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser.id && currentUser.id !== 'loading') {
      loadProfile();
    }
  }, [currentUser.id]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const ailockProfile = await ailockApi.getProfile(currentUser.id);
      setProfile(ailockProfile);
    } catch (error) {
      console.error('Failed to load Ailock profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSkillUpgrade = async (skillId: string) => {
    if (!profile) return;
    
    try {
      await ailockApi.upgradeSkill(profile.id, skillId);
      await loadProfile(); // Refresh profile
      // Notify other components about profile update
      window.dispatchEvent(new CustomEvent('ailock-profile-updated'));
    } catch (error) {
      console.error('Failed to upgrade skill:', error);
      throw error;
    }
  };

  if (loading || !profile) {
    return (
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-white/10 rounded-full animate-pulse"></div>
          <div className="flex-1">
            <div className="h-4 bg-white/10 rounded animate-pulse mb-2"></div>
            <div className="h-3 bg-white/10 rounded animate-pulse w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  const levelInfo = getLevelInfo(profile.xp);

  const getAvatarGradient = () => {
    if (profile.level >= 15) return 'from-purple-400 via-pink-400 to-yellow-400';
    if (profile.level >= 10) return 'from-blue-400 via-purple-400 to-pink-400';
    if (profile.level >= 5) return 'from-green-400 via-blue-400 to-purple-400';
    return 'from-cyan-400 via-blue-400 to-indigo-400';
  };

  return (
    <>
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer">
        <div className="flex items-center space-x-3 mb-3" onClick={() => setIsDashboardOpen(true)}>
          {/* Avatar */}
          <div className="relative">
            <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getAvatarGradient()} p-0.5`}>
              <div className="w-full h-full rounded-lg bg-slate-800/90 flex items-center justify-center">
                <img 
                  src="/images/ailock-avatar.png" 
                  alt="Ailock Avatar" 
                  className="w-8 h-8 object-contain animate-breathe"
                />
              </div>
            </div>
            {/* Level badge */}
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {levelInfo.level}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium text-sm truncate">{profile.name}</h3>
            <p className="text-white/60 text-xs">Level {levelInfo.level}</p>
          </div>
          <button className="p-1 hover:bg-white/10 rounded transition-colors">
            <Settings className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* XP Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">XP Progress</span>
            <span className="text-white/60">{levelInfo.progressXp}/{levelInfo.xpNeededForNextLevel}</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
              style={{ width: `${levelInfo.progressPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Skill Points Notification */}
        {profile.skillPoints > 0 && (
          <div className="mt-3 flex items-center space-x-2 bg-amber-500/20 border border-amber-500/30 rounded-lg px-3 py-2">
            <Star className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 text-xs font-medium">
              {profile.skillPoints} skill point{profile.skillPoints !== 1 ? 's' : ''}
            </span>
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-blue-400 text-xs font-bold">{profile.totalInteractions}</div>
            <div className="text-white/40 text-xs">Chats</div>
          </div>
          <div>
            <div className="text-purple-400 text-xs font-bold">{profile.skills.filter((s) => s.currentLevel > 0).length}</div>
            <div className="text-white/40 text-xs">Skills</div>
          </div>
          <div>
            <div className="text-emerald-400 text-xs font-bold">{profile.achievements.length}</div>
            <div className="text-white/40 text-xs">Awards</div>
          </div>
        </div>
      </div>

      {/* Dashboard Modal */}
      <AilockDashboard
        isOpen={isDashboardOpen}
        onClose={() => setIsDashboardOpen(false)}
        profile={profile}
        onSkillUpgrade={handleSkillUpgrade}
      />
    </>
  );
}
