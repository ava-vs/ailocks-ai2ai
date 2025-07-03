import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Calendar, MessageCircle, Clock, Trash2, RotateCcw, Filter, Download, Archive } from 'lucide-react';
import { useUserSession } from '@/hooks/useUserSession';
import { useLocation } from '@/hooks/useLocation';

interface ChatSession {
  id: string;
  mode: string;
  language: string;
  messageCount: number;
  lastMessage: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function QueryHistoryPage() {
  const { currentUser } = useUserSession();
  const location = useLocation();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);

  useEffect(() => {
    fetchChatHistory();
  }, [currentUser.id]);

  const fetchChatHistory = async () => {
    if (!currentUser.id || currentUser.id === 'loading') return;
    
    setLoading(true);
    try {
      const response = await fetch(`/.netlify/functions/chat-history?userId=${currentUser.id}`);
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      } else {
        // Fallback to mock data
        setSessions(getMockSessions());
      }
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
      setSessions(getMockSessions());
    } finally {
      setLoading(false);
    }
  };

  const getMockSessions = (): ChatSession[] => [
    {
      id: '1',
      mode: 'researcher',
      language: 'en',
      messageCount: 12,
      lastMessage: 'Find design opportunities in Rio de Janeiro',
      isActive: true,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    },
    {
      id: '2',
      mode: 'creator',
      language: 'en',
      messageCount: 8,
      lastMessage: 'Help me create a tour design concept',
      isActive: false,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '3',
      mode: 'analyst',
      language: 'en',
      messageCount: 15,
      lastMessage: 'Analyze market trends for fintech in Brazil',
      isActive: false,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.lastMessage.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         session.mode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMode = filterMode === 'all' || session.mode === filterMode;
    return matchesSearch && matchesMode;
  });

  const sortedSessions = [...filteredSessions].sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'messages':
        return b.messageCount - a.messageCount;
      default:
        return 0;
    }
  });

  const handleRestoreSession = async (sessionId: string) => {
    // Navigate to main chat with restored session
    window.location.href = `/?session=${sessionId}`;
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (confirm('Are you sure you want to delete this chat session?')) {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      setSelectedSessions(prev => prev.filter(id => id !== sessionId));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSessions.length === 0) return;
    if (confirm(`Delete ${selectedSessions.length} selected sessions?`)) {
      setSessions(prev => prev.filter(s => !selectedSessions.includes(s.id)));
      setSelectedSessions([]);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'researcher': return '🔍';
      case 'creator': return '🛠️';
      case 'analyst': return '📊';
      default: return '💬';
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'researcher': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'creator': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'analyst': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/10">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => window.location.href = '/'}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white/60 hover:text-white" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Query History</h1>
            <p className="text-white/60">Your conversation history with Ailock</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {selectedSessions.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center space-x-2 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete ({selectedSessions.length})</span>
            </button>
          )}
          <button className="flex items-center space-x-2 px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="p-6 border-b border-white/10">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50 focus:bg-white/10"
            />
          </div>

          {/* Mode Filter */}
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
          >
            <option value="all">All Modes</option>
            <option value="researcher">Researcher</option>
            <option value="creator">Creator</option>
            <option value="analyst">Analyst</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
          >
            <option value="recent">Most Recent</option>
            <option value="oldest">Oldest First</option>
            <option value="messages">Most Messages</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        ) : sortedSessions.length === 0 ? (
          <div className="text-center py-16">
            <MessageCircle className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No conversations found</h3>
            <p className="text-white/60 mb-6">
              {searchTerm ? 'Try adjusting your search terms' : 'Start a conversation with Ailock to see your history here'}
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              Start New Conversation
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {sortedSessions.map((session) => (
              <div
                key={session.id}
                className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all cursor-pointer group"
                onClick={() => handleRestoreSession(session.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedSessions.includes(session.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (e.target.checked) {
                          setSelectedSessions(prev => [...prev, session.id]);
                        } else {
                          setSelectedSessions(prev => prev.filter(id => id !== session.id));
                        }
                      }}
                      className="mt-1 w-4 h-4 text-blue-500 bg-transparent border-white/30 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium border ${getModeColor(session.mode)}`}>
                          {getModeIcon(session.mode)} {session.mode}
                        </span>
                        <span className="text-white/40 text-sm">{session.messageCount} messages</span>
                        {session.isActive && (
                          <span className="inline-flex items-center px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-xs">
                            Active
                          </span>
                        )}
                      </div>
                      
                      <p className="text-white font-medium mb-2 group-hover:text-blue-400 transition-colors">
                        {session.lastMessage}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-sm text-white/60">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>Created {formatTimeAgo(session.createdAt)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>Updated {formatTimeAgo(session.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestoreSession(session.id);
                      }}
                      className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors"
                      title="Restore session"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(session.id);
                      }}
                      className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                      title="Delete session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}