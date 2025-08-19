import { useState } from 'react';
import { X, Briefcase, DollarSign, Calendar, Users, Star, User, Edit, Trash2, ChevronRight, MessageCircle } from 'lucide-react';
import { useUserSession } from '@/hooks/useUserSession';
import { createPortal } from 'react-dom';

// Interface for milestone data structure
interface Milestone {
  id?: string;
  description: string;
  amount: number;
  deadline: string;
  status: 'pending' | 'in-progress' | 'completed';
}

// Interface for order data structure
interface OrderCard {
  id: string;
  title: string;
  description: string;
  status: string;
  progress: number;
  amount: number;
  currency: string;
  createdAt: string;
  milestones: Milestone[];
  // Optional fields
  fundingGoal?: number;
  cashback?: string;
  minContribution?: number;
  maxContribution?: number;
  reportingFrequency?: string;
  investorRequirements?: string;
  projectRisks?: string;
  investorCount?: number;
  daysLeft?: number;
  author?: {
    name: string;
    level?: number;
    rating?: number;
    projectCount?: number;
    avatar?: string;
    profession?: string;
  };
  recentInvestors?: Array<{
    id: string;
    name: string;
    amount: number;
    date: string;
    avatar?: string;
  }>;
}

// Props interface for OrderDetailModal component
interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderCard | null;
}

// Helper function to format date
const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch (error) {
    return dateString;
  }
};

export default function OrderDetailModal({ isOpen, onClose, order }: OrderDetailModalProps) {
  if (!isOpen || !order) return null;
  
  const { currentUser } = useUserSession();
  const [expandedSection, setExpandedSection] = useState<string | null>('stages');

  const toggleSection = (section: string) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };
  
  // Calculate funding percentage
  const fundingPercentage = order.fundingGoal ? Math.round((order.amount / order.fundingGoal) * 100) : 60;

  // Modal content
  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#121826] rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header with close button */}
        <div className="p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/20 rounded-lg">
              <Briefcase className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-700/50 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        {/* Main content with scroll */}
        <div className="flex-1 overflow-y-auto">
          {/* Project title and description */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-xl font-semibold text-white">{order.title}</h1>
              <div className="flex gap-2">
                <button className="p-1.5 rounded-full hover:bg-slate-700/50 transition-colors">
                  <Edit className="w-4 h-4 text-gray-400" />
                </button>
                <button className="p-1.5 rounded-full hover:bg-slate-700/50 transition-colors">
                  <Trash2 className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-4">{order.description}</p>
            
            {/* Funding progress */}
            <div className="flex items-center gap-2 mb-1.5 text-sm">
              <div className="text-green-400">{fundingPercentage}% funded</div>
            </div>
            <div className="w-full bg-slate-700/50 h-1.5 rounded-full mb-6">
              <div 
                className="bg-green-500 h-1.5 rounded-full" 
                style={{ width: `${fundingPercentage}%` }}
              ></div>
            </div>
            
            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {/* Funding */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2.5 hover:border-blue-500/50 hover:bg-slate-800/80 transition-all duration-200 cursor-default h-[72px] flex flex-col justify-between">
                <div className="text-xs text-slate-500">Funding</div>
                <div className="text-sm font-medium text-white">${order.amount.toLocaleString()} /</div>
                <div className="text-xs text-slate-400">${(order.fundingGoal || 8000).toLocaleString()}</div>
              </div>
              
              {/* Investors */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2.5 hover:border-blue-500/50 hover:bg-slate-800/80 transition-all duration-200 cursor-default h-[72px] flex flex-col justify-between">
                <div className="text-xs text-slate-500">Investors</div>
                <div className="text-sm font-medium text-white">{order.investorCount || 24}</div>
                <div className="text-xs text-slate-400">&nbsp;</div>
              </div>
              
              {/* Days left */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2.5 hover:border-blue-500/50 hover:bg-slate-800/80 transition-all duration-200 cursor-default h-[72px] flex flex-col justify-between">
                <div className="text-xs text-slate-500">Days left</div>
                <div className="text-sm font-medium text-white">{order.daysLeft || 14}</div>
                <div className="text-xs text-slate-400">&nbsp;</div>
              </div>
              
              {/* Cashback */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2.5 hover:border-blue-500/50 hover:bg-slate-800/80 transition-all duration-200 cursor-default h-[72px] flex flex-col justify-between">
                <div className="text-xs text-slate-500">Cashback</div>
                <div className="text-sm font-medium text-green-400">{order.cashback || '150%'}</div>
                <div className="text-xs text-slate-400">&nbsp;</div>
              </div>
              
              {/* Min contribution */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2.5 hover:border-blue-500/50 hover:bg-slate-800/80 transition-all duration-200 cursor-default h-[72px] flex flex-col justify-between">
                <div className="text-xs text-slate-500">Min contribution</div>
                <div className="text-sm font-medium text-white">${order.minContribution || 200}</div>
                <div className="text-xs text-slate-400">&nbsp;</div>
              </div>
              
              {/* Status */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2.5 hover:border-blue-500/50 hover:bg-slate-800/80 transition-all duration-200 cursor-default h-[72px] flex flex-col justify-between">
                <div className="text-xs text-slate-500">Status</div>
                <div className="text-sm font-medium text-blue-400">{order.status || 'Active'}</div>
                <div className="text-xs text-slate-400">&nbsp;</div>
              </div>
            </div>
            
            {/* Creator info */}
            <div className="flex items-center gap-3 mb-6 bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                {order.author?.avatar ? (
                  <img src={order.author.avatar} alt="Creator" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <User className="w-5 h-5 text-blue-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-white text-sm">{order.author?.name || 'Anonymous Creator'}</div>
                  <div className="flex items-center text-yellow-400 text-xs">
                    <Star className="w-3 h-3 mr-0.5 fill-yellow-400" />
                    <span>{order.author?.rating || 4.8}/5.0</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-blue-400">Level {order.author?.level || 3}</span>
                  <span className="text-slate-400">{order.author?.profession || 'Web Developer'}</span>
                  <span className="text-slate-400">{order.author?.projectCount || 12} projects</span>
                </div>
              </div>
            </div>
            
            {/* Implementation Stages */}
            <div className="mb-4">
              <button 
                onClick={() => toggleSection('stages')} 
                className="flex items-center justify-between w-full p-3 text-left bg-slate-800/50 border border-slate-700/50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-medium text-white">Implementation Stages</h3>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expandedSection === 'stages' ? 'transform rotate-90' : ''}`} />
              </button>
              {expandedSection === 'stages' && (
                <div className="mt-2 space-y-2">
                  {order.milestones.map((milestone, index) => (
                    <div key={index} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-sm">
                      <div className="flex justify-between mb-1">
                        <span className="text-white">{milestone.description}</span>
                        <span className="text-blue-400">${milestone.amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Deadline: {formatDate(milestone.deadline)}</span>
                        <span className={`${
                          milestone.status === 'completed' ? 'text-green-400' : 
                          milestone.status === 'in-progress' ? 'text-[rgb(34,197,94)]' : 'text-yellow-400'
                        }`}>
                          {milestone.status.charAt(0).toUpperCase() + milestone.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Recent Investors */}
            <div className="mb-4">
              <button 
                onClick={() => toggleSection('investors')} 
                className="flex items-center justify-between w-full p-3 text-left bg-slate-800/50 border border-slate-700/50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-medium text-white">Recent Investors</h3>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expandedSection === 'investors' ? 'transform rotate-90' : ''}`} />
              </button>
              {expandedSection === 'investors' && (
                <div className="mt-2 space-y-2">
                  {order.recentInvestors && order.recentInvestors.length > 0 ? (
                    order.recentInvestors.map((investor, index) => (
                      <div key={index} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                            {investor.avatar ? (
                              <img src={investor.avatar} alt={investor.name} className="w-full h-full object-cover rounded-full" />
                            ) : (
                              <User className="w-4 h-4 text-blue-400" />
                            )}
                          </div>
                          <div>
                            <div className="text-sm text-white">{investor.name}</div>
                            <div className="text-xs text-slate-400">{formatDate(investor.date)}</div>
                          </div>
                        </div>
                        <div className="text-sm font-medium text-green-400">
                          ${investor.amount.toLocaleString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-center">
                      <p className="text-sm text-slate-400">No investors yet</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Risks and Guarantees */}
            <div className="mb-4">
              <button 
                onClick={() => toggleSection('risks')} 
                className="flex items-center justify-between w-full p-3 text-left bg-slate-800/50 border border-slate-700/50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-medium text-white">Risks and Guarantees</h3>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expandedSection === 'risks' ? 'transform rotate-90' : ''}`} />
              </button>
              {expandedSection === 'risks' && (
                <div className="mt-2">
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                    <p className="text-sm text-slate-400">
                      {order.projectRisks || 'This project involves standard market risks. The creator has successfully completed similar projects in the past and has a proven track record.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Discussion - without collapsing */}
            <div className="mb-4">
              <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-medium text-white">Discussion</h3>
                </div>
                <div className="bg-slate-800/80 border border-slate-700/50 rounded-lg p-3 text-center mb-3">
                  <p className="text-sm text-slate-400 mb-2">No messages yet. Start the conversation!</p>
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Write a message..." 
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg py-2 px-3 text-sm text-white placeholder-slate-400"
                  />
                  <button className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-500 text-white p-1 rounded-md">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with buttons */}
        <div className="p-4 border-t border-slate-700/50 flex justify-between">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-gradient-to-r from-sky-600 to-slate-700 hover:from-sky-700 hover:to-slate-800 text-white rounded-full text-xs font-medium transition-all shadow-sm"
          >
            Close
          </button>
          <button
            className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-full text-xs font-medium transition-all shadow-sm flex items-center gap-1.5"
          >
            <DollarSign className="w-3.5 h-3.5" />
            Become an Investor ${order.minContribution ? order.minContribution.toLocaleString() + '+' : '200+'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
