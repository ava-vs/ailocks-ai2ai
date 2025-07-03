import { useState, useEffect } from 'react';
import { ArrowLeft, Clock, MessageCircle, Target, User, Calendar, Filter, Search, ExternalLink, RotateCcw } from 'lucide-react';
import { useUserSession } from '@/hooks/useUserSession';

interface RecentActivity {
  id: string;
  type: 'chat' | 'intent' | 'profile' | 'search';
  title: string;
  description: string;
  timestamp: string;
  metadata?: {
    mode?: string;
    category?: string;
    messageCount?: number;
    searchQuery?: string;
  };
}

export default function RecentPage() {
  const { currentUser } = useUserSession();
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');

  useEffect(() => {
    fetchRecentActivities();
  }, [currentUser.id]);

  const fetchRecentActivities = async () => {
    setLoading(true);
    try {
      // For now, use mock data since we don't have a recent activities API yet
      setActivities(getMockActivities());
    } catch (error) {
      console.error('Failed to fetch recent activities:', error);
      setActivities(getMockActivities());
    } finally {
      setLoading(false);
    }
  };

  const getMockActivities = (): RecentActivity[] => [
    {
      id: '1',
      type: 'chat',
      title: 'Design Tour Conversation',
      description: 'Discussed creating design tours with Australian perspective in Rio',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      metadata: { mode: 'creator', messageCount: 12 }
    },
    {
      id: '2',
      type: 'intent',
      title: 'UX/UI Design for Fintech App',
      description: 'Viewed intent from Marco Silva about mobile banking application design',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      metadata: { category: 'Design' }
    },
    {
      id: '3',
      type: 'search',
      title: 'Design Opportunities Search',
      description: 'Searched for design collaboration opportunities in Rio de Janeiro',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      metadata: { searchQuery: 'design opportunities Rio' }
    },
    {
      id: '4',
      type: 'chat',
      title: 'Market Analysis Session',
      description: 'Analyzed fintech market trends in Brazil with Ailock',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      metadata: { mode: 'analyst', messageCount: 8 }
    },
    {
      id: '5',
      type: 'profile',
      title: 'Profile Update',
      description: 'Updated location settings and language preferences',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '6',
      type: 'intent',
      title: 'AI Startup Collaboration',
      description: 'Saved intent about building next-gen chatbot platform',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: { category: 'Technology' }
    },
    {
      id: '7',
      type: 'chat',
      title: 'Research Discussion',
      description: 'Explored market research opportunities in tech sector',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: { mode: 'researcher', messageCount: 15 }
    }
  ];

  const filteredActivities = activities.filter(activity => {
    const matchesSearch = activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         activity.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || activity.type === typeFilter;
    
    let matchesTime = true;
    if (timeFilter !== 'all') {
      const activityTime = new Date(activity.timestamp);
      const now = new Date();
      const diffHours = (now.getTime() - activityTime.getTime()) / (1000 * 60 * 60);
      
      switch (timeFilter) {
        case 'today':
          matchesTime = diffHours < 24;
          break;
        case 'week':
          matchesTime = diffHours < 24 * 7;
          break;
        case 'month':
          matchesTime = diffHours < 24 * 30;
          break;
      }
    }
    
    return matchesSearch && matchesType && matchesTime;
  });

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'chat': return MessageCircle;
      case 'intent': return Target;
      case 'profile': return User;
      case 'search': return Search;
      default: return Clock;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'chat': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'intent': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'profile': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'search': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const handleActivityClick = (activity: RecentActivity) => {
    switch (activity.type) {
      case 'chat':
        window.location.href = '/query-history';
        break;
      case 'intent':
        window.location.href = '/saved-intents';
        break;
      case 'profile':
        window.location.href = '/profile';
        break;
      case 'search':
        window.location.href = '/';
        break;
    }
  };

  const groupActivitiesByDate = (activities: RecentActivity[]) => {
    const groups: { [key: string]: RecentActivity[] } = {};
    
    activities.forEach(activity => {
      const date = new Date(activity.timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let groupKey;
      if (date.toDateString() === today.toDateString()) {
        groupKey = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        groupKey = 'Yesterday';
      } else {
        groupKey = date.toLocaleDateString();
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(activity);
    });
    
    return groups;
  };

  const groupedActivities = groupActivitiesByDate(filteredActivities);

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
            <h1 className="text-2xl font-bold text-white">Recent Activity</h1>
            <p className="text-white/60">Your recent interactions and activities</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchRecentActivities}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Refresh</span>
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
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50 focus:bg-white/10"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
          >
            <option value="all">All Types</option>
            <option value="chat">Conversations</option>
            <option value="intent">Intents</option>
            <option value="search">Searches</option>
            <option value="profile">Profile</option>
          </select>

          {/* Time Filter */}
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        ) : Object.keys(groupedActivities).length === 0 ? (
          <div className="text-center py-16">
            <Clock className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No recent activity</h3>
            <p className="text-white/60 mb-6">
              {searchTerm ? 'No activities match your search criteria' : 'Start using Ailocks to see your activity here'}
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              Start Exploring
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedActivities).map(([date, activities]) => (
              <div key={date}>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <span>{date}</span>
                </h3>
                
                <div className="space-y-3">
                  {activities.map((activity) => {
                    const IconComponent = getActivityIcon(activity.type);
                    return (
                      <div
                        key={activity.id}
                        onClick={() => handleActivityClick(activity)}
                        className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer group"
                      >
                        <div className="flex items-start space-x-4">
                          <div className={`p-2 rounded-lg border ${getActivityColor(activity.type)}`}>
                            <IconComponent className="w-4 h-4" />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="text-white font-medium group-hover:text-blue-400 transition-colors">
                                  {activity.title}
                                </h4>
                                <p className="text-white/70 text-sm mt-1">
                                  {activity.description}
                                </p>
                                
                                {activity.metadata && (
                                  <div className="flex items-center space-x-3 mt-2">
                                    {activity.metadata.mode && (
                                      <span className="text-xs text-white/50">
                                        Mode: {activity.metadata.mode}
                                      </span>
                                    )}
                                    {activity.metadata.category && (
                                      <span className="text-xs text-white/50">
                                        Category: {activity.metadata.category}
                                      </span>
                                    )}
                                    {activity.metadata.messageCount && (
                                      <span className="text-xs text-white/50">
                                        {activity.metadata.messageCount} messages
                                      </span>
                                    )}
                                    {activity.metadata.searchQuery && (
                                      <span className="text-xs text-white/50">
                                        Query: "{activity.metadata.searchQuery}"
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <span className="text-white/40 text-sm">
                                  {formatTimeAgo(activity.timestamp)}
                                </span>
                                <ExternalLink className="w-4 h-4 text-white/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}