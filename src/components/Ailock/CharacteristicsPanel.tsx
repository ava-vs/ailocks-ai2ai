import { Zap, Eye, Cog, DollarSign, Sparkles } from 'lucide-react';

interface CharacteristicsPanelProps {
  characteristics: {
    velocity: number;
    insight: number;
    efficiency: number;
    economy: number;
    convenience: number;
  };
  showValues?: boolean;
}

export default function CharacteristicsPanel({ characteristics, showValues = true }: CharacteristicsPanelProps) {
  const characteristicData = [
    {
      key: 'velocity',
      name: 'Velocity',
      description: 'Processing speed and response time',
      icon: Zap,
      color: 'from-red-500 to-orange-500',
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-500/30',
      value: characteristics.velocity
    },
    {
      key: 'insight',
      name: 'Insight',
      description: 'Analysis quality and depth',
      icon: Eye,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-500/30',
      value: characteristics.insight
    },
    {
      key: 'efficiency',
      name: 'Efficiency',
      description: 'Task decomposition and optimization',
      icon: Cog,
      color: 'from-orange-500 to-yellow-500',
      bgColor: 'bg-orange-500/20',
      borderColor: 'border-orange-500/30',
      value: characteristics.efficiency
    },
    {
      key: 'economy',
      name: 'Economy',
      description: 'Cost optimization and resource management',
      icon: DollarSign,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/30',
      value: characteristics.economy
    },
    {
      key: 'convenience',
      name: 'Convenience',
      description: 'Output format variety and usability',
      icon: Sparkles,
      color: 'from-cyan-500 to-blue-500',
      bgColor: 'bg-cyan-500/20',
      borderColor: 'border-cyan-500/30',
      value: characteristics.convenience
    }
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white mb-4">Core Characteristics</h3>
      
      <div className="grid gap-4">
        {characteristicData.map((char) => {
          const IconComponent = char.icon;
          const percentage = Math.min(char.value, 100);
          
          return (
            <div 
              key={char.key}
              className={`${char.bgColor} ${char.borderColor} border rounded-xl p-4 transition-all hover:scale-105`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 bg-gradient-to-r ${char.color} rounded-lg flex items-center justify-center`}>
                    <IconComponent className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{char.name}</h4>
                    <p className="text-white/60 text-xs">{char.description}</p>
                  </div>
                </div>
                {showValues && (
                  <div className="text-right">
                    <div className="text-white font-bold">{char.value}</div>
                    <div className="text-white/60 text-xs">/ 100</div>
                  </div>
                )}
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r ${char.color} transition-all duration-500 ease-out`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
              
              {/* Level Indicator */}
              <div className="flex justify-between text-xs text-white/40 mt-2">
                <span>Novice</span>
                <span>Expert</span>
                <span>Master</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
