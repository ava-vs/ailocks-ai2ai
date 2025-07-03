import { MapPin, TrendingUp, BookOpen, Globe, Users, Lightbulb, Target, Search, HelpCircle } from 'lucide-react';

interface ContextActionsProps {
  mode: string;
  language: string;
  onAction: (action: string) => void;
  lastMessage?: string;
}

export default function ContextActions({ mode, language, onAction, lastMessage = '' }: ContextActionsProps) {
  const getActionsForMode = (mode: string, language: string) => {
    const actions = {
      en: {
        researcher: [
          { id: 'search-nearby', label: 'Search Nearby', icon: MapPin, description: 'Find local insights' },
          { id: 'analyze-trends', label: 'Analyze Trends', icon: TrendingUp, description: 'Market analysis' },
          { id: 'find-sources', label: 'Find Sources', icon: BookOpen, description: 'Research data' }
        ],
        creator: [
          { id: 'brainstorm', label: 'Brainstorm Ideas', icon: Lightbulb, description: 'Creative thinking' },
          { id: 'find-collaborators', label: 'Find Collaborators', icon: Users, description: 'Connect creators' },
          { id: 'market-research', label: 'Market Research', icon: Globe, description: 'Audience insights' }
        ],
        analyst: [
          { id: 'deep-analysis', label: 'Deep Analysis', icon: TrendingUp, description: 'Strategic insights' },
          { id: 'competitive-intel', label: 'Competitive Intel', icon: Globe, description: 'Market position' },
          { id: 'risk-assessment', label: 'Risk Assessment', icon: BookOpen, description: 'Evaluate risks' }
        ]
      },
      ru: {
        researcher: [
          { id: 'search-nearby', label: 'Поиск рядом', icon: MapPin, description: 'Местные инсайты' },
          { id: 'analyze-trends', label: 'Анализ трендов', icon: TrendingUp, description: 'Анализ рынка' },
          { id: 'find-sources', label: 'Найти источники', icon: BookOpen, description: 'Данные исследований' }
        ],
        creator: [
          { id: 'brainstorm', label: 'Мозговой штурм', icon: Lightbulb, description: 'Творческое мышление' },
          { id: 'find-collaborators', label: 'Найти коллабораторов', icon: Users, description: 'Связать создателей' },
          { id: 'market-research', label: 'Исследование рынка', icon: Globe, description: 'Инсайты аудитории' }
        ],
        analyst: [
          { id: 'deep-analysis', label: 'Глубокий анализ', icon: TrendingUp, description: 'Стратегические инсайты' },
          { id: 'competitive-intel', label: 'Конкурентная разведка', icon: Globe, description: 'Позиция на рынке' },
          { id: 'risk-assessment', label: 'Оценка рисков', icon: BookOpen, description: 'Оценить риски' }
        ]
      }
    };

    return actions[language as keyof typeof actions]?.[mode as keyof typeof actions.en] || actions.en.researcher;
  };

  // Context-aware actions that appear based on conversation
  const getContextAwareActions = (language: string, lastMessage: string) => {
    const actions = [];
    const lowerMessage = lastMessage.toLowerCase();
    
    // Check if message could be an intent
    const intentKeywords = [
      'design', 'tour', 'collaboration', 'project', 'help', 'looking for', 'need',
      'seeking', 'require', 'want', 'build', 'create', 'develop', 'work on',
      'partner', 'team up', 'join', 'opportunity', 'freelance', 'contract'
    ];
    
    const hasIntentKeywords = intentKeywords.some(keyword => lowerMessage.includes(keyword));
    
    if (hasIntentKeywords && lastMessage.length > 20) {
      actions.push({
        id: 'create-intent',
        label: language === 'ru' ? 'Создать интент' : 'Create Intent',
        icon: Target,
        description: language === 'ru' ? 'Превратить в возможность сотрудничества' : 'Turn into collaboration opportunity'
      });
    }
    
    // Other context-aware actions
    if (lowerMessage.includes('similar') || lowerMessage.includes('like this') || 
        lowerMessage.includes('examples') || lowerMessage.includes('compare')) {
      actions.push({
        id: 'find-similar',
        label: language === 'ru' ? 'Найти похожие' : 'Find Similar',
        icon: Search,
        description: language === 'ru' ? 'Найти связанные проекты' : 'Discover related projects'
      });
    }
    
    if (lowerMessage.includes('unclear') || lowerMessage.includes('explain') || 
        lowerMessage.includes('more details') || lowerMessage.includes('clarify')) {
      actions.push({
        id: 'clarify-requirements',
        label: language === 'ru' ? 'Уточнить требования' : 'Clarify Requirements',
        icon: HelpCircle,
        description: language === 'ru' ? 'Получить больше деталей' : 'Get more details'
      });
    }

    return actions;
  };

  const modeActions = getActionsForMode(mode, language);
  const contextActions = getContextAwareActions(language, lastMessage);

  // Combine mode-specific and context-aware actions
  const allActions = [...modeActions, ...contextActions];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {allActions.map((action) => {
          const IconComponent = action.icon;
          const isContextAction = contextActions.some(ca => ca.id === action.id);
          const isCreateIntent = action.id === 'create-intent';
          
          return (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              className={`group flex flex-col items-center space-y-2 backdrop-blur-sm text-white/80 hover:text-white px-3 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 border shadow-lg hover:shadow-xl ${
                isCreateIntent
                  ? 'bg-gradient-to-br from-blue-500/30 to-indigo-600/30 hover:from-blue-500/40 hover:to-indigo-600/40 border-blue-400/50 hover:border-blue-400/70 ring-2 ring-blue-400/20'
                  : isContextAction 
                    ? 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30 hover:border-blue-500/50'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20'
              }`}
            >
              <IconComponent className={`w-5 h-5 group-hover:scale-110 transition-transform flex-shrink-0 ${
                isCreateIntent ? 'text-blue-300' :
                isContextAction ? 'text-blue-400' : 'text-purple-400'
              }`} />
              <div className="text-center">
                <div className={`font-medium text-xs leading-tight ${
                  isCreateIntent ? 'text-blue-200' : ''
                }`}>{action.label}</div>
                <div className="text-xs opacity-70 leading-tight mt-1">{action.description}</div>
              </div>
              {isCreateIntent && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}