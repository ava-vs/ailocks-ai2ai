import { useState } from 'react';
import { Home, Search, Star, User, Menu, X, MessageSquare, Target } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { appState, toggleMobileMenu } from '@/lib/store';
import MobileIntentPanel from './MobileIntentPanel';

export default function MobileNavBar() {
  const { isMobileMenuOpen } = useStore(appState);
  const [showIntents, setShowIntents] = useState(false);

  const toggleIntents = () => {
    setShowIntents(!showIntents);
  };

  return (
    <>
      {/* Fixed bottom navigation bar */}
      <div className="fixed bottom-0 left-0 right-0 h-12 bg-slate-900/95 backdrop-blur-lg border-t border-white/10 z-40 flex items-center justify-around px-2">
        <NavItem href="/" icon={Home} label="Home" />
        <NavItem href="/query-history" icon={Search} label="History" />
        <NavItem href="/saved-intents" icon={Star} label="Saved" />
        <NavItem href="/my-ailock" icon={User} label="Ailock" />
        <button 
          onClick={toggleIntents}
          className="flex flex-col items-center justify-center w-16 h-full text-white/60 hover:text-white transition-colors relative"
        >
          <Target className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Intents</span>
          {/* Notification indicator */}
          <span className="absolute top-1 right-3 w-2 h-2 bg-blue-500 rounded-full"></span>
        </button>
      </div>

      {/* Mobile Intent Panel (slides up from bottom) */}
      <MobileIntentPanel isOpen={showIntents} onClose={() => setShowIntents(false)} />
    </>
  );
}

function NavItem({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  const isActive = typeof window !== 'undefined' && window.location.pathname === href;
  
  return (
    <a 
      href={href}
      className={`flex flex-col items-center justify-center w-16 h-full ${
        isActive ? 'text-blue-400' : 'text-white/60 hover:text-white'
      } transition-colors`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] mt-0.5">{label}</span>
    </a>
  );
}