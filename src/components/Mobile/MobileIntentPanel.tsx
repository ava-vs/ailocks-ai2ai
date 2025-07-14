import { useState, useEffect } from 'react';
import IntentDetailModal from '../Chat/IntentDetailModal';
import { X, Search, MapPin, Briefcase, User, Clock, Trash2 } from 'lucide-react';
import { useUserSession } from '@/hooks/useUserSession';
import { deleteIntent } from '@/lib/api';
import toast from 'react-hot-toast';

interface Intent {
  id: string;
  userId?: string;
  title: string;
  description: string;
  category: string;
  distance: string;
  requiredSkills: string[];
  /** duplicate for compatibility with IntentDetailModal */
  skills: string[];
  budget?: string;
  timeline?: string;
  priority: string;
  matchScore: number;
  createdAt: string;
  userName?: string;
  isOwn?: boolean;
}

interface MobileIntentPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'nearby' | 'in-work' | 'my-intents';

export default function MobileIntentPanel({ isOpen, onClose }: MobileIntentPanelProps) {
  // --- local state for intent modal ---
  const [selectedIntent, setSelectedIntent] = useState<Intent | null>(null);
  const [isIntentModalOpen, setIntentModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('nearby');
  const [intents, setIntents] = useState<Intent[]>([]);
  const [inWorkIntents, setInWorkIntents] = useState<Intent[]>([]);
  const [myIntents, setMyIntents] = useState<Intent[]>([]);
  const [loadingMyIntents, setLoadingMyIntents] = useState<boolean>(false);
  const [isLoadingIntents, setIsLoadingIntents] = useState(true);
  const [isFetchingError, setIsFetchingError] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  // const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'checking'>('checking');
  const { currentUser } = useUserSession();
  const [deletingIntentId, setDeletingIntentId] = useState<string | null>(null);

  // Persisted storage key depends on user
  const getStorageKey = (userId: string | undefined) => `inWorkIntents_${userId || 'guest'}`;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleIntentCreated = (event: CustomEvent) => {
      const newIntent = event.detail;
      if (newIntent.isOwn || newIntent.userId === currentUser.id) {
        setMyIntents(prev => [newIntent, ...prev]);
        setActiveTab('my-intents');
      } else {
        setIntents(prev => [newIntent, ...prev]);
      }
      toast.success('New intent added!');
    };

    const handleSearchResults = (event: CustomEvent) => {
      const { query, results } = event.detail;
      setSearchQuery(query);
      setIntents(results);
      setActiveTab('nearby');
      setIsLoadingIntents(false);
    };

    const handleIntentInWork = (event: CustomEvent) => {
      const intentToMove = event.detail;
      if (!inWorkIntents.some(intent => intent.id === intentToMove.id)) {
        const updated = [intentToMove, ...inWorkIntents];
        setInWorkIntents(updated);
        persistInWork(updated);
        setActiveTab('in-work');
        toast.success('Intent added to "In Work"');
      } else {
        // Duplicate – show only one toast to avoid multiple panels duplications
        console.info('[MobileIntentPanel] Duplicate In-Work intent ignored');
      }
    };

    window.addEventListener('intentCreated', handleIntentCreated as EventListener);
    window.addEventListener('text-search-results', handleSearchResults as EventListener);
    window.addEventListener('intent-in-work', handleIntentInWork as EventListener);

    return () => {
      window.removeEventListener('intentCreated', handleIntentCreated as EventListener);
      window.removeEventListener('text-search-results', handleSearchResults as EventListener);
      window.removeEventListener('intent-in-work', handleIntentInWork as EventListener);
    };
  }, [currentUser.id, inWorkIntents]);

  useEffect(() => {
    const fetchIntents = async (query = '') => {
      setIsLoadingIntents(true);
      try {
        const response = await fetch(`/.netlify/functions/intents-list?q=${encodeURIComponent(query)}`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setIntents(data);
          setIsFetchingError(false);
        } else {
          console.error('Failed to fetch intents');
          setIsFetchingError(true);
          setIntents([]);
        }
      } catch (error) {
        console.error('Error fetching intents:', error);
        setIsFetchingError(true);
        setIntents([]);
      } finally {
        setIsLoadingIntents(false);
      }
    };

    const fetchMyIntents = async () => {
      if (!currentUser?.id || currentUser.id === 'loading') return;
      setLoadingMyIntents(true);
      try {
        const resp = await fetch(`/.netlify/functions/intents-list?userId=${currentUser.id}&myIntents=true`, { credentials: 'include' });
        if (resp.ok) {
          const res = await resp.json();
          const list = Array.isArray(res) ? res : res.intents;
          setMyIntents(list || []);
        } else {
          console.error('Failed to fetch my intents');
        }
      } catch (err) {
        console.error('Error fetching my intents:', err);
      } finally {
        setLoadingMyIntents(false);
      }
    };

    if (isOpen) {
      fetchIntents();
      fetchMyIntents();
    }
  }, [isOpen, currentUser.id]);

  useEffect(() => {
    // Load persisted In-Work intents when user changes
    if (currentUser?.id && currentUser.id !== 'loading') {
      try {
        const stored = localStorage.getItem(getStorageKey(currentUser.id));
        if (stored) {
          setInWorkIntents(JSON.parse(stored));
        }
      } catch (err) {
        console.warn('Failed to load persisted In-Work intents (mobile):', err);
      }
    }
  }, [currentUser.id]);

  const persistInWork = (updated: Intent[]) => {
    try {
      localStorage.setItem(getStorageKey(currentUser.id), JSON.stringify(updated));
    } catch {}
  };

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
      setMyIntents(prev => prev.filter(intent => intent.id !== intentId));
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

  const openIntentModal = (intent: Intent) => {
    // ensure skills populated for modal compatibility
    const intentWithSkills: Intent = { ...intent, skills: intent.requiredSkills };
    setSelectedIntent(intentWithSkills);
    setIntentModalOpen(true);
  };

  const IntentCard = ({ intent, showDeleteButton = false }: { intent: Intent; showDeleteButton?: boolean }) => (
    <div onClick={() => openIntentModal(intent)} className="cursor-pointer bg-slate-800/50 border border-slate-700/50 rounded-lg p-3.5 mb-3 hover:border-slate-600/80 transition-colors duration-200">
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
              title="Delete intent"
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

  if (!isOpen) return null;

  return (
    <>
      {isIntentModalOpen && selectedIntent && (
        <IntentDetailModal
          isOpen={isIntentModalOpen}
          onClose={() => setIntentModalOpen(false)}
          intent={selectedIntent}
          alreadyInWork={inWorkIntents.some(i => i.id === selectedIntent.id)}
          onStartWork={(intent) => {
            // dispatch event so other panels sync
            window.dispatchEvent(new CustomEvent('intent-in-work', { detail: intent }));
          }}
        />
      )}

      <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/95 backdrop-blur-lg">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-lg font-bold text-white">Intents</h2>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-white/60" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('nearby')}
          className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
            activeTab === 'nearby'
              ? 'bg-slate-700/50 text-white border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Nearby
        </button>
        <button
          onClick={() => setActiveTab('in-work')}
          className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
            activeTab === 'in-work'
              ? 'bg-slate-700/50 text-white border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          In Work
          {inWorkIntents.length > 0 && (
            <span className="ml-2 bg-blue-500/50 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {inWorkIntents.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('my-intents')}
          className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
            activeTab === 'my-intents'
              ? 'bg-slate-700/50 text-white border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          My Intents
          {myIntents.length > 0 && (
            <span className="ml-2 bg-green-500/50 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {myIntents.length}
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-white/10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Search intents..."
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50 focus:bg-white/10"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {searchQuery && activeTab === 'nearby' && (
          <p className="text-sm text-slate-400 mb-3 px-1">
            Results for: <span className="text-white font-medium">"{searchQuery}"</span>
          </p>
        )}
        
        {isLoadingIntents ? (
          <LoadingSkeleton />
        ) : isFetchingError ? (
          <p className="text-center text-red-400">Failed to load intents. Please try again later.</p>
        ) : (
          <div>
            {activeTab === 'nearby' && (
              intents.length > 0 ? intents.map(intent => <IntentCard key={intent.id} intent={intent} />) : <EmptyState tab="nearby" />
            )}
            {activeTab === 'in-work' && (
              inWorkIntents.length > 0 ? inWorkIntents.map(intent => <IntentCard key={intent.id} intent={intent} />) : <EmptyState tab="in-work" />
            )}
            {activeTab === 'my-intents' && (
                loadingMyIntents ? (
                  <LoadingSkeleton />
                ) : (
                  myIntents.length > 0 ? (
                    myIntents.map(intent => (
                      <IntentCard key={intent.id} intent={intent} showDeleteButton={true} />
                    ))
                  ) : (
                    <EmptyState tab="my-intents" />
                  )
                )
              )}
          </div>
        )}
      </div>

      {/* Status Bar removed */}
      
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            
            
          </div>
        </div>
      </div>
    {/* </div> */}
  </>
  );
}