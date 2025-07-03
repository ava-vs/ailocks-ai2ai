import { Zap, Star, Crown } from 'lucide-react';

interface AilockAvatarProps {
  level: number;
  characteristics: {
    velocity: number;
    insight: number;
    efficiency: number;
    economy: number;
    convenience: number;
  };
  size?: 'small' | 'medium' | 'large';
  showLevel?: boolean;
  animated?: boolean;
}

export default function AilockAvatar({ 
  level, 
  characteristics, 
  size = 'medium',
  showLevel = true,
  animated = true 
}: AilockAvatarProps) {
  const sizeClasses = {
    small: 'w-12 h-12',
    medium: 'w-20 h-20',
    large: 'w-32 h-32'
  };

  const getAvatarGradient = () => {
    const avgCharacteristic = Object.values(characteristics).reduce((a, b) => a + b, 0) / 5;
    
    if (avgCharacteristic >= 80) {
      return 'from-purple-400 via-pink-400 to-red-400';
    } else if (avgCharacteristic >= 60) {
      return 'from-blue-400 via-purple-400 to-pink-400';
    } else if (avgCharacteristic >= 40) {
      return 'from-cyan-400 via-blue-400 to-purple-400';
    } else {
      return 'from-gray-400 via-blue-400 to-cyan-400';
    }
  };

  const getGlowIntensity = () => {
    const avgCharacteristic = Object.values(characteristics).reduce((a, b) => a + b, 0) / 5;
    return Math.max(0.3, avgCharacteristic / 100);
  };

  const getLevelIcon = () => {
    if (level >= 20) return <Crown className="w-4 h-4 text-yellow-400" />;
    if (level >= 10) return <Star className="w-4 h-4 text-purple-400" />;
    return <Zap className="w-4 h-4 text-blue-400" />;
  };

  return (
    <div className="relative">
      {/* Main Avatar */}
      <div 
        className={`${sizeClasses[size]} relative rounded-full bg-gradient-to-br ${getAvatarGradient()} p-1 ${animated ? 'transition-all duration-300' : ''}`}
        style={{
          boxShadow: `0 0 ${20 * getGlowIntensity()}px rgba(59, 130, 246, ${getGlowIntensity()})`
        }}
      >
        <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center relative overflow-hidden">
          {/* Avatar Content */}
          <img 
            src="/images/ailock-character.png" 
            alt="Ailock Avatar" 
            className={`${size === 'large' ? 'w-24 h-24' : size === 'medium' ? 'w-12 h-12' : 'w-8 h-8'} object-contain ${animated ? 'animate-breathe' : ''}`}
          />
          
          {/* Particle Effects for High Level */}
          {level >= 15 && animated && (
            <div className="absolute inset-0 rounded-full">
              <div className="absolute top-2 left-2 w-1 h-1 bg-yellow-400 rounded-full animate-ping"></div>
              <div className="absolute top-4 right-3 w-1 h-1 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
              <div className="absolute bottom-3 left-4 w-1 h-1 bg-cyan-400 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
            </div>
          )}
        </div>
      </div>

      {/* Level Badge */}
      {showLevel && (
        <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full px-2 py-1 flex items-center space-x-1 shadow-lg border-2 border-slate-800">
          {getLevelIcon()}
          <span className="text-white text-xs font-bold">{level}</span>
        </div>
      )}

      {/* Characteristic Indicators */}
      {size === 'large' && (
        <div className="absolute -inset-4">
          {/* Velocity */}
          <div 
            className="absolute top-0 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-red-400 rounded-full"
            style={{ opacity: characteristics.velocity / 100 }}
          ></div>
          {/* Insight */}
          <div 
            className="absolute top-1/2 right-0 transform -translate-y-1/2 w-2 h-2 bg-purple-400 rounded-full"
            style={{ opacity: characteristics.insight / 100 }}
          ></div>
          {/* Efficiency */}
          <div 
            className="absolute bottom-0 right-1/4 w-2 h-2 bg-orange-400 rounded-full"
            style={{ opacity: characteristics.efficiency / 100 }}
          ></div>
          {/* Economy */}
          <div 
            className="absolute bottom-0 left-1/4 w-2 h-2 bg-green-400 rounded-full"
            style={{ opacity: characteristics.economy / 100 }}
          ></div>
          {/* Convenience */}
          <div 
            className="absolute top-1/2 left-0 transform -translate-y-1/2 w-2 h-2 bg-cyan-400 rounded-full"
            style={{ opacity: characteristics.convenience / 100 }}
          ></div>
        </div>
      )}
    </div>
  );
}
