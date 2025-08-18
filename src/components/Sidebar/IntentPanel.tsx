import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, MapPin, Briefcase, Zap, Rss, Clock, LayoutGrid, Menu, ChevronLeft, ChevronRight, User, Trash2, X, Package, Navigation, FileText, ShoppingBag, Users, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { useUserSession } from '../../hooks/useUserSession';
import { deleteIntent } from '../../lib/api';
import IntentDetailModal from '../Chat/IntentDetailModal';
import OrderDetailModal from '../Chat/OrderDetailModal';
import { useAuth } from '@/hooks/useAuth';

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

interface Order {
  id: string;
  title: string;
  description: string;
  milestones: {
    id?: string;
    description: string;
    amount: number;
    deadline: string;
    status: 'pending' | 'in-progress' | 'completed';
  }[];
  amount: number;
  currency: string;
  status: string;
  progress: number;
  createdAt: string;
  // Дополнительные поля для карточки заказа
  fundingGoal?: number;
  cashback?: string;
  minContribution?: number;
  maxContribution?: number;
  reportingFrequency?: string;
  investorRequirements?: string;
  projectRisks?: string;
  // Поля для отображения в карточке по макету
  matchScore?: number; // Процент совпадения (75% match)
  investorCount?: number; // Количество инвесторов
  daysLeft?: number; // Количество оставшихся дней
  author?: {
    name: string;
    level?: number;
    rating?: number;
    projectCount?: number;
    avatar?: string;
    profession?: string;
  };
  discussionMessages?: {
    id: string;
    author: string;
    text: string;
    createdAt: string;
  }[];
}

interface IntentPanelProps {
  isExpanded?: boolean;
  setIsRightPanelExpanded?: (expanded: boolean) => void;
}

type Tab = 'nearby' | 'in-work' | 'my-intents' | 'my-orders';

export default function IntentPanel({ isExpanded = false, setIsRightPanelExpanded }: IntentPanelProps) {
  const { user: authUser } = useAuth();
  const { currentUser, isAuthenticated, isLoading: isUserLoading } = useUserSession();
  const displayUser = authUser || currentUser;

  const prevUserIdRef = useRef<string | undefined>(undefined);

  const [activeTab, setActiveTab] = useState<Tab>('nearby');
  const [intents, setIntents] = useState<Intent[]>([]);
  const [inWorkIntents, setInWorkIntents] = useState<Intent[]>([]);
  const [myIntents, setMyIntents] = useState<Intent[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [isLoadingIntents, setIsLoadingIntents] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'checking'>('checking');
  const [loadingMyIntents, setLoadingMyIntents] = useState(false);
  const [loadingMyOrders, setLoadingMyOrders] = useState(false);
  const [loadingInWork, setLoadingInWork] = useState(false);
  const [selectedIntent, setSelectedIntent] = useState<Intent | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  // Effect to detect реальную смену userId после начальной загрузки
  useEffect(() => {
    if (!displayUser?.id || displayUser.id === 'loading') return;
    if (prevUserIdRef.current && prevUserIdRef.current !== displayUser.id) {
      handleUserChanged();
    }
    prevUserIdRef.current = displayUser.id;
  }, [displayUser?.id]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [newNearbyCount, setNewNearbyCount] = useState(0);
  const [newInWorkCount, setNewInWorkCount] = useState(0);
  const [newMyIntentsCount, setNewMyIntentsCount] = useState(0);
  const [newMyOrdersCount, setNewMyOrdersCount] = useState(0);
  const [deletingIntentId, setDeletingIntentId] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Persisted storage key depends on user
  const getStorageKey = (userId: string | undefined) => `inWorkIntents_${userId || 'guest'}`;

  // Load persisted In-Work intents on user change
  useEffect(() => {
    if (displayUser?.id && displayUser.id !== 'loading') {
      try {
        const stored = localStorage.getItem(getStorageKey(displayUser.id));
        if (stored) {
          setInWorkIntents(JSON.parse(stored));
        }
      } catch (err) {
        console.warn('Failed to load persisted In-Work intents:', err);
      }
      
      // Load user orders when user changes
      loadMyOrders();
    }
  }, [displayUser?.id]);
  
  // Function to load user orders
  const loadMyOrders = async () => {
    if (!displayUser?.id || displayUser.id === 'loading') return;
    
    setLoadingMyOrders(true);
    try {
      const response = await fetch('/.netlify/functions/escrow-get-user-orders', {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to load orders');
      }
      
      const data = await response.json();
      setMyOrders(data.orders || []);
      setNewMyOrdersCount(0); // Reset counter after viewing
    } catch (error) {
      console.error('Failed to load orders:', error);
      toast.error('Could not load your orders.');
    } finally {
      setLoadingMyOrders(false);
    }
  };

  // Helper to persist
  const persistInWork = (updated: Intent[]) => {
    try {
      localStorage.setItem(getStorageKey(displayUser.id), JSON.stringify(updated));
    } catch {}
  };

  // --- ADD INTENT TO "IN WORK" (moved up for dependency order) ---
  const addIntentToInWork = async (intent: Intent) => {
    if (!displayUser?.id || displayUser.id === 'loading') return;
    try {
      const response = await fetch('/.netlify/functions/in-work-intents', {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ intentId: intent.id }),
      });
      if (!response.ok) throw new Error('Failed to add');
      
      setInWorkIntents(prev => [intent, ...prev]);
      toast.success(`Moved "${intent.title}" to In Work.`);
      closeIntentModal();

    } catch (error) {
      console.error('Failed to add intent to in-work:', error);
      toast.error('Could not move intent to In Work.');
    }
  };

  // --- HANDLE EVENT TO MOVE INTO "IN WORK" ---
  const handleIntentInWork = useCallback((event: CustomEvent) => {
    const intentToMove = event.detail;
    addIntentToInWork(intentToMove);
    setInWorkIntents(prev => {
      if (prev.some(i => i.id === intentToMove.id)) {
        toast.error('Intent is already in your "In Work" list.');
        return prev;
      }
      const updated = [intentToMove, ...prev];
      persistInWork(updated);
      toast.success('Intent added to "In Work"');
      
      if (activeTab !== 'in-work') {
        // Инкрементируем счетчик новых элементов, если пользователь не на вкладке In Work
        setNewInWorkCount(prev => prev + 1);
      }
      
      return updated;
    });
    setActiveTab('in-work');
  }, [persistInWork, addIntentToInWork, activeTab]);

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
    if (newIntent.isOwn || newIntent.userId === displayUser?.id) {
      setMyIntents(prev => [newIntent, ...prev]);
      
      if (activeTab !== 'my-intents') {
        // Инкрементируем счетчик новых элементов, если пользователь не на вкладке My Intents
        setNewMyIntentsCount(prev => prev + 1);
      } else {
        setActiveTab('my-intents'); // Switch to My Intents tab
      }
    } else {
      setIntents(prev => [newIntent, ...prev]);
      if (activeTab !== 'nearby') {
        // Инкрементируем счетчик новых элементов, если пользователь не на вкладке Nearby
        setNewNearbyCount(prev => prev + 1);
      }
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
    } else {
      // Показываем индикатор новых элементов во вкладке Nearby
      setNewNearbyCount(prev => prev + results.length);
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
    } else {
      // Показываем индикатор новых элементов во вкладке Nearby
      setNewNearbyCount(prev => prev + intents.length);
    }
  }, [isExpanded]);

  const handleDeleteIntent = async (intentId: string, intentTitle: string) => {
    if (!displayUser?.id) {
      toast.error('User not identified. Cannot delete.');
      return;
    }
    if (!confirm(`Are you sure you want to delete intent "${intentTitle}"?`)) {
      return;
    }

    setDeletingIntentId(intentId);
    
    try {
      await deleteIntent(intentId, displayUser.id);
      
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
    // Reload "In Work" intents for the new user from localStorage
    try {
      const stored = localStorage.getItem(getStorageKey(displayUser.id));
      setInWorkIntents(stored ? JSON.parse(stored) : []);
    } catch {
      setInWorkIntents([]);
    }
    setMyIntents([]); // Clear my intents for new user
    fetchIntents();
    fetchMyIntents();
  };

  const fetchMyIntents = async () => {
    if (!displayUser.id || displayUser.id === 'loading') return;
    
    const isDbConnected = await checkDbStatus();
    if (!isDbConnected) {
      console.log('Using mock data for my intents because DB is not connected.');
      // setMyIntents(getMockMyIntents());
      return;
    }

    try {
      const response = await fetch(`/.netlify/functions/intents-list?userId=${displayUser.id}&myIntents=true`, {
        credentials: 'include'
      });
      if (response.ok) {
        const res = await response.json();
        // API returns { intents: [...] }
        const list = Array.isArray(res) ? res : res.intents;
        setMyIntents(list || []);
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

  useEffect(() => {
    // Загрузка интентов при инициализации
    fetchIntents();
    fetchMyIntents();
    fetchInWorkIntents();
    
    // Обработчик события для переключения на вкладку "My Orders"
    const handleSwitchToMyOrders = (event: CustomEvent) => {
      setActiveTab('my-orders');
      loadMyOrders();
      
      // Если в событии передан ID заказа, можно выполнить дополнительные действия
      const orderId = event.detail?.orderId;
      if (orderId) {
        console.log('Переключение на заказ с ID:', orderId);
        // Здесь можно добавить логику для выделения заказа с указанным ID
      }
    };
    
    // Добавляем слушатель события
    window.addEventListener('switch-to-my-orders', handleSwitchToMyOrders as EventListener);
    
    // Удаляем слушатель при размонтировании компонента
    return () => {
      window.removeEventListener('switch-to-my-orders', handleSwitchToMyOrders as EventListener);
    };
  }, []);

  useEffect(() => {
    const handleOrderCreated = () => {
      console.log('🔔 Событие order-created получено в IntentPanel');
      loadMyOrders();
      // Автоматически переключаемся на вкладку My Orders для отображения нового заказа
      setActiveTab('my-orders');
      console.log('🔄 Переключение на вкладку My Orders после создания заказа');
    };

    window.addEventListener('order-created', handleOrderCreated);

    return () => {
      window.removeEventListener('order-created', handleOrderCreated);
    };
  }, []);

  // Reset new item counter when switching tabs
  useEffect(() => {
    if (activeTab === 'nearby') {
      setNewNearbyCount(0);
    } else if (activeTab === 'in-work') {
      setNewInWorkCount(0);
    } else if (activeTab === 'my-intents') {
      setNewMyIntentsCount(0);
    }
  }, [activeTab]);

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
      const response = await fetch(`/.netlify/functions/intents-list?q=${encodeURIComponent(query)}`, {
        credentials: 'include'
      });
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

  const openIntentModal = (intent: Intent) => {
    setSelectedIntent(intent);
    setIsModalOpen(true);
  };

  const closeIntentModal = () => {
    setIsModalOpen(false);
    setSelectedIntent(null);
  };

  const handleStartWork = (intent: any) => {
    if (intent.isOwn) {
      toast.error("You cannot start work on your own intent.");
      return;
    }
    addIntentToInWork(intent);
  };

  const fetchInWorkIntents = async () => {
    if (!displayUser?.id || displayUser.id === 'loading') return;
    setLoadingInWork(true);
    try {
      const response = await fetch('/.netlify/functions/in-work-intents', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setInWorkIntents(data || []);
    } catch (error) {
      console.error('Failed to fetch in-work intents:', error);
      toast.error("Could not load 'in-work' intents.");
    } finally {
      setLoadingInWork(false);
    }
  };
  
  const removeIntentFromInWork = async (intentId: string) => {
    if (!displayUser?.id || displayUser.id === 'loading') return;
    
    const originalIntents = inWorkIntents;
    setInWorkIntents(prev => prev.filter(i => i.id !== intentId));
    
    try {
      const response = await fetch('/.netlify/functions/in-work-intents', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
         },
        body: JSON.stringify({ intentId }),
      });
      if (!response.ok) throw new Error('Failed to remove');
      toast.success('Intent removed from "In Work".');
    } catch (error) {
      console.error('Failed to remove intent from in-work:', error);
      toast.error('Could not remove intent.');
      setInWorkIntents(originalIntents);
    }
  };

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
      <div className="w-full flex justify-between px-6">
        <button
          onClick={() => setActiveTab('nearby')}
          className={`p-3 w-16 h-16 rounded-lg transition-colors flex items-center justify-center relative ${
            activeTab === 'nearby'
              ? 'bg-slate-700/70 text-white'
              : 'text-slate-400 hover:bg-slate-700/30 hover:text-white'
          }`}
          title="Nearby - Find intents around your location"
          aria-label="Nearby"
        >
          <Navigation size={24} />
          {newNearbyCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
              {newNearbyCount > 9 ? '9+' : newNearbyCount}
            </span>
          )}
        </button>
        
        <button
          onClick={() => setActiveTab('in-work')}
          className={`p-3 w-16 h-16 rounded-lg transition-colors flex items-center justify-center relative ${
            activeTab === 'in-work'
              ? 'bg-slate-700/70 text-white'
              : 'text-slate-400 hover:bg-slate-700/30 hover:text-white'
          }`}
          title="In Work - Intents currently in progress"
          aria-label="In Work"
        >
          <Briefcase size={24} />
          {inWorkIntents.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600/90 text-xs font-bold text-white shadow-sm">
              {inWorkIntents.length > 99 ? '99+' : inWorkIntents.length}
            </span>
          )}
          {newInWorkCount > 0 && (
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 border border-slate-800">
              <span className="sr-only">{newInWorkCount} new items</span>
            </span>
          )}
        </button>
        
        <button
          onClick={() => setActiveTab('my-intents')}
          className={`p-3 w-16 h-16 rounded-lg transition-colors flex items-center justify-center relative ${
            activeTab === 'my-intents'
              ? 'bg-slate-700/70 text-white'
              : 'text-slate-400 hover:bg-slate-700/30 hover:text-white'
          }`}
          title="My Intents - Intents you have created"
          aria-label="My Intents"
        >
          <FileText size={24} />
          {myIntents.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600/90 text-xs font-bold text-white shadow-sm">
              {myIntents.length > 99 ? '99+' : myIntents.length}
            </span>
          )}
          {newMyIntentsCount > 0 && (
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 border border-slate-800">
              <span className="sr-only">{newMyIntentsCount} new items</span>
            </span>
          )}
        </button>
        
        <button
          onClick={() => setActiveTab('my-orders')}
          className={`p-3 w-16 h-16 rounded-lg transition-colors flex items-center justify-center relative ${
            activeTab === 'my-orders'
              ? 'bg-slate-700/70 text-white'
              : 'text-slate-400 hover:bg-slate-700/30 hover:text-white'
          }`}
          title="My Orders - Orders you have placed"
          aria-label="My Orders"
        >
          <ShoppingBag size={24} />
          {myOrders.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600/90 text-xs font-bold text-white shadow-sm">
              {myOrders.length > 99 ? '99+' : myOrders.length}
            </span>
          )}
          {newMyOrdersCount > 0 && (
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 border border-slate-800">
              <span className="sr-only">{newMyOrdersCount} new items</span>
            </span>
          )}
        </button>
      </div>
    </div>
  );

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
              onClick={(e) => { e.stopPropagation(); handleDeleteIntent(intent.id, intent.title); }}
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
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "min ago";
    return "just now";
  };

  // Order card component
  const OrderCard = ({ order }: { order: Order }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Function to open order modal
    const openOrderModal = () => {
      setSelectedOrder(order);
      setIsOrderModalOpen(true);
    };
    
    // Calculate funding percentage
    const fundingPercentage = order.fundingGoal ? Math.round((order.amount / order.fundingGoal) * 100) : 60;
    
    return (
      <div className="cursor-pointer bg-slate-800/50 border border-slate-700/50 rounded-lg p-3.5 mb-3 hover:border-purple-600/80 transition-colors duration-200">
        {/* Card header */}
        <div onClick={() => setIsExpanded(!isExpanded)} className="flex justify-between items-start mb-2">
          <h4 className="text-sm font-semibold text-white/90 leading-tight flex-1 pr-2">
            {order.title}
          </h4>
          <div className="flex items-center gap-2">
            <div className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-bold ${order.matchScore ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : order.status === 'in-progress' ? 'bg-[rgb(34,197,94)]/20 text-[rgb(34,197,94)] border-[rgb(34,197,94)]/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>
              {order.matchScore ? `${order.matchScore}% match` : order.status}
            </div>
          </div>
        </div>
        
        {/* Description */}
        <p className="text-xs text-slate-400 mb-3 leading-snug">
          {order.description.substring(0, 100)}{order.description.length > 100 ? '...' : ''}
        </p>
        
        {/* Order info */}
        <div className="flex items-center justify-between mb-3 text-xs">
          <div className="flex items-center gap-2">
            <MapPin className="w-3 h-3 text-slate-500" />
            <span className="text-slate-400">International</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-3 h-3 text-slate-500" />
            <span className="text-slate-400">{order.investorCount || 24} investors</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-3 h-3 text-slate-500" />
            <span className="text-slate-400">${order.minContribution || 200}+</span>
          </div>
        </div>
        
        {/* Funding progress */}
        <div className="flex items-center justify-between mb-1 text-xs">
          <span className="font-bold text-white">${order.amount || 4800}</span>
          <span className="text-slate-400">of ${order.fundingGoal || 8000}</span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-slate-700/50 rounded-full h-2 mb-3">
          <div 
            className="bg-gradient-to-r from-purple-600 to-blue-500 h-2 rounded-full" 
            style={{ width: `${fundingPercentage}%` }}
          ></div>
        </div>
        
        {/* Action buttons */}
        <div className="flex justify-between gap-2">
          <button 
            onClick={() => openOrderModal()} 
            className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium py-1.5 px-3 rounded-full text-xs transition-all shadow-sm"
          >
            Co-Invest
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); openOrderModal(); }} 
            className="bg-gradient-to-r from-sky-600 to-slate-700 hover:from-sky-700 hover:to-slate-800 text-white font-medium py-1.5 px-3 rounded-full text-xs transition-all shadow-sm"
          >
            Details
          </button>
        </div>
        
        {/* Expanded view with milestones */}
        {isExpanded && (
          <div className="mt-4 pt-3 border-t border-slate-700/50">
            <h5 className="text-xs font-semibold text-white/80 mb-2">Milestones:</h5>
            <div className="space-y-2">
              {order.milestones.map((milestone, index) => (
                <div key={index} className="text-xs bg-slate-800/80 p-2 rounded border border-slate-700/50">
                  <div className="flex justify-between mb-1">
                    <span className="text-white/80">{milestone.description}</span>
                    <span className="text-purple-400">{order.currency} {milestone.amount}</span>
                  </div>
                  <div className="text-slate-500">Deadline: {new Date(milestone.deadline).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
            
            <div className="mt-3 flex justify-end">
              <button 
                onClick={(e) => {
                  e.stopPropagation(); // Prevent event bubbling
                  openOrderModal();
                }} 
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded transition-colors"
              >
                View Details
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const EmptyState = ({tab}: {tab: Tab}) => (
    <div className="text-center py-10 px-4">
      <div className="w-12 h-12 bg-slate-800 border border-slate-700 rounded-full mx-auto flex items-center justify-center mb-4">
        {tab === 'nearby' && <MapPin className="w-6 h-6 text-slate-500" />}
        {tab === 'in-work' && <Briefcase className="w-6 h-6 text-slate-500" />}
        {tab === 'my-intents' && <User className="w-6 h-6 text-slate-500" />}
        {tab === 'my-orders' && <Package className="w-6 h-6 text-slate-500" />}
      </div>
      <h4 className="font-semibold text-white">
        {tab === 'nearby' && 'No Local Intents'}
        {tab === 'in-work' && 'No Intents In Work'}
        {tab === 'my-intents' && 'No My Intents'}
        {tab === 'my-orders' && 'No Orders Found'}
      </h4>
      <p className="text-sm text-slate-400 mt-1">
        {tab === 'nearby' && 'Try a broader search in the chat.'}
        {tab === 'in-work' && 'Start work on an intent to see it here.'}
        {tab === 'my-intents' && 'Create your first intent in the chat.'}
        {tab === 'my-orders' && 'Create your first order in the chat.'}
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
              loadingInWork ? <LoadingSkeleton /> : inWorkIntents.length > 0 ? (
                <div className="space-y-3">
                  {inWorkIntents.map(intent => <IntentCard key={intent.id} intent={intent} />)}
                </div>
              ) : <EmptyState tab="in-work" />
            )}
            {activeTab === 'my-intents' && (
              loadingMyIntents ? <LoadingSkeleton /> : myIntents.length > 0 ? (
                <div className="space-y-3">
                  {myIntents.map(intent => <IntentCard key={intent.id} intent={intent} showDeleteButton={true} />)}
                </div>
              ) : <EmptyState tab="my-intents" />
            )}
            {activeTab === 'my-orders' && (
              loadingMyOrders ? <LoadingSkeleton /> : myOrders.length > 0 ? (
                <div className="space-y-3">
                  {myOrders.map(order => <OrderCard key={order.id} order={order} />)}
                </div>
              ) : <EmptyState tab="my-orders" />
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
        </div>
      </div>

      <button
        onClick={() => setIsRightPanelExpanded?.(false)}
        className="absolute top-1/2 -translate-y-1/2 left-[-1.25rem] w-10 h-10 flex items-center justify-center rounded-full bg-slate-800/80 hover:bg-slate-700/80 transition-colors"
        title="Collapse"
      >
        <ChevronLeft className="w-5 h-5 text-slate-300" />
      </button>

      {/* Intent detail modal */}
      <IntentDetailModal
        isOpen={isModalOpen}
        onClose={closeIntentModal}
        onStartWork={(intent) => handleStartWork(intent)}
        intent={selectedIntent ? { ...selectedIntent, skills: (selectedIntent as any).skills || selectedIntent.requiredSkills } as any : null}
        alreadyInWork={!!selectedIntent && inWorkIntents.some(i => i.id === selectedIntent.id)}
      />
      
      {/* Order detail modal */}
      <OrderDetailModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        order={selectedOrder}
      />
    </div>
  );
}