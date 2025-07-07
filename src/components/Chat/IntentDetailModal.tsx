import React, { useEffect, useState } from 'react';
import { X, MapPin, Tag, Briefcase, Calendar, DollarSign, Target, CheckCircle, ArrowRight, Loader2, Send, MessageCircle } from 'lucide-react';
import { sendAilockMessage, replyAilockMessage, getAilockProfileByUser, fetchInboxInteractions } from '../../lib/api';
import { createPortal } from 'react-dom';

// We'll need to move this interface to a shared types file later
interface IntentCard {
  userId?: string;
  id: string;
  title: string;
  description: string;
  category: string;
  skills: string[];
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
  alreadyInWork?: boolean;
}

export default function IntentDetailModal({ isOpen, onClose, onStartWork, intent, alreadyInWork = false }: IntentDetailModalProps) {
  if (!isOpen || !intent) return null;

  const [authorAilockId, setAuthorAilockId] = useState<string | null>(null);
  const [thread, setThread] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<any | null>(null);

  // Load author Ailock ID & thread on mount/open
  useEffect(() => {
    const load = async () => {
      try {
        if (intent.userId) {
          const profile = await getAilockProfileByUser(intent.userId);
          setAuthorAilockId(profile.id);
        }
        const inbox = await fetchInboxInteractions(100);
        const intentThread = inbox.filter((i: any) => i.intentId === intent.id);
        setThread(intentThread);
      } catch (err) {
        console.warn('Failed to load intent thread:', err);
      }
    };
    load();
  }, [intent]);

  const handleSend = async () => {
    if (!authorAilockId || !message.trim()) return;
    setSending(true);
    try {
      if (replyTo) {
        const res = await replyAilockMessage({
          originalInteractionId: replyTo.id,
          responseContent: message.trim()
        });
        setThread(prev => [res.response, ...prev]);
        setReplyTo(null);
      } else {
        const res = await sendAilockMessage({
          toAilockId: authorAilockId,
          message: message.trim(),
          intentId: intent.id,
          type: 'collaboration_request'
        });
        setThread(prev => [res.interaction, ...prev]);
      }
      setMessage('');
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleStartWorkClick = () => {
    onStartWork(intent);
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[1000] animate-fade-in">
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

        <div className="p-6 overflow-y-auto space-y-8">
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
              {(intent.skills ?? []).map((skill, idx) => (
                <span key={`${skill}-${idx}`} className="bg-purple-500/20 text-purple-400 px-3 py-1.5 rounded-md text-sm font-medium border border-purple-500/30">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Messaging section */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2"><MessageCircle className="w-5 h-5"/>Discussion</h4>
            <div className="max-h-56 overflow-y-auto space-y-3 mb-3 border border-slate-700/50 rounded-lg p-3 bg-slate-700/30">
              {thread.length === 0 && (
                <p className="text-gray-400 text-sm">No messages yet.</p>
              )}
              {thread.map((item) => {
                const isAuthor = item.fromAilockId === authorAilockId;
                const isSelected = replyTo?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setReplyTo(isSelected ? null : item)}
                    className={`p-2 rounded-md text-sm cursor-pointer transition-colors ${isAuthor ? 'bg-slate-600/60' : 'bg-blue-600/30 ml-auto'} ${isSelected ? 'ring-2 ring-blue-400' : ''}`}
                  >
                    <p className="whitespace-pre-wrap text-gray-100">{item.content}</p>
                    <span className="text-gray-400 text-xs">{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
            {replyTo && (
              <div className="mb-2 text-xs text-blue-300 flex items-center gap-2">
                <ArrowRight className="w-3 h-3" /> Replying to: <span className="italic truncate max-w-[12rem]">{replyTo.content}</span>
                <button className="text-red-400" onClick={() => setReplyTo(null)} title="Cancel reply"><X /></button>
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                placeholder="Write a message…"
                className="flex-1 rounded-lg bg-slate-700/60 text-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSend}
                disabled={!message.trim() || sending || !authorAilockId}
                className="p-3 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center"
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5"/>}
              </button>
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
          {!alreadyInWork && (
            <button
              onClick={handleStartWorkClick}
              className="px-6 py-2 rounded-lg text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <span>Take to "In Work"</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
} 