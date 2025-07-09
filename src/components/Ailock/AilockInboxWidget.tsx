import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { AilockInboxService, type InboxState } from '@/lib/ailock/inbox-service';
import type { AilockInteraction } from '@/types/ailock-interactions';

interface AilockInboxWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
  anchorRef?: React.RefObject<HTMLElement>; // Новый проп для позиционирования
}

export default function AilockInboxWidget({ isOpen, onClose, className = '', anchorRef }: AilockInboxWidgetProps) {
  const [inboxState, setInboxState] = useState<InboxState>({
    interactions: [],
    unreadCount: 0,
    lastUpdate: new Date(0),
    isLoading: true, // Start with loading true
    error: null
  });
  const [selectedInteraction, setSelectedInteraction] = useState<AilockInteraction | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'collaboration'>('unread');
  const inboxService = AilockInboxService.getInstance();

  useEffect(() => {
    if (isOpen) {
      const unsubscribe = inboxService.subscribe(setInboxState);
      inboxService.backgroundRefresh(); // Trigger a refresh on open
      return () => unsubscribe();
    }
  }, [isOpen]);

  // 📢 Обработчик ошибок от оптимистичных обновлений
  useEffect(() => {
    const handleInboxError = (event: CustomEvent) => {
      const { message, action, interactionId, interactionIds } = event.detail;
      
      // Показываем toast с детальной информацией об ошибке
      toast.error(message, {
        duration: 4000,
        position: 'top-center',
        style: {
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          color: '#991B1B',
        },
        icon: '⚠️',
      });

      // Логируем детали для отладки
      console.warn('Inbox optimistic update failed:', {
        action,
        interactionId,
        interactionIds,
        message
      });
    };

    window.addEventListener('inbox-error', handleInboxError as EventListener);
    
    return () => {
      window.removeEventListener('inbox-error', handleInboxError as EventListener);
    };
  }, []);

  // Handler to mark a single message as read
  const handleMarkAsRead = (interactionId: string) => {
    inboxService.markAsRead(interactionId);
  };
  
  // Handler for retry mechanism
  const handleRetry = () => {
    inboxService.backgroundRefresh();
  };

  // Send reply logic (can also be moved to service later)
  const sendReply = async () => {
    if (!selectedInteraction || !replyMessage.trim()) return;
    // This part remains as it's a specific action, not just state display
    // ... same sendReply logic
  };

  const filteredInteractions = inboxState.interactions.filter(interaction => {
    if (filter === 'unread') return interaction.status === 'sent';
    if (filter === 'collaboration') return interaction.type === 'collaboration_request';
    return true;
  });

  // Детектируем мобильное устройство (tailwind md:breakpoint)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Для абсолютного позиционирования под кнопкой (десктоп)
  // Удаляем useEffect с getBoundingClientRect, используем tailwind-стили как в QuickStatus
  const dropdownClass =
    'absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-[480px] max-w-[90vw]';

  if (!isOpen) return null;

  // Backdrop для клика вне окна (десктоп)
  const Backdrop = () => (
    <div
      className="fixed inset-0 z-40"
      onClick={onClose}
      aria-label="Close inbox"
    />
  );

  // Skeleton Loader Component
  const SkeletonLoader = () => (
    <div className="animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center p-4 border-b border-gray-800">
          <div className="w-10 h-10 bg-gray-700 rounded-full mr-4"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      ))}
    </div>
  );
  
  // Error Display Component
  const ErrorDisplay = ({ onRetry }: { onRetry: () => void }) => (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <h3 className="text-lg font-semibold text-red-600 mb-2">Something went wrong</h3>
          <p className="text-gray-600 mb-4">{inboxState.error}</p>
          <button
              onClick={onRetry}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
              Try Again
          </button>
      </div>
  );

  return (
    <>
      {/* Backdrop только на десктопе */}
      {!isMobile && <Backdrop />}
      {/* Десктоп: абсолютное позиционирование под кнопкой */}
      {!isMobile ? (
        <div
          className={`${dropdownClass} ${className}`}
        >
          <div
            className="bg-[#23263a] text-slate-100 rounded-2xl shadow-2xl border border-blue-900 p-0 w-full"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-blue-800 bg-slate-800/95 rounded-t-2xl md:rounded-t-3xl shadow-md">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white drop-shadow">AI2AI Inbox</h2>
                {inboxState.unreadCount > 0 && (
                  <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full shadow">
                    {inboxState.unreadCount} unread
                  </span>
                )}
                {inboxState.isLoading && (
                  <span className="bg-blue-900 text-blue-300 text-xs px-2 py-1 rounded-full animate-pulse">
                    Updating...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <select 
                  value={filter} 
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="border border-gray-700 bg-slate-900 text-slate-100 rounded-lg px-3 py-1 text-sm focus:outline-none"
                >
                  <option value="unread">Unread</option>
                  <option value="all">All Messages</option>
                  <option value="collaboration">Collaborations</option>
                </select>
                <button
                  onClick={() => inboxService.backgroundRefresh()}
                  disabled={inboxState.isLoading}
                  className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 shadow"
                >
                  {inboxState.isLoading ? 'Loading...' : 'Refresh'}
                </button>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-white text-2xl font-bold px-2"
                >
                  ×
                </button>
              </div>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-hidden flex bg-[#23263a] rounded-b-2xl md:rounded-b-3xl">
              {/* List Panel */}
              <div className="w-1/3 border-r border-blue-900 bg-slate-900/95 overflow-y-auto">
                 {inboxState.isLoading && <SkeletonLoader />}
                 {!inboxState.isLoading && inboxState.error && <ErrorDisplay onRetry={handleRetry} />}
                 {!inboxState.isLoading && !inboxState.error && filteredInteractions.length === 0 && (
                    <div className="text-center p-8 text-gray-500">No messages found.</div>
                 )}
                 {!inboxState.isLoading && !inboxState.error && (
                  <ul className="max-h-[480px] overflow-y-auto">
                    {filteredInteractions.map(interaction => (
                      <li 
                        key={interaction.id}
                        onClick={() => {
                          setSelectedInteraction(interaction);
                          if (interaction.status === 'sent') {
                            handleMarkAsRead(interaction.id);
                          }
                        }}
                        className={`p-4 cursor-pointer hover:bg-slate-800/80 transition-colors border-b border-blue-900 ${selectedInteraction?.id === interaction.id ? 'bg-blue-900/80' : ''} ${interaction.status === 'read' ? 'opacity-75' : ''}`}
                      >
                        <div className="font-bold text-white">
                          {interaction.fromAilockName || 'Unknown Sender'}
                          {interaction.fromAilockLevel && (
                            <span className="text-xs text-blue-400 ml-1">Lv.{interaction.fromAilockLevel}</span>
                          )}
                        </div>
                        <div className="text-sm text-blue-400 font-medium mb-1">
                          {interaction.intentTitle ? `📋 ${interaction.intentTitle}` : '💬 Direct Message'}
                        </div>
                        <div className="text-sm text-slate-200 truncate">{interaction.content}</div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-gray-400">
                            {new Date(interaction.createdAt).toLocaleDateString('ru-RU', { 
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {interaction.status === 'sent' && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                          {interaction.status === 'read' && (
                            <div className="text-xs text-green-400">✓ Read</div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                 )}
              </div>
              {/* Detail Panel */}
              <div className="w-2/3 p-4 md:p-6 flex flex-col bg-slate-900/90 rounded-br-2xl md:rounded-br-3xl shadow-inner border-l border-blue-900">
                {selectedInteraction ? (
                  <>
                    <div className="flex-1">
                      <div className="border-b border-blue-900 pb-4 mb-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold text-white drop-shadow">
                            {selectedInteraction.fromAilockName || 'Unknown Sender'}
                            {selectedInteraction.fromAilockLevel && (
                              <span className="text-sm text-blue-400 ml-2">Level {selectedInteraction.fromAilockLevel}</span>
                            )}
                          </h3>
                          <span className="text-sm text-gray-400">
                            {new Date(selectedInteraction.createdAt).toLocaleDateString('ru-RU', { 
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {selectedInteraction.intentTitle && (
                          <div className="flex items-center mt-2 p-2 bg-blue-900/80 rounded-lg">
                            <span className="text-sm font-medium text-blue-300">
                              📋 Связано с интентом: {selectedInteraction.intentTitle}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center mt-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium shadow ${
                            selectedInteraction.type === 'collaboration_request' ? 'bg-green-900 text-green-300' :
                            selectedInteraction.type === 'clarify_intent' ? 'bg-blue-900 text-blue-300' :
                            selectedInteraction.type === 'provide_info' ? 'bg-purple-900 text-purple-300' :
                            'bg-gray-800 text-gray-200'
                          }`}>
                            {selectedInteraction.type === 'collaboration_request' ? '🤝 Предложение сотрудничества' :
                             selectedInteraction.type === 'clarify_intent' ? '❓ Уточнение интента' :
                             selectedInteraction.type === 'provide_info' ? '💡 Предоставление информации' :
                             '💬 Ответ'}
                          </span>
                        </div>
                      </div>
                      <div className="prose prose-sm max-w-none text-slate-100">
                        <p className="text-slate-100 leading-relaxed">{selectedInteraction.content}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <textarea 
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Type your reply..."
                        className="w-full border border-gray-700 bg-slate-800 text-slate-100 rounded p-2"
                      ></textarea>
                      <button 
                        onClick={sendReply}
                        className="bg-green-600 text-white px-4 py-2 rounded mt-2 hover:bg-green-700 shadow"
                      >
                        Send Reply
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-400 self-center">Select a message to view details.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Мобильная версия — полноэкранная, как раньше
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center px-2 md:px-0 ${className}`}
          style={{ background: 'rgba(16,18,27,0.85)' }}
        >
          <div
            className="w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl bg-[#23263a] text-slate-100 rounded-2xl md:rounded-3xl md:h-[80vh] md:my-12"
            style={{ boxShadow: '0 8px 32px 0 rgba(0,0,0,0.55)', border: '1.5px solid #23263a' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-blue-800 bg-slate-800/95 rounded-t-2xl md:rounded-t-3xl shadow-md">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white drop-shadow">AI2AI Inbox</h2>
                {inboxState.unreadCount > 0 && (
                  <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full shadow">
                    {inboxState.unreadCount} unread
                  </span>
                )}
                {inboxState.isLoading && (
                  <span className="bg-blue-900 text-blue-300 text-xs px-2 py-1 rounded-full animate-pulse">
                    Updating...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <select 
                  value={filter} 
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="border border-gray-700 bg-slate-900 text-slate-100 rounded-lg px-3 py-1 text-sm focus:outline-none"
                >
                  <option value="unread">Unread</option>
                  <option value="all">All Messages</option>
                  <option value="collaboration">Collaborations</option>
                </select>
                <button
                  onClick={() => inboxService.backgroundRefresh()}
                  disabled={inboxState.isLoading}
                  className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 shadow"
                >
                  {inboxState.isLoading ? 'Loading...' : 'Refresh'}
                </button>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-white text-2xl font-bold px-2"
                >
                  ×
                </button>
              </div>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-hidden flex bg-[#23263a] rounded-b-2xl md:rounded-b-3xl">
              {/* List Panel */}
              <div className="w-1/3 border-r border-blue-900 bg-slate-900/95 overflow-y-auto">
                 {inboxState.isLoading && <SkeletonLoader />}
                 {!inboxState.isLoading && inboxState.error && <ErrorDisplay onRetry={handleRetry} />}
                 {!inboxState.isLoading && !inboxState.error && filteredInteractions.length === 0 && (
                    <div className="text-center p-8 text-gray-500">No messages found.</div>
                 )}
                 {!inboxState.isLoading && !inboxState.error && (
                  <ul>
                    {filteredInteractions.map(interaction => (
                      <li 
                        key={interaction.id}
                        onClick={() => {
                          setSelectedInteraction(interaction);
                          if (interaction.status === 'sent') {
                            handleMarkAsRead(interaction.id);
                          }
                        }}
                        className={`p-4 cursor-pointer hover:bg-slate-800/80 transition-colors border-b border-blue-900 ${selectedInteraction?.id === interaction.id ? 'bg-blue-900/80' : ''} ${interaction.status === 'read' ? 'opacity-75' : ''}`}
                      >
                        <div className="font-bold text-white">
                          {interaction.fromAilockName || 'Unknown Sender'}
                          {interaction.fromAilockLevel && (
                            <span className="text-xs text-blue-400 ml-1">Lv.{interaction.fromAilockLevel}</span>
                          )}
                        </div>
                        <div className="text-sm text-blue-400 font-medium mb-1">
                          {interaction.intentTitle ? `📋 ${interaction.intentTitle}` : '💬 Direct Message'}
                        </div>
                        <div className="text-sm text-slate-200 truncate">{interaction.content}</div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-gray-400">
                            {new Date(interaction.createdAt).toLocaleDateString('ru-RU', { 
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {interaction.status === 'sent' && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                          {interaction.status === 'read' && (
                            <div className="text-xs text-green-400">✓ Read</div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                 )}
              </div>
              {/* Detail Panel */}
              <div className="w-2/3 p-4 md:p-6 flex flex-col bg-slate-900/90 rounded-br-2xl md:rounded-br-3xl shadow-inner border-l border-blue-900">
                {selectedInteraction ? (
                  <>
                    <div className="flex-1">
                      <div className="border-b border-blue-900 pb-4 mb-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold text-white drop-shadow">
                            {selectedInteraction.fromAilockName || 'Unknown Sender'}
                            {selectedInteraction.fromAilockLevel && (
                              <span className="text-sm text-blue-400 ml-2">Level {selectedInteraction.fromAilockLevel}</span>
                            )}
                          </h3>
                          <span className="text-sm text-gray-400">
                            {new Date(selectedInteraction.createdAt).toLocaleDateString('ru-RU', { 
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {selectedInteraction.intentTitle && (
                          <div className="flex items-center mt-2 p-2 bg-blue-900/80 rounded-lg">
                            <span className="text-sm font-medium text-blue-300">
                              📋 Связано с интентом: {selectedInteraction.intentTitle}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center mt-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium shadow ${
                            selectedInteraction.type === 'collaboration_request' ? 'bg-green-900 text-green-300' :
                            selectedInteraction.type === 'clarify_intent' ? 'bg-blue-900 text-blue-300' :
                            selectedInteraction.type === 'provide_info' ? 'bg-purple-900 text-purple-300' :
                            'bg-gray-800 text-gray-200'
                          }`}>
                            {selectedInteraction.type === 'collaboration_request' ? '🤝 Предложение сотрудничества' :
                             selectedInteraction.type === 'clarify_intent' ? '❓ Уточнение интента' :
                             selectedInteraction.type === 'provide_info' ? '💡 Предоставление информации' :
                             '💬 Ответ'}
                          </span>
                        </div>
                      </div>
                      <div className="prose prose-sm max-w-none text-slate-100">
                        <p className="text-slate-100 leading-relaxed">{selectedInteraction.content}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <textarea 
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Type your reply..."
                        className="w-full border border-gray-700 bg-slate-800 text-slate-100 rounded p-2"
                      ></textarea>
                      <button 
                        onClick={sendReply}
                        className="bg-green-600 text-white px-4 py-2 rounded mt-2 hover:bg-green-700 shadow"
                      >
                        Send Reply
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-400 self-center">Select a message to view details.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 