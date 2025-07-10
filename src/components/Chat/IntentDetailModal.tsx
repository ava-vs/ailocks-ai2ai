import { useEffect, useState } from 'react';
import { X, MapPin, Tag, Briefcase, Calendar, DollarSign, Target, CheckCircle, ArrowRight, Loader2, Send, MessageCircle } from 'lucide-react';
import { sendAilockMessage, replyAilockMessage, getAilockProfileByUser, getIntentInteractions } from '../../lib/api';
import { useUserSession } from '@/hooks/useUserSession';
import AilockQuickStatus from '../Ailock/AilockQuickStatus';
import { createPortal } from 'react-dom';
import type { AilockInteraction } from '@/types/ailock-interactions';

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

const Avatar = ({ name, onClick }: { name: string, onClick?: () => void }) => (
  <div
    className={`w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white uppercase flex-shrink-0 ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
  >
    {name?.charAt(0) || 'A'}
  </div>
);

export default function IntentDetailModal({ isOpen, onClose, onStartWork, intent, alreadyInWork = false }: IntentDetailModalProps) {
  if (!isOpen || !intent) return null;

  const { currentUser } = useUserSession();
  const [currentUserAilockId, setCurrentUserAilockId] = useState<string | null>(null);
  const [authorAilockId, setAuthorAilockId] = useState<string | null>(null);

  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<AilockInteraction | null>(null);
  const [authorProfile, setAuthorProfile] = useState<any | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [interactions, setInteractions] = useState<AilockInteraction[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!intent?.id || !currentUser?.id) return;

      setIsLoadingMessages(true);
      setError(null);

      try {
        // Fetch profiles and messages in parallel
        const [authorProf, currentUserProf, fetchedInteractions] = await Promise.all([
          intent.userId ? getAilockProfileByUser(intent.userId) : Promise.resolve(null),
          getAilockProfileByUser(currentUser.id),
          getIntentInteractions(intent.id)
        ]);

        if (authorProf) {
          setAuthorProfile(authorProf);
          setAuthorAilockId(authorProf.id);
        }

        if (currentUserProf) {
          setCurrentUserAilockId(currentUserProf.id);
        }

        setInteractions(fetchedInteractions.sort((a: AilockInteraction, b: AilockInteraction) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));

      } catch (err: any) {
        setError(err.message || 'Failed to load discussion.');
        console.error(err);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    if (isOpen) {
      loadData();
    }
  }, [isOpen, intent, currentUser]);

  const handleSend = async () => {
    const targetAilockId = replyTo ? (replyTo.fromAilockId === currentUserAilockId ? replyTo.toAilockId : replyTo.fromAilockId) : authorAilockId;

    if (!targetAilockId || !message.trim()) return;

    setSending(true);
    try {
      let newInteraction: AilockInteraction | null = null;
      if (replyTo) {
        const res = await replyAilockMessage({
          originalInteractionId: replyTo.id,
          responseContent: message.trim()
        });
        newInteraction = res.response;
        setReplyTo(null);
      } else {
        const res = await sendAilockMessage({
          toAilockId: targetAilockId,
          message: message.trim(),
          intentId: intent.id,
          type: 'collaboration_request'
        });
        newInteraction = res.interaction;
      }
      if (newInteraction) {
        setInteractions(prev => [...prev, newInteraction!]);
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
            <div className="max-h-56 overflow-y-auto space-y-4 mb-3 border border-slate-700/50 rounded-lg p-3 bg-slate-700/30">
              {isLoadingMessages && <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>}
              {error && <p className="text-red-400 text-center text-sm">{error}</p>}
              {!isLoadingMessages && !error && interactions.length === 0 && (
                <p className="text-gray-400 text-center text-sm">No messages yet. Start the conversation!</p>
              )}
              {!isLoadingMessages && !error && interactions.map((item) => {
                const isCurrentUser = item.fromAilockId === currentUserAilockId;
                const isSelected = replyTo?.id === item.id;

                const getBubbleContent = () => (
                    <div
                      onClick={() => setReplyTo(isSelected ? null : item)}
                      className={`flex flex-col w-full max-w-xs leading-1.5 p-3 rounded-xl cursor-pointer transition-colors ${
                        isCurrentUser
                          ? 'bg-blue-600 rounded-br-none'
                          : 'bg-slate-600 rounded-bl-none'
                      } ${isSelected ? 'ring-2 ring-blue-400' : ''}`}
                    >
                      <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <span className="text-sm font-semibold text-white">{isCurrentUser ? "You" : (item.fromAilockName || 'Ailock')}</span>
                        <span className="text-xs font-normal text-gray-300">{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {item.parentInteractionId && (
                        <div className="text-xs italic text-gray-300 my-1 border-l-2 border-gray-500 pl-2 line-clamp-2 bg-black/20 p-1 rounded">
                          Replying to: {interactions.find(i => i.id === item.parentInteractionId)?.content.slice(0,50) || '...'}
                        </div>
                      )}
                      <p className="text-sm font-normal py-2 text-white">{item.content}</p>
                    </div>
                );

                return (
                  <div key={item.id} className={`flex items-end gap-2.5 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                    {!isCurrentUser && <Avatar name={item.fromAilockName || 'A'} onClick={() => { setAuthorProfile({ name: item.fromAilockName }); setShowProfileModal(true) }}/>}
                    {getBubbleContent()}
                    {isCurrentUser && <Avatar name={'You'} />}
                  </div>
                );
              })}
            </div>
            {replyTo && (
              <div className="mb-2 text-xs text-blue-300 flex items-center gap-2">
                <ArrowRight className="w-3 h-3" /> Replying to: <span className="italic truncate max-w-[12rem]">{replyTo.content}</span>
                <button className="text-red-400 hover:text-red-300" onClick={() => setReplyTo(null)} title="Cancel reply"><X className="w-3 h-3"/></button>
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                placeholder={replyTo ? `Replying to ${replyTo.fromAilockName}...` : "Write a message…"}
                className="flex-1 rounded-lg bg-slate-700/60 text-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSend}
                disabled={!message.trim() || sending || (!authorAilockId && !replyTo)}
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
      {/* Profile quick modal */}
      <AilockQuickStatus
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        profile={authorProfile}
        onOpenFullProfile={() => {
            if(authorProfile?.userId) window.open(`/profile/${authorProfile.userId}`);
        }}
      />
    </div>
  );

  return createPortal(modalContent, document.body);
} 