import { useState, useEffect } from 'react';
import { useUserSession } from '@/hooks/useUserSession';
import { ailockApi } from '@/lib/ailock/api';
import type { FullAilockProfile, AilockSkill, AilockAchievement, XpEvent } from '@/lib/ailock/shared';
import { getLevelInfo, getSkillEffect } from '@/lib/ailock/shared';
import { SKILL_TREE, BRANCH_COLORS } from '@/lib/ailock/skills';
import AilockAvatar from './AilockAvatar';
import CharacteristicsPanel from './CharacteristicsPanel';
import SkillTreeCanvas from './SkillTreeCanvas';
import { ArrowLeft, Star, Zap, Trophy, TrendingUp, CheckCircle, Clock, Award, Brain, Sparkles, Crown, Target, Cpu, Search, BrainCircuit } from 'lucide-react';

export default function MyAilockPage() {
  const { currentUser } = useUserSession();
  const [profile, setProfile] = useState<FullAilockProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'skills' | 'achievements'>('overview');
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser.id && currentUser.id !== 'loading') {
      loadProfile();
    }
  }, [currentUser.id]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const ailockProfile = await ailockApi.getProfile(currentUser.id);
      setProfile(ailockProfile);
    } catch (err) {
      console.error('Failed to load Ailock profile:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
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
    } catch (err) {
      console.error('Failed to upgrade skill:', err);
      // Optionally show a toast notification for the error
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-gradient-to-br from-slate-900/95 to-slate-800/95">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/60 text-lg">Loading your Ailock...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-gradient-to-br from-slate-900/95 to-slate-800/95">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-400 text-2xl">⚠️</span>
          </div>
          <h2 className="text-white text-xl font-semibold mb-2">Failed to Load Ailock</h2>
          <p className="text-white/60 mb-6">{error}</p>
          <button 
            onClick={loadProfile} 
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  if (!profile) {
    return null;
  }

  const levelInfo = getLevelInfo(profile.xp);
  
  const getAvatarGradient = () => {
    if (profile.level >= 15) return 'from-purple-400 via-pink-400 to-yellow-400';
    if (profile.level >= 10) return 'from-blue-400 via-purple-400 to-pink-400';
    if (profile.level >= 5) return 'from-green-400 via-blue-400 to-purple-400';
    return 'from-cyan-400 via-blue-400 to-indigo-400';
  };

  // Daily tasks based on XP event types
  const dailyTasks = [
    { id: 1, text: 'Analyze market trends', completed: false, xp: 50 },
    { id: 2, text: 'Process user queries', completed: false, xp: 100 },
    { id: 3, text: 'Generate insights', completed: false, xp: 75 }
  ];

  // Premium tasks based on skill tree
  const premiumTasks = [
    {
      id: 1, 
      title: 'Master advanced algorithms',
      description: 'Unlock neural network optimization',
      xp: 500,
      hours: 2,
      pro: true
    },
    {
      id: 2, 
      title: 'Master advanced algorithms',
      description: 'Unlock neural network optimization',
      xp: 400,
      hours: 10,
      pro: true
    },
    {
      id: 3, 
      title: 'Master advanced algorithms',
      description: 'Unlock neural network optimization',
      xp: 600,
      hours: 15,
      pro: true
    }
  ];

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-900/95 to-slate-800/95 p-6">
      {/* Back Button */}
      <div className="mb-6">
        <a 
          href="/" 
          className="inline-flex items-center space-x-2 text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to App</span>
        </a>
      </div>

      {/* Page Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Ailock Assistant Profile</h1>
        <p className="text-white/60">Quick Status</p>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Row 1: Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              <div className="relative">
                <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${getAvatarGradient()} p-1`}>
                  <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center relative overflow-hidden">
                    <img 
                      src="/images/ailock-character.png" 
                      alt="Ailock Avatar" 
                      className="w-24 h-24 object-contain animate-breathe"
                      style={{border: 'none', outline: 'none'}}
                    />
                  </div>
                </div>
                <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full px-3 py-1 flex items-center space-x-1 shadow-lg border-2 border-slate-800">
                  <Star className="w-4 h-4 text-white" />
                  <span className="text-white text-sm font-bold">{profile.level}</span>
                </div>
              </div>
            </div>
            <div className="w-full">
              <h2 className="text-xl font-bold text-white mb-2 text-center sm:text-left">{profile.name}</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-white/80">Level {profile.level}</span>
                  <span className="text-white/80">{profile.xp} / {levelInfo.totalXpForCurrentLevel + levelInfo.xpNeededForNextLevel} XP</span>
                </div>
                <div className="w-full bg-white/10 rounded-lg h-3 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                    style={{ width: `${levelInfo.progressPercentage}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-sm text-white/60">
                  <span>{levelInfo.progressXp} / {levelInfo.xpNeededForNextLevel} XP</span>
                  <span>{levelInfo.level < 20 ? `${levelInfo.xpToNextLevel} XP to next level` : 'Max Level'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex items-center justify-center">
            <div className="flex items-center space-x-6">
              <div className="w-20 h-20 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                <BrainCircuit className="w-10 h-10 text-blue-300" />
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-white text-center">Basic skill</h3>
                <p className="text-2xl text-white">Semantic search</p>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Stats, Achievements, Tasks */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Performance Stats */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Performance Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                <div className="text-4xl font-bold text-blue-400">{profile.xp}</div>
                <div className="text-white/60 text-base">Total XP</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                <div className="text-4xl font-bold text-purple-400">{profile.recentXpHistory.length}</div>
                <div className="text-white/60 text-base">Tasks Completed</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                <div className="text-4xl font-bold text-emerald-400">94%</div>
                <div className="text-white/60 text-base">Success Rate</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                <div className="text-4xl font-bold text-amber-400">23</div>
                <div className="text-white/60 text-base">Days Active</div>
              </div>
            </div>
          </div>

          {/* Recent Achievements */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Recent Achievements</h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 text-center">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-2"><Target className="w-6 h-6 text-purple-400" /></div>
                  <div className="text-white font-semibold text-base mb-1">Expert Matcher</div>
                  <div className="text-white/60 text-sm">95%+ accuracy</div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2"><Search className="w-6 h-6 text-blue-400" /></div>
                  <div className="text-white font-semibold text-base mb-1">Research Master</div>
                  <div className="text-white/60 text-sm">100+ searches</div>
                </div>
                {/* <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                  <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2"><Sparkles className="w-6 h-6 text-green-400" /></div>
                  <div className="text-white font-semibold text-base mb-1">Speed Demon</div>
                  <div className="text-white/60 text-sm">Quick responses</div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-center">
                  <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-2"><Star className="w-6 h-6 text-amber-400" /></div>
                  <div className="text-white font-semibold text-base mb-1">Rising Star</div>
                  <div className="text-white/60 text-sm">Level 1 reached</div>
                </div> */}
            </div>
          </div>
          
          {/* Today's Tasks */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Today's Task</h3>
            <div className="space-y-2">
              {dailyTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <input type="checkbox" checked={task.completed} onChange={() => {}} className="w-5 h-5 text-blue-500 bg-transparent border-white/30 rounded focus:ring-blue-500" />
                    <span className={`text-base ${task.completed ? 'text-white/60 line-through' : 'text-white/80'}`}>{task.text}</span>
                  </div>
                  <span className="text-emerald-400 text-base font-medium">{task.xp} XP</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Premium */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-amber-200 mb-4">Premium Growth Accelerators</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-2"><Zap className="w-5 h-5 text-amber-400" /></div>
                <div className="text-white font-medium text-sm mb-1">Turbo Learning</div>
                <div className="text-white/60 text-xs mb-1">Learn 3x faster</div>
                <div className="text-green-400 text-xs font-bold">+200% XP</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2"><Brain className="w-5 h-5 text-blue-400" /></div>
                <div className="text-white font-medium text-sm mb-1">Advanced Insights</div>
                <div className="text-white/60 text-xs mb-1">Deeper analysis</div>
                <div className="text-green-400 text-xs font-bold">+150% accuracy</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-2"><Trophy className="w-5 h-5 text-purple-400" /></div>
                <div className="text-white font-medium text-sm mb-1">Bonus Tasks</div>
                <div className="text-white/60 text-xs mb-1">Exclusive challenges</div>
                <div className="text-green-400 text-xs font-bold">+500 XP/day</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-2"><Crown className="w-5 h-5 text-indigo-400" /></div>
                <div className="text-white font-medium text-sm mb-1">AI Mentor</div>
                <div className="text-white/60 text-xs mb-1">Personal guidance</div>
                <div className="text-green-400 text-xs font-bold">Custom path</div>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-3 bg-white/5 border border-white/10 rounded-xl flex overflow-hidden">
            <div className="p-6 flex-grow">
              <h3 className="text-lg font-semibold text-amber-200 mb-4">Premium Tasks Available</h3>
              <div className="space-y-3">
                {premiumTasks.map((task) => (
                  <div key={task.id} className="p-3 bg-white/5 border border-white/10 rounded-lg flex items-start">
                    <input type="checkbox" className="w-4 h-4 text-amber-500 bg-transparent border-white/30 rounded focus:ring-amber-500 mt-1" />
                    <div className="ml-3 flex-grow">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-white font-medium text-sm">{task.title}</span>
                          {task.pro && <span className="ml-2 px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded border border-yellow-500/30">PRO</span>}
                        </div>
                        <span className="text-emerald-400 font-medium text-sm whitespace-nowrap">+{task.xp} XP</span>
                      </div>
                      <p className="text-white/60 text-xs mb-1">{task.description}</p>
                      <div className="text-left text-xs text-white/40">{task.hours} hours</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-l border-amber-500/30 bg-gradient-to-b from-amber-500/[.07] to-yellow-500/[.07] p-4 flex flex-col items-center justify-center min-w-[150px]">
              <h3 className="font-semibold text-amber-300 text-center">Upgraded to PRO -</h3>
              <p className="text-white/80 text-center text-sm">50% faster growth</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}