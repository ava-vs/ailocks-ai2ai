import React, { useState, useEffect, useCallback } from 'react';
import { Search, MapPin, Briefcase, ChevronDown, ChevronUp, BrainCircuit, Bot, HardDrive, Zap, Rss, Clock, CheckCircle, XCircle, LayoutGrid, Menu, ChevronLeft, ChevronRight, User, Trash2 } from 'lucide-react';
import AilockWidget from '../Ailock/AilockWidget';
import toast from 'react-hot-toast';
import { useUserSession } from '../../hooks/useUserSession';
import { deleteIntent } from '../../lib/api';

interface Intent {
  id: string;
  userId?: string;
  title: string;
  description: string;
  category: string;
  distance: string;
  requiredSkills: string[];
  budget?: string;
  timeline?: string;
  priority: string;
  matchScore: number;
  createdAt: string;
  userName?: string;
  isOwn?: boolean;
}

interface IntentPanelProps {
  isExpanded?: boolean;
  setIsRightPanelExpanded?: (expanded: boolean) => void;
}

type Tab = 'nearby' | 'in-work' | 'my-intents';

export default function IntentPanel({ isExpanded = false, setIsRightPanelExpanded }: IntentPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('nearby');
  const [intents, setIntents] = useState<Intent[]>([]);
  const [inWorkIntents, setInWorkIntents] = useState<Intent[]>([]);
  const [myIntents, setMyIntents] = useState<Intent[]>([]);
  const [isLoadingIntents, setIsLoadingIntents] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'checking'>('checking');
  const { currentUser, isAuthenticated, isLoading: isUserLoading } = useUserSession();
  const [notificationCount, setNotificationCount] = useState(0);
  const [deletingIntentId, setDeletingIntentId] = useState<string | null>(null);

  const checkDbStatus = async () => {
    try {
      const response = await fetch('/.netlify/functions/db-status');
      const data = await response.json();
      if (data.status === 'ok') {
        setDbStatus('connected');
        return true;
      } else {
        setDbStatus('error');
        return false;
      }
    } catch (error) {
      console.error('DB status check failed:', error);
      setDbStatus('error');
      return false;
    }
  };

  const handleIntentCreated = (event: CustomEvent) => {
    const newIntent = event.detail;
    console.log('New intent captured by IntentPanel:', newIntent);
    
    // Add to my intents if it's created by current user
    if (newIntent.isOwn || newIntent.userId === currentUser.id) {
      setMyIntents(prev => [newIntent, ...prev]);
      setActiveTab('my-intents'); // Switch to My Intents tab
    } else {
      setIntents(prev => [newIntent, ...prev]);
    }
    
    toast.success('New intent added to the list!');
  };

  const handleSearchResults = useCallback((event: CustomEvent) => {
    const { query, results } = event.detail;
    console.log(`Text search results captured by IntentPanel for query "${query}":`, results);
    setSearchQuery(query);
    setIntents(results);
    setActiveTab('nearby');
    setIsLoadingIntents(false);
    if (!isExpanded) {
      setNotificationCount(prev => prev + results.length);
    }
  }, [isExpanded]);

    // New handler for voice intents
  const handleVoiceSearchResults = useCallback((event: CustomEvent) => {
    const { query, intents } = event.detail;
    console.log(`Voice search results captured by IntentPanel for query "${query}":`, intents);
    setSearchQuery(query);
    setIntents(intents);
    setActiveTab('nearby');
    setIsLoadingIntents(false);
    if (!isExpanded) {
      setNotificationCount(prev => prev + intents.length);
    }
  }, [isExpanded]);

  const handleIntentInWork = useCallback((event: CustomEvent) => {
    const intentToMove = event.detail;
    if (!inWorkIntents.some(intent => intent.id === intentToMove.id)) {
      setInWorkIntents(prev => [intentToMove, ...prev]);
      setActiveTab('in-work');
     // toast.success(`"${intentToMove.title.substring(0,20)}..." moved to In Work.`);
    } else {
      toast.error('Intent is already in your "In Work" list.');
    }
  }, [inWorkIntents]);

  const handleDeleteIntent = async (intentId: string, intentTitle: string) => {
    if (!currentUser?.id) {
      toast.error('User not identified. Cannot delete.');
      return;
    }
    if (!confirm(`Are you sure you want to delete intent "${intentTitle}"?`)) {
      return;
    }

    setDeletingIntentId(intentId);
    
    try {
      await deleteIntent(intentId, currentUser.id);
      
      // Remove from my intents
      setMyIntents(prev => prev.filter(intent => intent.id !== intentId));
      
      // Also remove from other tabs if present
      setIntents(prev => prev.filter(intent => intent.id !== intentId));
      setInWorkIntents(prev => prev.filter(intent => intent.id !== intentId));
      
      toast.success('Intent successfully deleted');
    } catch (error) {
      console.error('Failed to delete intent:', error);
      toast.error('Error deleting intent');
    } finally {
      setDeletingIntentId(null);
    }
  };

  const handleUserChanged = () => {
    console.log('User changed, refetching intents...');
    setSearchQuery(null);
    setInWorkIntents([]); // Clear in-work intents for new user
    setMyIntents([]); // Clear my intents for new user
    fetchIntents();
    fetchMyIntents();
  };

  const fetchMyIntents = async () => {
    if (!currentUser.id || currentUser.id === 'loading') return;
    
    const isDbConnected = await checkDbStatus();
    if (!isDbConnected) {
      console.log('Using mock data for my intents because DB is not connected.');
      // setMyIntents(getMockMyIntents());
      return;
    }

    try {
      const response = await fetch(`/.netlify/functions/intents-list?userId=${currentUser.id}&myIntents=true`);
      if (response.ok) {
        const data = await response.json();
        setMyIntents(data);
      } else {
        console.error('Failed to fetch my intents, using mock data');
        // setMyIntents(getMockMyIntents());
      }
    } catch (error) {
      console.error('Error fetching my intents:', error);
      // setMyIntents(getMockMyIntents());
    }
  };

  useEffect(() => {
    if (!isUserLoading && isAuthenticated) {
      handleUserChanged();
    }
  }, [currentUser.id, isUserLoading, isAuthenticated]);


  useEffect(() => {
    window.addEventListener('intentCreated', handleIntentCreated as EventListener);
    window.addEventListener('text-search-results', handleSearchResults as EventListener);
    window.addEventListener('voice-intents-found', handleVoiceSearchResults as EventListener);
    window.addEventListener('intent-in-work', handleIntentInWork as EventListener);

    return () => {
      window.removeEventListener('intentCreated', handleIntentCreated as EventListener);
      window.removeEventListener('text-search-results', handleSearchResults as EventListener);
      window.removeEventListener('voice-intents-found', handleVoiceSearchResults as EventListener);
      window.removeEventListener('intent-in-work', handleIntentInWork as EventListener);
    };
  }, [handleSearchResults, handleVoiceSearchResults, handleIntentInWork]);

  const fetchIntents = async (query = '') => {
    setIsLoadingIntents(true);
    const isDbConnected = await checkDbStatus();

    if (!isDbConnected) {
      console.log('Using mock data because DB is not connected.');
      setIntents(getMockIntents());
      setIsLoadingIntents(false);
      return;
    }

    try {
      const response = await fetch(`/.netlify/functions/intents-list?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setIntents(data);
      } else {
        console.error('Failed to fetch intents, using mock data');
        setIntents(getMockIntents());
      }
    } catch (error) {
      console.error('Error fetching intents:', error);
      setIntents(getMockIntents());
    } finally {
      setIsLoadingIntents(false);
    }
  };

  const getMockIntents = (): Intent[] => [
    {
      id: 'mock-1',
      title: 'Develop a new AI-powered design tool',
      description: 'Looking for a senior frontend developer to build a revolutionary design tool...',
      category: 'Technology',
      requiredSkills: ['React', 'TypeScript', 'Figma API'],
      budget: '$50,000',
      timeline: '3 months',
      priority: 'high',
      matchScore: 92,
      distance: 'Remote',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      userName: 'Lirea',
      isOwn: false
    },
    {
      id: 'mock-2',
      title: 'Marketing campaign for a new mobile app',
      description: 'Need a marketing expert to run a campaign for our new app in Brazil...',
      category: 'Marketing',
      requiredSkills: ['Social Media', 'SEO', 'Content Creation'],
      budget: '$15,000',
      timeline: '2 months',
      priority: 'medium',
      matchScore: 85,
      distance: '< 5 miles',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      userName: 'Marco',
      isOwn: false
    }
  ];

  const getMockMyIntents = (): Intent[] => [
    {
      id: 'my-mock-1',
      userId: currentUser.id,
      title: 'Looking for React developer for startup project',
      description: 'Need an experienced React developer to help build our new startup platform...',
      category: 'Technology',
      requiredSkills: ['React', 'Node.js', 'MongoDB'],
      budget: '$30,000',
      timeline: '4 months',
      priority: 'high',
      matchScore: 100,
      distance: 'Remote',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      userName: currentUser.name,
      isOwn: true
    }
  ];

  if (!isExpanded) {
    return (
      <div className="relative h-full flex flex-col items-center bg-slate-900/80 backdrop-blur-sm text-white border-l border-slate-700/50">
        <div className="flex flex-col items-center gap-y-4 pt-5">
          <button
            onClick={() => {
              setIsRightPanelExpanded?.(true);
              setNotificationCount(0);
            }}
            className="relative p-2"
            title={notificationCount > 0 ? `${notificationCount} new intents found` : 'Show Intents'}
          >
            <LayoutGrid className="w-6 h-6 text-blue-400" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white ring-2 ring-slate-900">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>
          <div className="flex flex-col items-center gap-y-2">
            <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">NEW</span>
            <Menu className="w-7 h-7 text-blue-400 mt-1" />
          </div>
        </div>

        <button
          onClick={() => setIsRightPanelExpanded?.(true)}
          className="absolute top-1/2 -translate-y-1/2 left-[-1.25rem] w-10 h-10 flex items-center justify-center rounded-full bg-slate-800/80 hover:bg-slate-700/80 transition-colors"
          title="Expand"
        >
          <ChevronLeft className="w-5 h-5 text-slate-300" />
        </button>
      </div>
    );
  }

  const Tabs = () => (
    <div className="flex border-b border-slate-700/60 mb-4">
      <div className="flex-1 flex space-x-1">
        <button
          onClick={() => setActiveTab('nearby')}
          className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'nearby'
              ? 'bg-slate-700/50 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Rss className="w-4 h-4" />
            <span>Nearby</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('in-work')}
          className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'in-work'
              ? 'bg-slate-700/50 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            <span>In Work</span>
            {inWorkIntents.length > 0 && (
              <span className="bg-blue-500/50 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {inWorkIntents.length}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('my-intents')}
          className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'my-intents'
              ? 'bg-slate-700/50 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span>My Intents</span>
            {myIntents.length > 0 && (
              <span className="bg-green-500/50 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {myIntents.length}
              </span>
            )}
          </div>
        </button>
      </div>
      <div className="flex items-center">
        <button onClick={() => {
          fetchIntents(searchQuery || '');
          if (activeTab === 'my-intents') {
            fetchMyIntents();
          }
        }} title="Refresh" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors">
          <Zap className="w-4 h-4" />
        </button>
        <button onClick={() => setIsRightPanelExpanded?.(false)} title="Collapse" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  const IntentCard = ({ intent, showDeleteButton = false }: { intent: Intent; showDeleteButton?: boolean }) => (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3.5 mb-3 hover:border-slate-600/80 transition-colors duration-200">
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-sm font-semibold text-white/90 leading-tight flex-1 pr-2">
          {intent.title}
        </h4>
        <div className="flex items-center gap-2">
          <div className="flex items-center space-x-1 bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md text-xs font-bold border border-blue-500/30">
            <span>{intent.matchScore}%</span>
          </div>
          {showDeleteButton && (
            <button
              onClick={() => handleDeleteIntent(intent.id, intent.title)}
              disabled={deletingIntentId === intent.id}
              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-md transition-colors disabled:opacity-50"
              title="Удалить интент"
            >
              {deletingIntentId === intent.id ? (
                <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 mb-3 leading-snug">
          {intent.description.substring(0, 100)}{intent.description.length > 100 ? '...' : ''}
      </p>
      
      <div className="flex flex-wrap gap-1.5 mb-3">
        {intent.requiredSkills.slice(0, 3).map(skill => (
          <span key={skill} className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-xs font-medium border border-purple-500/30">
            {skill}
          </span>
        ))}
      </div>

      <div className="flex justify-between items-center text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3" />
          <span>{intent.distance}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          <span>{formatTimeAgo(intent.createdAt)}</span>
        </div>
      </div>
    </div>
  );

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "m ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "min ago";
    return "just now";
  };

  const EmptyState = ({tab}: {tab: Tab}) => (
    <div className="text-center py-10 px-4">
      <div className="w-12 h-12 bg-slate-800 border border-slate-700 rounded-full mx-auto flex items-center justify-center mb-4">
        {tab === 'nearby' && <Search className="w-6 h-6 text-slate-500" />}
        {tab === 'in-work' && <Briefcase className="w-6 h-6 text-slate-500" />}
        {tab === 'my-intents' && <User className="w-6 h-6 text-slate-500" />}
      </div>
      <h4 className="font-semibold text-white">
        {tab === 'nearby' && 'No Local Intents'}
        {tab === 'in-work' && 'No Intents In Work'}
        {tab === 'my-intents' && 'No My Intents'}
      </h4>
      <p className="text-sm text-slate-400 mt-1">
        {tab === 'nearby' && 'Try a broader search in the chat.'}
        {tab === 'in-work' && 'Start work on an intent to see it here.'}
        {tab === 'my-intents' && 'Create your first intent in the chat.'}
      </p>
    </div>
  );
  
  const LoadingSkeleton = () => (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3.5 animate-pulse">
            <div className="h-4 bg-slate-700 rounded w-3/4 mb-3"></div>
            <div className="h-3 bg-slate-700 rounded w-full mb-4"></div>
            <div className="h-3 bg-slate-700 rounded w-1/2 mb-4"></div>
            <div className="flex gap-2">
                <div className="h-5 bg-slate-700 rounded w-16"></div>
                <div className="h-5 bg-slate-700 rounded w-16"></div>
            </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-900/80 backdrop-blur-sm text-white border-l border-slate-700/50">
      {/* <div className="p-4 border-b border-slate-700/60">
        <AilockWidget />
      </div> */}

      <div className="p-4">
        <Tabs />
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        {searchQuery && activeTab === 'nearby' && (
          <p className="text-sm text-slate-400 mb-3 px-1">
            Results for: <span className="text-white font-medium">"{searchQuery}"</span>
          </p>
        )}
        
        {isLoadingIntents ? (
          <LoadingSkeleton />
        ) : (
          <div>
            {activeTab === 'nearby' && (
              intents.length > 0 ? intents.map(intent => <IntentCard key={intent.id} intent={intent} />) : <EmptyState tab="nearby" />
            )}
            {activeTab === 'in-work' && (
              inWorkIntents.length > 0 ? inWorkIntents.map(intent => <IntentCard key={intent.id} intent={intent} />) : <EmptyState tab="in-work" />
            )}
            {activeTab === 'my-intents' && (
              myIntents.length > 0 ? myIntents.map(intent => <IntentCard key={intent.id} intent={intent} showDeleteButton={true} />) : <EmptyState tab="my-intents" />
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-700/60">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Rss className={`w-3 h-3 ${dbStatus === 'connected' ? 'text-green-500' : 'text-yellow-500'}`} />
            <span>{dbStatus === 'connected' ? 'Live Database' : 'Demo Data'}</span>
          </div>
          <button 
            onClick={() => setIsRightPanelExpanded?.(!isExpanded)} 
            className="text-slate-400 hover:text-white transition-colors"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>
    </div>
  );
}