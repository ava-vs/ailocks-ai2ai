import { Lock, Zap } from 'lucide-react';

interface HeaderProps {
  activeMode: string;
  onModeChange: (mode: string) => void;
  language: string;
  onLanguageChange: (lang: string) => void;
}

export default function Header({ activeMode, onModeChange, language, onLanguageChange }: HeaderProps) {
  const modes = [
    { id: 'researcher', label: '🔍 Researcher', description: 'Research & Analysis' },
    { id: 'creator', label: '🛠️ Creator', description: 'Create & Build' },
    { id: 'analyst', label: '📊 Analyst', description: 'Strategic Analysis' }
  ];

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm flex-shrink-0">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-xl text-gray-800">Ailocks</span>
            <div className="text-sm text-gray-500 font-medium">Ai2Ai Network</div>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center space-x-1 bg-gray-100 rounded-xl p-1.5">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeMode === mode.id
                  ? 'bg-white text-blue-600 shadow-md ring-1 ring-blue-100'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
              title={mode.description}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Right Section: Language + User Status */}
        <div className="flex items-center space-x-4">
          {/* Language Selector */}
          <select 
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="bg-gray-100 text-gray-700 text-sm rounded-lg px-3 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="en">🇺🇸 EN</option>
            <option value="ru">🇷🇺 RU</option>
          </select>

          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600 font-medium">Connected</span>
            <Zap className="w-4 h-4 text-yellow-500" />
          </div>

          {/* User Avatar */}
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-lg cursor-pointer hover:shadow-xl transition-shadow">
            AI
          </div>
        </div>
      </div>
    </header>
  );
}