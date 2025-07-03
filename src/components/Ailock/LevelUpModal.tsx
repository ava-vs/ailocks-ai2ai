import { useEffect, useState } from 'react';
import { Star, Zap, Crown, X, Search, Brain, Eye } from 'lucide-react';

interface LevelUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  newLevel: number;
  skillPointsGained: number;
  xpGained: number;
  newSkillUnlocked?: {
    id: string;
    name: string;
    description: string;
    branch: string;
  } | null;
}

export default function LevelUpModal({ 
  isOpen, 
  onClose, 
  newLevel, 
  skillPointsGained, 
  xpGained,
  newSkillUnlocked = null
}: LevelUpModalProps) {
  const [showParticles, setShowParticles] = useState(false);
  const [showSkillAnimation, setShowSkillAnimation] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowParticles(true);
      const timer = setTimeout(() => setShowParticles(false), 3000);
      
      // Show skill animation slightly later
      if (newSkillUnlocked) {
        const skillTimer = setTimeout(() => setShowSkillAnimation(true), 1000);
        return () => {
          clearTimeout(timer);
          clearTimeout(skillTimer);
        };
      }
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, newSkillUnlocked]);

  if (!isOpen) return null;

  const getLevelIcon = () => {
    if (newLevel >= 20) return <Crown className="w-12 h-12 text-yellow-400" />;
    if (newLevel >= 10) return <Star className="w-12 h-12 text-purple-400" />;
    return <Zap className="w-12 h-12 text-blue-400" />;
  };

  const getLevelTitle = () => {
    if (newLevel >= 20) return 'Legendary Ailock!';
    if (newLevel >= 15) return 'Master Level!';
    if (newLevel >= 10) return 'Expert Level!';
    if (newLevel >= 5) return 'Advanced Level!';
    return 'Level Up!';
  };

  const getSkillIcon = (skillId: string) => {
    switch (skillId) {
      case 'semantic_search':
        return <Search className="w-8 h-8 text-blue-400" />;
      case 'deep_research':
        return <Brain className="w-8 h-8 text-purple-400" />;
      case 'proactive_analysis':
        return <Eye className="w-8 h-8 text-green-400" />;
      default:
        return <Star className="w-8 h-8 text-yellow-400" />;
    }
  };

  const getBranchColor = (branch: string) => {
    switch (branch) {
      case 'research':
        return 'from-blue-500/20 to-cyan-500/20 border-blue-500/30';
      case 'collaboration':
        return 'from-green-500/20 to-emerald-500/20 border-green-500/30';
      case 'efficiency':
        return 'from-amber-500/20 to-orange-500/20 border-amber-500/30';
      case 'convenience':
        return 'from-purple-500/20 to-pink-500/20 border-purple-500/30';
      default:
        return 'from-blue-500/20 to-purple-500/20 border-blue-500/30';
    }
  };

  // Determine which skill is unlocked at a specific level
  const getSkillForLevel = (level: number) => {
    if (level === 2) {
      return {
        id: 'semantic_search',
        name: 'Semantic Search',
        description: 'Improves relevance and accuracy of all searches by understanding context.',
        branch: 'research'
      };
    }
    return null;
  };

  // If no new skill is passed, but the level is appropriate - automatically determine
  const skillToShow = newSkillUnlocked || getSkillForLevel(newLevel);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
        {/* Particles */}
        {showParticles && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-ping"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1 + Math.random()}s`
                }}
              />
            ))}
          </div>
        )}

        {/* Modal */}
        <div className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 max-w-xl w-full mx-4 relative max-h-[90vh] overflow-y-auto">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>

          {/* Content */}
          <div className="text-center">
            {/* Main Ailock Image with Level Up Effect */}
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <div className="w-32 h-32 relative">
                  {/* Ailock Character Image */}
                  <img 
                    src="/images/ailock-character.png" 
                    alt="Ailock Level Up"
                    className="w-full h-full object-contain drop-shadow-2xl animate-bounce"
                    style={{
                      filter: 'drop-shadow(0 0 30px rgba(74, 158, 255, 0.6))',
                    }}
                  />
                  
                  {/* Level Badge */}
                  <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full w-10 h-10 flex items-center justify-center shadow-lg border-2 border-white">
                    <span className="text-white text-sm font-bold">{newLevel}</span>
                  </div>
                  
                  {/* Glow Effect */}
                  {showParticles && (
                    <div className="absolute inset-0 animate-pulse">
                      <div className="w-full h-full rounded-full bg-gradient-to-r from-yellow-400/30 to-purple-400/30 blur-xl"></div>
                    </div>
                  )}
                </div>
                
                {/* Level Icon */}
                <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
                  {getLevelIcon()}
                </div>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-3xl font-bold text-white mb-2">{getLevelTitle()}</h2>
            <p className="text-white/60 mb-6">Your Ailock has reached level {newLevel}!</p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4">
                <div className="text-2xl font-bold text-blue-400 mb-1">+{xpGained} XP</div>
                <div className="text-white/60 text-sm">Experience Gained</div>
              </div>

              <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl p-4">
                <div className="text-2xl font-bold text-amber-400 mb-1">+{skillPointsGained}</div>
                <div className="text-white/60 text-sm">Skill Point{skillPointsGained !== 1 ? 's' : ''}</div>
              </div>
            </div>

            {/* New Skill Unlocked */}
            {skillToShow && (
              <div className={`bg-gradient-to-r ${getBranchColor(skillToShow.branch)} border rounded-xl p-4 mb-6 ${
                showSkillAnimation ? 'animate-in slide-in-from-bottom-4 duration-500' : 'opacity-0'
              }`}>
                {/* Skill Title */}
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold text-white mb-1">🎉 New Skill!</h3>
                  <p className="text-yellow-400 font-semibold text-lg">{skillToShow.name}</p>
                </div>
                
                {/* Large Skill Image */}
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    {skillToShow.id === 'semantic_search' ? (
                      <img 
                        src="/images/Ailock_s_search.png" 
                        alt="Semantic Search Skill"
                        className="w-48 h-48 object-contain rounded-xl shadow-2xl"
                        style={{
                          filter: 'drop-shadow(0 0 20px rgba(59, 130, 246, 0.5))',
                        }}
                      />
                    ) : (
                      <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-xl">
                        {getSkillIcon(skillToShow.id)}
                      </div>
                    )}
                    
                    {/* Sparkle animation */}
                    {showSkillAnimation && (
                      <>
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full animate-ping"></div>
                        <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-blue-400 rounded-full animate-ping" style={{animationDelay: '0.5s'}}></div>
                      </>
                    )}
                  </div>
                </div>
                
                <p className="text-white/90 text-sm leading-relaxed text-center mb-4">
                  {skillToShow.description}
                </p>
                
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-xs text-white/60">Branch:</span>
                  <span className="text-xs bg-white/10 px-3 py-1 rounded-full text-white/80 capitalize">
                    {skillToShow.branch === 'research' ? 'Research' : skillToShow.branch}
                  </span>
                </div>
              </div>
            )}

            {/* Level Milestone */}
            {newLevel % 5 === 0 && (
              <div className="bg-purple-500/20 border border-purple-500/30 rounded-xl p-4 mb-6">
                <div className="text-purple-400 font-medium mb-2">🎉 Milestone Reached!</div>
                <div className="text-white/60 text-sm">
                  {newLevel === 5 && 'Your Ailock is becoming more capable!'}
                  {newLevel === 10 && 'Your Ailock has reached expert level!'}
                  {newLevel === 15 && 'Your Ailock is now a master collaborator!'}
                  {newLevel === 20 && 'Your Ailock has achieved legendary status!'}
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 rounded-xl transition-all shadow-lg hover:shadow-xl font-medium"
            >
              Continue
            </button>

            {/* Tip */}
            <p className="text-white/40 text-xs mt-4">
              Use your skill points to unlock new abilities in the skill tree!
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
