import React, { useState, useEffect } from 'react';
import { Menu, ChevronDown, Zap, MapPin, Globe, Bell, LogOut, User, Users, Settings, Plus, LayoutGrid, Search, BarChart, FileText, Bot, LogIn } from 'lucide-react';
import { toggleMobileMenu } from '@/lib/store';
import { useUserSession } from '@/hooks/useUserSession';
import { useLocation } from '@/hooks/useLocation';
import UserHeaderInfo from './Header/UserHeaderInfo';
import AilockHeaderWidget from './Ailock/AilockHeaderWidget';
import AuthModal from './Auth/AuthModal';
import { useAuth } from '@/hooks/useAuth';

export default function Header() {
  const { currentUser, switchUser } = useUserSession();
  const { user: authUser, logout } = useAuth();
  const location = useLocation();
  const [isAilockDropdownOpen, setIsAilockDropdownOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const AilockDropdown = () => (
    <div className="absolute top-full left-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-4 z-20">
      {/* This is a simplified dropdown. In a real app, this would be dynamic */}
      <div className="flex items-center gap-3 mb-4">
        <img 
          src="/images/ailock-character.png" 
          alt="Ailock Avatar" 
          className="w-8 h-8 object-contain"
          style={{border: 'none', outline: 'none'}}
        />
        <div>
          <h3 className="text-white font-medium">Ailock Assistant</h3>
          <p className="text-sm text-gray-400">Quick Status</p>
        </div>
      </div>
      
      {/* Level Progress */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-white">Level Progress</span>
          <span className="bg-blue-500 px-2 py-1 rounded text-xs text-white">Level 1</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full" 
               style={{width: '81%'}}></div>
        </div>
        <p className="text-xs text-gray-400 mt-1">2,850 / 3,500 XP | 650 XP to next level</p>
      </div>
      
      {/* Tasks */}
      <div className="mb-4">
        <h4 className="text-white mb-2">Today's Task</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
            <div className="flex items-center gap-2">
              <span className="text-green-500">✅</span>
              <span className="text-sm text-white">Analyze market trends</span>
            </div>
            <span className="text-xs text-green-500">50 XP</span>
          </div>
          <div className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">⏳</span>
              <span className="text-sm text-white">Process user queries</span>
            </div>
            <span className="text-xs text-blue-400">100 XP</span>
          </div>
          <div className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">⏳</span>
              <span className="text-sm text-white">Generate insights</span>
            </div>
            <span className="text-xs text-blue-400">75 XP</span>
          </div>
        </div>
      </div>
      
      <div className="flex justify-between">
        <button className="px-3 py-1 bg-slate-700 rounded text-xs text-white">Close</button>
        <button className="px-3 py-1 bg-blue-500 rounded text-xs text-white">Full Profile</button>
      </div>
    </div>
  );

  return (
    <header className="fixed top-0 left-0 right-0 h-[60px] bg-slate-900/80 backdrop-blur-lg border-b border-white/10 z-30 flex items-center justify-between px-4">
      {/* Left section - Logo and Project Name */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <img 
            src="/images/ailock-logo.png" 
            alt="Ailocks Logo" 
            className="w-8 h-8 object-contain"
          />
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Ailocks</h1>
            <span className="text-sm text-white/60">Ai2Ai Network</span>
          </div>
        </div>
      </div>

      {/* Center section - Ailock Widget */}
      <div className="flex items-center">
        <AilockHeaderWidget />
      </div>

      {/* Right section - User Controls */}
      <div className="flex items-center gap-4">
        <UserHeaderInfo />
        
        {/* <button className="flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white text-sm transition-colors">
          <Plus className="w-4 h-4" />
          Upgrade
        </button> */}

        {/* <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <Bell className="w-5 h-5 text-white/80" />
        </button> */}
        
        <div className="w-px h-6 bg-white/10"></div>
        
        <div className="flex items-center gap-2">
          {authUser ? (
            <button onClick={logout} className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-colors">
              <LogOut className="w-4 h-4" />
              {authUser.name || authUser.email}
            </button>
          ) : (
            <button onClick={() => setAuthModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors">
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
          )}
        </div>
      </div>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </header>
  );
}