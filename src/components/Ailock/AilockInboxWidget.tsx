import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import type { AilockInteraction, InboxResponse } from '../../types/ailock-interactions';

interface AilockInboxWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export default function AilockInboxWidget({ isOpen, onClose, className = '' }: AilockInboxWidgetProps) {
  const { user } = useAuth();
  const [interactions, setInteractions] = useState<AilockInteraction[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedInteraction, setSelectedInteraction] = useState<AilockInteraction | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'collaboration'>('unread');

  // Загрузка inbox
  const loadInbox = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const status = filter === 'unread' ? 'sent' : undefined;
      const response = await fetch(
        `/.netlify/functions/ailock-interaction?limit=20&status=${status || ''}`,
        {
          headers: { 
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load inbox');
      }

      const data: InboxResponse = await response.json();
      setInteractions(data.interactions);
      setUnreadCount(data.unreadCount);
    } catch (error) {
      console.error('Failed to load Ailock inbox:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [user, filter]);

  // Пометить как прочитанное
  const markAsRead = async (interactionId: string) => {
    try {
      const response = await fetch('/.netlify/functions/ailock-interaction', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ interactionId })
      });

      if (response.ok) {
        setInteractions(prev => 
          prev.map(interaction => 
            interaction.id === interactionId 
              ? { ...interaction, status: 'read', readAt: new Date() }
              : interaction
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  // Отправить ответ
  const sendReply = async () => {
    if (!selectedInteraction || !replyMessage.trim()) return;

    try {
      const response = await fetch('/.netlify/functions/ailock-interaction', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          originalInteractionId: selectedInteraction.id,
          responseContent: replyMessage
        })
      });

      if (response.ok) {
        setReplyMessage('');
        setSelectedInteraction(null);
        toast.success('Reply sent successfully!');
        await loadInbox(); // Перезагружаем
      } else {
        throw new Error('Failed to send reply');
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
      toast.error('Failed to send reply');
    }
  };

  // Real-time обновления
  useEffect(() => {
    const handleAilockInboxUpdate = (event: CustomEvent) => {
      const { interactions: newInteractions, unreadCount: newUnreadCount } = event.detail;
      
      if (newInteractions) {
        setInteractions(prev => {
          const existingIds = new Set(prev.map(i => i.id));
          const uniqueNew = newInteractions.filter((i: AilockInteraction) => !existingIds.has(i.id));
          return [...uniqueNew, ...prev];
        });
      }
      
      if (typeof newUnreadCount === 'number') {
        setUnreadCount(newUnreadCount);
      }
    };

    const handleAilockNotification = (event: CustomEvent) => {
      const { interaction } = event.detail;
      
      // Добавляем новое уведомление в начало списка
      setInteractions(prev => [interaction, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Показываем toast уведомление
      toast(`💬 New message from ${interaction.fromAilock.name}`, {
        duration: 4000,
        icon: '🤖'
      });
    };

    window.addEventListener('ailock-inbox-updated', handleAilockInboxUpdate as any);
    window.addEventListener('ailock-notification', handleAilockNotification as any);

    return () => {
      window.removeEventListener('ailock-inbox-updated', handleAilockInboxUpdate as any);
      window.removeEventListener('ailock-notification', handleAilockNotification as any);
    };
  }, []);

  // Загрузка при открытии
  useEffect(() => {
    if (isOpen && user) {
      loadInbox();
    }
  }, [isOpen, user, loadInbox]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900">AI2AI Inbox</h2>
            {unreadCount > 0 && (
              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                {unreadCount} unread
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Filter */}
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value as any)}
              className="border rounded-lg px-3 py-1 text-sm"
            >
              <option value="unread">Unread</option>
              <option value="all">All Messages</option>
              <option value="collaboration">Collaborations</option>
            </select>
            
            <button
              onClick={loadInbox}
              disabled={loading}
              className="bg-blue-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Messages List */}
          <div className="w-1/2 border-r overflow-y-auto">
            {loading && interactions.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-gray-500">Loading messages...</div>
              </div>
            ) : interactions.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-gray-500">No messages yet</div>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {interactions.map((interaction) => (
                  <div
                    key={interaction.id}
                    onClick={() => {
                      setSelectedInteraction(interaction);
                      if (interaction.status === 'sent') {
                        markAsRead(interaction.id);
                      }
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedInteraction?.id === interaction.id
                        ? 'bg-blue-50 border-blue-200'
                        : interaction.status === 'sent'
                        ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-medium text-sm">
                        From: {(interaction as any).fromAilockName || 'Unknown Ailock'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(interaction.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-700 line-clamp-2">
                      {interaction.content}
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        interaction.type === 'collaboration_request' 
                          ? 'bg-green-100 text-green-800'
                          : interaction.type === 'clarify_intent'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {interaction.type.replace('_', ' ')}
                      </span>
                      
                      <span className={`text-xs ${
                        interaction.status === 'sent' ? 'text-yellow-600' : 'text-gray-500'
                      }`}>
                        {interaction.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Message Detail & Reply */}
          <div className="w-1/2 flex flex-col">
            {selectedInteraction ? (
              <>
                {/* Message Content */}
                <div className="flex-1 p-6 overflow-y-auto">
                  <div className="mb-4">
                    <h3 className="font-semibold text-lg mb-2">
                      Message from {(selectedInteraction as any).fromAilockName || 'Unknown Ailock'}
                    </h3>
                    <div className="text-sm text-gray-500 mb-4">
                      {selectedInteraction.type.replace('_', ' ')} • {' '}
                      {new Date(selectedInteraction.createdAt).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <p className="text-gray-800 whitespace-pre-wrap">
                      {selectedInteraction.content}
                    </p>
                  </div>
                  
                  {selectedInteraction.classification && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-2">Analysis</h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Urgency: {selectedInteraction.classification.urgency}</div>
                        <div>Category: {selectedInteraction.classification.category}</div>
                        {selectedInteraction.classification.estimatedResponseTime && (
                          <div>Expected response: {selectedInteraction.classification.estimatedResponseTime}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Reply Section */}
                <div className="border-t p-4">
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reply to this message:
                    </label>
                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Type your reply..."
                      className="w-full h-24 border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setSelectedInteraction(null)}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={sendReply}
                      disabled={!replyMessage.trim()}
                      className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Send Reply
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-gray-500 text-center">
                  <div className="text-4xl mb-2">💬</div>
                  <div>Select a message to view details</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 