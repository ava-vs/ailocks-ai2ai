import React from 'react';
import { X, MapPin, Tag, Briefcase, Calendar, DollarSign, Target, CheckCircle, ArrowRight } from 'lucide-react';

// We'll need to move this interface to a shared types file later
interface IntentCard {
  id: string;
  title: string;
  description: string;
  category: string;
  requiredSkills: string[];
  budget?: string;
  timeline?: string;
  priority: string;
  matchScore: number;
  distance: string;
  targetCity?: string;
  targetCountry?: string;
}

interface IntentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartWork: (intent: IntentCard) => void;
  intent: IntentCard | null;
}

export default function IntentDetailModal({ isOpen, onClose, onStartWork, intent }: IntentDetailModalProps) {
  if (!isOpen || !intent) return null;

  const handleStartWorkClick = () => {
    onStartWork(intent);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-slate-800/90 border border-blue-500/30 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50 flex-shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-400" />
            <span>Intent Details</span>
          </h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-slate-700 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="mb-4">
            <h3 className="text-2xl font-bold text-white mb-2">{intent.title}</h3>
            <p className="text-gray-300 leading-relaxed">{intent.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
            <div className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-lg">
              <MapPin className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
              <div>
                <p className="text-gray-400">Location</p>
                <p className="text-white font-medium">{intent.targetCity}, {intent.targetCountry} ({intent.distance})</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-lg">
              <Tag className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
              <div>
                <p className="text-gray-400">Category</p>
                <p className="text-white font-medium">{intent.category}</p>
              </div>
            </div>
            {intent.budget && (
              <div className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-400 flex-shrink-0 mt-1" />
                <div>
                  <p className="text-gray-400">Budget</p>
                  <p className="text-white font-medium">{intent.budget}</p>
                </div>
              </div>
            )}
            {intent.timeline && (
              <div className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-lg">
                <Calendar className="w-5 h-5 text-purple-400 flex-shrink-0 mt-1" />
                <div>
                  <p className="text-gray-400">Timeline</p>
                  <p className="text-white font-medium">{intent.timeline}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-lg">
              <Target className="w-5 h-5 text-orange-400 flex-shrink-0 mt-1" />
              <div>
                <p className="text-gray-400">Priority</p>
                <p className="text-white font-medium capitalize">{intent.priority}</p>
              </div>
            </div>
             <div className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-teal-400 flex-shrink-0 mt-1" />
              <div>
                <p className="text-gray-400">Match Score</p>
                <p className="text-white font-medium">{intent.matchScore}%</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-white mb-3">Required Skills</h4>
            <div className="flex flex-wrap gap-2">
              {intent.requiredSkills.map(skill => (
                <span key={skill} className="bg-purple-500/20 text-purple-400 px-3 py-1.5 rounded-md text-sm font-medium border border-purple-500/30">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 mt-auto border-t border-slate-700/50 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 bg-slate-700 hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleStartWorkClick}
            className="px-6 py-2 rounded-lg text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <span>Take to "In Work"</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
} 