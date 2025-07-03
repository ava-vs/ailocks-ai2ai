import { useState } from 'react';
import { X, Trophy, Zap, Star, TrendingUp } from 'lucide-react';
import AilockAvatar from './AilockAvatar';
import CharacteristicsPanel from './CharacteristicsPanel';
import SkillTreeCanvas from './SkillTreeCanvas';
import { SKILL_TREE, getSkillEffect } from '@/lib/ailock/skills';
import { getLevelInfo } from '@/lib/ailock/shared';
import type { FullAilockProfile, AilockSkill, AilockAchievement, XpEvent } from '@/lib/ailock/shared';

interface AilockDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  profile: FullAilockProfile | null;
  onSkillUpgrade: (skillId: string) => Promise<void>;
}

export default function AilockDashboard({ isOpen, onClose, profile, onSkillUpgrade }: AilockDashboardProps) {
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'skills' | 'achievements'>('overview');

  if (!isOpen || !profile) return null;

  const levelInfo = getLevelInfo(profile.xp);

  const handleSkillUpgrade = async (skillId: string) => {
    try {
      await onSkillUpgrade(skillId);
      // Notify other components about profile update
      window.dispatchEvent(new CustomEvent('ailock-profile-updated'));
    } catch (error) {
      console.error('Failed to upgrade skill:', error);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      
      {/* Dashboard Modal */}
      <div className="fixed top-4 bottom-20 left-4 right-4 md:left-20 md:right-20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center space-x-4">
            <AilockAvatar 
              level={profile.level}
              characteristics={profile.characteristics}
              size="medium"
            />
            <div>
              <h1 className="text-2xl font-bold text-white">{profile.name}</h1>
              <p className="text-white/60">Level {profile.level} AI Companion</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white/60 hover:text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'skills', label: 'Skills', icon: Zap },
            { id: 'achievements', label: 'Achievements', icon: Trophy }
          ].map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-6 py-4 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-500/20 text-blue-400 border-b-2 border-blue-400'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <IconComponent className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {activeTab === 'overview' && (
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-6">
                {/* XP Progress */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Experience Progress</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-white/80">Level {profile.level}</span>
                      <span className="text-white/80">{profile.xp} XP</span>
                    </div>
                    
                    <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                        style={{ width: `${levelInfo.progressPercentage}%` }}
                      ></div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-white/60">
                      <span>{levelInfo.progressXp} / {levelInfo.xpNeededForNextLevel} XP</span>
                      <span>{levelInfo.level < 20 ? `${levelInfo.xpToNextLevel} XP to next level` : 'Max Level'}</span>
                    </div>
                  </div>
                  
                  {profile.skillPoints > 0 && (
                    <div className="mt-4 p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Star className="w-4 h-4 text-amber-400" />
                        <span className="text-amber-400 font-medium">
                          {profile.skillPoints} skill point{profile.skillPoints !== 1 ? 's' : ''} available!
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Recent Activity */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
                  
                  <div className="space-y-3">
                    {profile.recentXpHistory.slice(0, 5).map((event: XpEvent) => (
                      <div key={event.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <div>
                          <p className="text-white text-sm font-medium">
                            {event.eventType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </p>
                          <p className="text-white/60 text-xs">
                            {new Date(event.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-emerald-400 font-medium">
                          +{event.xpGained} XP
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Characteristics */}
                <CharacteristicsPanel characteristics={profile.characteristics} />
                
                {/* Stats */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Statistics</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400">{profile.totalInteractions}</div>
                      <div className="text-white/60 text-sm">Total Interactions</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-400">{profile.skills.length}</div>
                      <div className="text-white/60 text-sm">Skills Unlocked</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-400">{profile.achievements.length}</div>
                      <div className="text-white/60 text-sm">Achievements</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-400">{profile.level}</div>
                      <div className="text-white/60 text-sm">Current Level</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'skills' && (
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Skill Tree */}
              <div className="lg:col-span-2">
                <SkillTreeCanvas
                  skills={profile.skills}
                  skillPoints={profile.skillPoints}
                  onSkillUpgrade={handleSkillUpgrade}
                  onSkillHover={setHoveredSkill}
                />
              </div>
              
              {/* Skill Details */}
              <div className="space-y-6">
                {hoveredSkill && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Skill Details</h3>
                    
                    {(() => {
                      const skillDef = SKILL_TREE[hoveredSkill];
                      const userSkill = profile.skills.find((s: AilockSkill) => s.skillId === hoveredSkill);
                      
                      if (!skillDef) return null;
                      
                      return (
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-white font-medium">{skillDef.name}</h4>
                            <p className="text-white/60 text-sm">{skillDef.description}</p>
                          </div>
                          
                          <div>
                            <span className="text-white/80 text-sm">Branch: </span>
                            <span className="text-blue-400 text-sm capitalize">{skillDef.branch}</span>
                          </div>
                          
                          <div>
                            <span className="text-white/80 text-sm">Level: </span>
                            <span className="text-white text-sm">
                              {userSkill?.currentLevel || 0} / {skillDef.maxLevel}
                            </span>
                          </div>
                          
                          <div>
                            <h5 className="text-white/80 text-sm mb-2">Current Effect:</h5>
                            <p className="text-white/60 text-sm">
                              {getSkillEffect(hoveredSkill, userSkill?.currentLevel || 1)}
                            </p>
                          </div>
                          
                          {userSkill && userSkill.currentLevel < skillDef.maxLevel && (
                            <div>
                              <h5 className="text-white/80 text-sm mb-2">Next Level:</h5>
                              <p className="text-emerald-400 text-sm">
                                {getSkillEffect(hoveredSkill, userSkill.currentLevel + 1)}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
                
                {/* Unlocked Skills List */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Unlocked Skills</h3>
                  
                  <div className="space-y-3">
                    {profile.skills.filter((s: AilockSkill) => s.currentLevel > 0).map((skill: AilockSkill) => (
                      <div key={skill.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <div>
                          <p className="text-white text-sm font-medium">{skill.skillName}</p>
                          <p className="text-white/60 text-xs capitalize">{skill.branch} • Level {skill.currentLevel}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-white/60 text-xs">Used {skill.usageCount} times</div>
                          <div className="text-emerald-400 text-xs">{Math.round(skill.successRate * 100)}% success</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'achievements' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {profile.achievements.map((achievement: AilockAchievement) => (
                <div 
                  key={achievement.id}
                  className={`bg-white/5 border rounded-xl p-6 ${
                    achievement.rarity === 'legendary' ? 'border-yellow-500/50 bg-yellow-500/10' :
                    achievement.rarity === 'epic' ? 'border-purple-500/50 bg-purple-500/10' :
                    achievement.rarity === 'rare' ? 'border-blue-500/50 bg-blue-500/10' :
                    'border-white/10'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-3">{achievement.icon}</div>
                    <h3 className="text-white font-semibold mb-2">{achievement.achievementName}</h3>
                    <p className="text-white/60 text-sm mb-3">{achievement.achievementDescription}</p>
                    <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      achievement.rarity === 'legendary' ? 'bg-yellow-500/20 text-yellow-400' :
                      achievement.rarity === 'epic' ? 'bg-purple-500/20 text-purple-400' :
                      achievement.rarity === 'rare' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {achievement.rarity.toUpperCase()}
                    </div>
                    <div className="text-white/40 text-xs mt-2">
                      {new Date(achievement.unlockedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
              
              {profile.achievements.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <Trophy className="w-16 h-16 text-white/20 mx-auto mb-4" />
                  <p className="text-white/60">No achievements unlocked yet</p>
                  <p className="text-white/40 text-sm">Keep using your Ailock to earn achievements!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
