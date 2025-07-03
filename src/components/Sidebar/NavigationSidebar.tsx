import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Search, Star, Clock, User, Home, LogOut } from 'lucide-react';
import CollapsibleSidebar from './CollapsibleSidebar';

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  isExpanded: boolean;
  isActive?: boolean;
}

const NavLink = ({ href, children, isExpanded, isActive = false }: NavLinkProps) => {
  return (
    <a
      href={href}
      className={cn(
        "flex items-center w-full h-12 rounded-lg transition-all duration-200 group relative",
        isActive 
          ? "bg-blue-500/20 text-white" 
          : "text-white/60 hover:bg-white/5 hover:text-white",
        !isExpanded && "justify-center"
      )}
    >
      <div className={cn(
        "flex items-center",
        isExpanded ? "px-4 gap-3" : "justify-center w-full"
      )}>
        {children}
      </div>
    </a>
  );
};

interface NavigationSidebarProps {
  isExpanded?: boolean;
}

function NavigationSidebar({ isExpanded = false }: NavigationSidebarProps) {
  const [pathname, setPathname] = useState('');

  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  const handleSignOut = () => {
    console.log("Signing out...");
  };

  return (
    <div className="flex flex-col h-full p-2 text-white">
      <nav className="flex-grow space-y-2">
        {/* CRITICAL FIX 3: Menu Icons - Light Gradients */}
        <NavLink href="/" isExpanded={isExpanded} isActive={pathname === '/'}>
          <Home className="w-5 h-5 sidebar-icon" />
          {isExpanded && <span className="font-medium whitespace-nowrap">Home</span>}
        </NavLink>

        <NavLink href="/query-history" isExpanded={isExpanded} isActive={pathname === '/query-history'}>
          <Search className="w-5 h-5 sidebar-icon" />
          {isExpanded && <span className="font-medium whitespace-nowrap">Query History</span>}
        </NavLink>

        <NavLink href="/saved-intents" isExpanded={isExpanded} isActive={pathname === '/saved-intents'}>
          <Star className="w-5 h-5 sidebar-icon" />
          {isExpanded && <span className="font-medium whitespace-nowrap">Starred</span>}
        </NavLink>

        <NavLink href="/recent" isExpanded={isExpanded} isActive={pathname === '/recent'}>
          <Clock className="w-5 h-5 sidebar-icon" />
          {isExpanded && <span className="font-medium whitespace-nowrap">Recent</span>}
        </NavLink>

        <NavLink href="/my-ailock" isExpanded={isExpanded} isActive={pathname === '/my-ailock'}>
          <User className="w-5 h-5 sidebar-icon" />
          {isExpanded && <span className="font-medium whitespace-nowrap">My Ailock</span>}
        </NavLink>

        {/* Recent Items */}
        {isExpanded && (
          <div className="pt-4 space-y-1">
            <div className="px-4 text-xs font-medium text-white/40 uppercase tracking-wider">Recent</div>
            <div className="space-y-1">
              <div className="flex items-center px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                <span className="truncate">My move to Rio de Janeiro</span>
              </div>
              <div className="flex items-center px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                <span className="truncate">Setting up in Rio: apartment, community, work</span>
              </div>
            </div>
          </div>
        )}
      </nav>

      <div className="mt-auto">
        <button
          onClick={handleSignOut}
          className={cn(
            "flex items-center w-full h-12 rounded-lg transition-colors duration-200 text-white/60 hover:bg-white/5 hover:text-white",
            !isExpanded && "justify-center"
          )}
        >
          <div className={cn(
            "flex items-center",
            isExpanded ? "px-4 gap-3" : "justify-center w-full"
          )}>
            <LogOut className="w-5 h-5 sidebar-icon" />
            {isExpanded && <span className="font-medium">Logout</span>}
          </div>
        </button>
      </div>
    </div>
  );
}

export default function CollapsibleNavigationSidebar() {
  return (
    <CollapsibleSidebar side="left">
      <NavigationSidebar />
    </CollapsibleSidebar>
  );
}