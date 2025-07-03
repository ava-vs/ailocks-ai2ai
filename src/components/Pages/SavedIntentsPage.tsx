import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Star, MapPin, Calendar, Filter, Grid, List, Trash2, ExternalLink, Share2, Download } from 'lucide-react';
import { useUserSession } from '@/hooks/useUserSession';
import { useLocation } from '@/hooks/useLocation';

interface SavedIntent {
  id: string;
  title: string;
  description: string;
  category: string;
  requiredSkills: string[];
  budget?: string;
  timeline?: string;
  priority: string;
  distance: string;
  matchScore: number;
  userName: string;
  savedAt: string;
  targetCity?: string;
  targetCountry?: string;
}

export default function SavedIntentsPage() {
  const { currentUser } = useUserSession();
  const location = useLocation();
  const [savedIntents, setSavedIntents] = useState<SavedIntent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedIntents, setSelectedIntents] = useState<string[]>([]);

  useEffect(() => {
    fetchSavedIntents();
  }, [currentUser.id]);

  const fetchSavedIntents = async () => {
    setLoading(true);
    try {
      // For now, use mock data since we don't have a saved intents API yet
      setSavedIntents(getMockSavedIntents());
    } catch (error) {
      console.error('Failed to fetch saved intents:', error);
      setSavedIntents(getMockSavedIntents());
    } finally {
      setLoading(false);
    }
  };

  const getMockSavedIntents = (): SavedIntent[] => [
    {
      id: '1',
      title: 'UX/UI Design for Fintech App',
      description: 'Seeking a creative UX/UI designer for an innovative mobile banking application. Must have experience with financial services.',
      category: 'Design',
      requiredSkills: ['Figma', 'UX Research', 'Mobile Design', 'Fintech'],
      budget: '$45k',
      timeline: '3-4 months',
      priority: 'high',
      distance: '2.3 miles',
      matchScore: 95,
      userName: 'Marco Silva',
      savedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      targetCity: 'Rio de Janeiro',
      targetCountry: 'BR'
    },
    {
      id: '2',
      title: 'AI Startup Collaboration',
      description: 'Looking for AI developers to build next-gen chatbot platform with advanced NLP capabilities.',
      category: 'Technology',
      requiredSkills: ['React', 'Python', 'Machine Learning', 'NLP'],
      budget: '$75k',
      timeline: '6 months',
      priority: 'urgent',
      distance: '5.7 miles',
      matchScore: 88,
      userName: 'John Smith',
      savedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      targetCity: 'São Paulo',
      targetCountry: 'BR'
    },
    {
      id: '3',
      title: 'Market Research Project',
      description: 'Need experienced researcher for consumer behavior analysis in tech sector.',
      category: 'Research',
      requiredSkills: ['Analytics', 'Statistics', 'Survey Design'],
      budget: '$20k',
      timeline: '2-3 months',
      priority: 'medium',
      distance: 'Remote',
      matchScore: 82,
      userName: 'Anna Petrov',
      savedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  const categories = ['all', 'Design', 'Technology', 'Research', 'Marketing', 'Analytics'];

  const filteredIntents = savedIntents.filter(intent => {
    const matchesSearch = intent.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         intent.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         intent.requiredSkills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || intent.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const sortedIntents = [...filteredIntents].sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
      case 'match':
        return b.matchScore - a.matchScore;
      case 'budget':
        const budgetA = parseInt(a.budget?.replace(/[^0-9]/g, '') || '0');
        const budgetB = parseInt(b.budget?.replace(/[^0-9]/g, '') || '0');
        return budgetB - budgetA;
      case 'alphabetical':
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });

  const handleUnsaveIntent = (intentId: string) => {
    setSavedIntents(prev => prev.filter(intent => intent.id !== intentId));
    setSelectedIntents(prev => prev.filter(id => id !== intentId));
  };

  const handleBulkUnsave = () => {
    if (selectedIntents.length === 0) return;
    if (confirm(`Remove ${selectedIntents.length} intents from saved?`)) {
      setSavedIntents(prev => prev.filter(intent => !selectedIntents.includes(intent.id)));
      setSelectedIntents([]);
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'high': return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'low': return 'text-green-400 bg-green-500/20 border-green-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const IntentCard = ({ intent }: { intent: SavedIntent }) => (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            checked={selectedIntents.includes(intent.id)}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedIntents(prev => [...prev, intent.id]);
              } else {
                setSelectedIntents(prev => prev.filter(id => id !== intent.id));
              }
            }}
            className="mt-1 w-4 h-4 text-blue-500 bg-transparent border-white/30 rounded focus:ring-blue-500 focus:ring-2"
          />
          <div className="flex-1">
            <h3 className="text-white font-semibold text-lg mb-2 group-hover:text-blue-400 transition-colors">
              {intent.title}
            </h3>
            <p className="text-white/70 text-sm leading-relaxed mb-3">
              {intent.description}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => handleUnsaveIntent(intent.id)}
            className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
            title="Remove from saved"
          >
            <Star className="w-4 h-4 fill-current" />
          </button>
          <button className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors">
            <ExternalLink className="w-4 h-4" />
          </button>
          <button className="p-2 hover:bg-green-500/20 text-green-400 rounded-lg transition-colors">
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {intent.requiredSkills.slice(0, 3).map((skill) => (
          <span 
            key={skill}
            className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded-md text-xs font-medium border border-purple-500/30"
          >
            {skill}
          </span>
        ))}
        {intent.requiredSkills.length > 3 && (
          <span className="text-white/40 text-xs px-2 py-1">
            +{intent.requiredSkills.length - 3} more
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1 text-white/60">
            <MapPin className="w-3 h-3" />
            <span>{intent.distance}</span>
          </div>
          <span className={`px-2 py-1 rounded border text-xs ${getPriorityColor(intent.priority)}`}>
            {intent.priority}
          </span>
          <span className="text-emerald-400 font-medium">{intent.matchScore}% match</span>
        </div>
        
        <div className="text-white/40 text-xs">
          Saved {formatTimeAgo(intent.savedAt)}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
        <div className="text-white/60 text-sm">
          by {intent.userName}
        </div>
        <div className="flex items-center space-x-3">
          {intent.budget && (
            <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded border border-emerald-500/30 text-xs">
              {intent.budget}
            </span>
          )}
          {intent.timeline && (
            <span className="text-white/60 text-xs">{intent.timeline}</span>
          )}
        </div>
      </div>
    </div>
  );

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
            <h1 className="text-2xl font-bold text-white">Saved Intents</h1>
            <p className="text-white/60">Your bookmarked collaboration opportunities</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {selectedIntents.length > 0 && (
            <button
              onClick={handleBulkUnsave}
              className="flex items-center space-x-2 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Remove ({selectedIntents.length})</span>
            </button>
          )}
          
          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-l-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-500/20 text-blue-400' : 'text-white/60 hover:text-white'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-r-lg transition-colors ${viewMode === 'list' ? 'bg-blue-500/20 text-blue-400' : 'text-white/60 hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          
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
              placeholder="Search saved intents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50 focus:bg-white/10"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
          >
            <option value="recent">Recently Saved</option>
            <option value="match">Best Match</option>
            <option value="budget">Highest Budget</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        ) : sortedIntents.length === 0 ? (
          <div className="text-center py-16">
            <Star className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No saved intents</h3>
            <p className="text-white/60 mb-6">
              {searchTerm ? 'No intents match your search criteria' : 'Start saving intents to build your collection'}
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              Explore Intents
            </button>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid md:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-4'}>
            {sortedIntents.map((intent) => (
              <IntentCard key={intent.id} intent={intent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}