import React, { useState } from 'react';
import { Package, ChevronDown, ChevronUp, CheckCircle, Clock, DollarSign } from 'lucide-react';

interface OrderConfirmationCardProps {
  order: {
    id: string;
    title: string;
    description: string;
    milestones: {
      description: string;
      amount: number;
      deadline: string;
    }[];
    amount: number;
    currency: string;
  };
  onClose: () => void;
  onViewDetails?: () => void;
  onGoToOrders?: () => void;
}

export default function OrderConfirmationCard({ order, onClose, onViewDetails, onGoToOrders }: OrderConfirmationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="w-full bg-slate-800/90 backdrop-blur-sm border border-purple-500/30 rounded-lg overflow-hidden mb-4 animate-fadeIn">
      {/* Header with success message */}
      <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <span className="text-white font-medium">Order successfully created</span>
        </div>
        <button 
          onClick={onClose}
          className="text-white/60 hover:text-white transition-colors"
        >
          <span className="sr-only">Close</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Collapsed view */}
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-purple-400" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-medium text-white mb-1">{order.title}</h3>
            
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/70 mb-2">
              <div className="flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-purple-400" />
                <span>{order.currency} {order.amount}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>ID: {order.id}</span>
              </div>
            </div>
            
            <p className="text-sm text-white/60 line-clamp-2">
              {order.description}
            </p>
          </div>
        </div>
        
        {/* Toggle button */}
        <button 
          onClick={() => setIsExpanded(!isExpanded)} 
          className="w-full flex items-center justify-center gap-1 mt-2 py-1 text-sm text-white/50 hover:text-white/70 transition-colors"
        >
          {isExpanded ? (
            <>
              <span>Collapse</span>
              <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              <span>More details</span>
              <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
      
      {/* Expanded view with milestones */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1">
          <div className="border-t border-slate-700/50 pt-3">
            <h4 className="text-sm font-medium text-white/80 mb-2">Project milestones:</h4>
            <div className="space-y-2">
              {order.milestones.map((milestone, index) => (
                <div key={index} className="bg-slate-700/30 border border-slate-600/30 rounded p-2">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-white/80">{milestone.description}</span>
                    <span className="text-sm text-purple-400">{order.currency} {milestone.amount}</span>
                  </div>
                  <div className="text-xs text-white/50">
                    Deadline: {new Date(milestone.deadline).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 flex justify-end gap-2">
              <button 
                onClick={onViewDetails} 
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors"
              >
                View order
              </button>
              <button 
                onClick={onGoToOrders}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
              >
                Go to orders
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
