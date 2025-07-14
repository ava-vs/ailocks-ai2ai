'use client';

import { useConversation } from '@elevenlabs/react';
import { useCallback, useEffect } from 'react';
import { searchIntents } from '../lib/api';
import { useAilock } from '../hooks/useAilock';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

const AGENT_ID = import.meta.env.PUBLIC_AGENT_ID || import.meta.env.AGENT_ID;

const getSignedUrl = async (): Promise<string> => {
  const response = await fetch('/.netlify/functions/get-elevenlabs-signed-url', {
    credentials: 'include'
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to get signed URL');
  }
  const { signedUrl } = await response.json();
  return signedUrl;
};

export default function VoiceAgentWidget() {
  const { profile: ailockProfile, gainXp } = useAilock();
  const { user } = useAuth();

  const conversation = useConversation({
    onConnect: () => {
      console.log('✅ Voice agent connected');
      toast.success('✅ Ailock Online!');
      window.dispatchEvent(new CustomEvent('voice-status-update', { detail: { status: 'idle' } }));
    },
    onDisconnect: () => {
      console.log('❌ Voice agent disconnected');
      toast('🔴 Ailock Off!');
      // Принудительно устанавливаем статус idle при отключении
      window.dispatchEvent(new CustomEvent('voice-status-update', { detail: { status: 'idle' } }));
    },
    onMessage: (message: any) => {
      console.log('📨 Dispatching voice message to main chat:', message);
      window.dispatchEvent(new CustomEvent('add-message-to-chat', { detail: message }));
      if (message.source === 'user' && ailockProfile) {
        gainXp('voice_message_sent');
      }
    },
    onError: (error: any) => {
      console.error('💥 Voice agent error:', error);
      const errorMessage = error ? String(error) : 'Unknown error';
      toast.error('❌ Error: ' + errorMessage);
    },
    clientTools: {
      search_intents: async ({ query }: any) => {
        console.log(`[Tool] 'search_intents' called with query: \"${query}\"`);

        if (typeof query !== 'string' || !query.trim()) {
          console.warn('[Tool] search_intents called with an invalid query.');
          return "Please provide a valid search query to find intents.";
        }

        try {
          console.log(`[Tool] Starting search for: \"${query}\"`);
          const results = await searchIntents(query);
          console.log(`[Tool] Search completed successfully. Found ${results.length} results.`);
          
          // Отправляем события для UI только если есть результаты
          if (results && results.length > 0) {
            window.dispatchEvent(new CustomEvent('voice-search-results', { detail: { query, results } }));
            window.dispatchEvent(new CustomEvent('voice-intents-found', { detail: { intents: results, query, source: 'voice' } }));
            
            return `Found ${results.length} collaboration opportunities for \"${query}\". Results have been displayed in the chat interface.`;
          } else {
            return `No collaboration opportunities found for \"${query}\". Try using different keywords or broader search terms.`;
          }
          
        } catch (error) {
          console.error('[Tool] search_intents error:', error);
          
          // Предоставляем полезную обратную связь пользователю вместо технических деталей
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          if (errorMessage.includes('timeout') || errorMessage.includes('OpenAI API timeout')) {
            return "Search is taking longer than expected due to high demand. Please try again in a moment or use simpler search terms.";
          } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
            return "Connection issue occurred while searching. Please check your internet connection and try again.";
          } else {
            return "Search service is temporarily unavailable. Please try again later or contact support if the issue persists.";
          }
        }
      },
      create_intent: async (intentData: any) => {
        console.log('[Tool] "create_intent" called with data:', intentData);

        // Validate basic shape of incoming data
        if (!intentData || typeof intentData !== 'object') {
          console.warn('[Tool] create_intent called with invalid data.');
          return 'Please provide valid intent data to create an intent.';
        }

        const userId = (user as any)?.id;
        if (!userId) {
          console.warn('[Tool] User not authenticated, cannot create intent.');
          return 'You need to be signed in to create intents.';
        }

        try {
          const response = await fetch('/.netlify/functions/intents-create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              userId,
              // Flatten the incoming payload – ElevenLabs forwards all arguments under intentData
              ...intentData
            })
          });

          const data = await response.json();

          if (!response.ok) {
            console.error('[Tool] create_intent failed:', data);
            return `Failed to create intent: ${data.error || 'Unknown error.'}`;
          }

          // Broadcast the new intent so that UI components (chat, panels) can refresh
          window.dispatchEvent(
            new CustomEvent('intentCreated', {
              detail: {
                ...data.intent,
                userId,
                userName: (user as any)?.name || (user as any)?.email || 'You',
                isOwn: true
              }
            })
          );

          // Grant XP for successfully creating an intent via voice
          try {
            await gainXp('intent_created', { intentId: data.intent.id });
          } catch (xpErr) {
            console.warn('[Tool] XP gain failed:', xpErr);
          }

          console.log('[Tool] Intent created successfully via voice agent:', data.intent);
          return `Intent "${data.intent.title}" created successfully.`;
        } catch (err: any) {
          console.error('[Tool] create_intent encountered an error:', err);
          return `Error creating intent: ${err?.message || 'Unknown error.'}`;
        }
      },
      send_ailock_message: async ({ toAilockName, message, type }: any) => {
        console.log(`[Tool] 'send_ailock_message' called to ${toAilockName} with message: "${message}"`);

        if (!toAilockName || !message || !type) {
          return "Please provide the recipient Ailock name, message content, and interaction type.";
        }

        const userId = (user as any)?.id;
        if (!userId) {
          return 'You need to be signed in to send messages to other Ailocks.';
        }

        try {
          // Сначала найдем Ailock по имени
          const searchResponse = await fetch(`/.netlify/functions/ailock-interaction?action=search&name=${encodeURIComponent(toAilockName)}`, {
            credentials: 'include'
          });
          const searchData = await searchResponse.json();
          
          if (!searchData.ailocks || searchData.ailocks.length === 0) {
            return `I couldn't find an Ailock named "${toAilockName}". Please check the name and try again.`;
          }

          const targetAilock = searchData.ailocks[0];
          
          // Отправляем сообщение
          const response = await fetch('/.netlify/functions/ailock-interaction', {
            method: 'POST',
            credentials: 'include',
            headers: { 
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              toAilockId: targetAilock.id,
              message,
              type
            })
          });

          const data = await response.json();

          if (!response.ok) {
            return `Failed to send message: ${data.error || 'Unknown error'}`;
          }

          // Начисляем XP за отправку сообщения
          try {
            await gainXp('ailock_message_sent', { 
              interactionId: data.interaction.id,
              targetAilockId: targetAilock.id
            });
          } catch (xpErr) {
            console.warn('[Tool] XP gain failed for message sent:', xpErr);
          }

          return `Message sent successfully to ${toAilockName}. ${data.estimatedResponseTime ? `Expected response time: ${data.estimatedResponseTime}` : ''}`;
        } catch (err: any) {
          console.error('[Tool] send_ailock_message error:', err);
          return `Error sending message: ${err?.message || 'Unknown error'}`;
        }
      },
      check_ailock_inbox: async ({ limit = 5 }: { limit?: number } = {}) => {
        console.log(`[Tool] 'check_ailock_inbox' called with limit: ${limit}`);

        const userId = (user as any)?.id;
        if (!userId) {
          return 'You need to be signed in to check your Ailock inbox.';
        }

        try {
          const response = await fetch(`/.netlify/functions/ailock-interaction?limit=${limit}&status=sent`, {
            credentials: 'include',
            headers: { 
              'Content-Type': 'application/json'
            }
          });

          const data = await response.json();

          if (!response.ok) {
            return `Failed to check inbox: ${data.error || 'Unknown error'}`;
          }

          const { interactions, unreadCount } = data;

          if (!interactions || interactions.length === 0) {
            return 'Your Ailock inbox is empty. No new messages from other Ailocks.';
          }

          // Показываем сообщения в интерфейсе
          window.dispatchEvent(new CustomEvent('ailock-inbox-updated', { 
            detail: { 
              interactions: interactions.slice(0, limit),
              unreadCount,
              source: 'voice'
            } 
          }));

          let summary = `You have ${unreadCount} unread messages. Here are the latest ${Math.min(limit, interactions.length)}:\n`;
          
          interactions.slice(0, limit).forEach((interaction: any, index: number) => {
            const fromName = interaction.fromAilock?.name || 'Unknown Ailock';
            const snippet = interaction.content.length > 50 ? 
              interaction.content.substring(0, 50) + '...' : 
              interaction.content;
            summary += `${index + 1}. From ${fromName}: "${snippet}"\n`;
          });

          return summary;
        } catch (err: any) {
          console.error('[Tool] check_ailock_inbox error:', err);
          return `Error checking inbox: ${err?.message || 'Unknown error'}`;
        }
      }
    }
  });
  
  useEffect(() => {
    const { status, isListening, isSpeaking } = conversation as any;
    let voiceState: 'idle' | 'listening' | 'processing' | 'speaking' = 'idle';

    // Сначала проверяем статус соединения
    if (status === 'connecting') {
      voiceState = 'processing';
    } else if (status === 'disconnecting') {
      voiceState = 'processing';
    } else if (status === 'disconnected' || status === 'error' || status === 'idle') {
      // Если агент отключен или в ошибке, всегда idle
      voiceState = 'idle';
    } else if (status === 'connected') {
      // Только если подключен, проверяем активность
      if (isListening) {
        voiceState = 'listening';
      } else if (isSpeaking) {
        voiceState = 'speaking';
      } else {
        voiceState = 'idle';
      }
    }

    console.log(`Voice status update: ${status}, listening: ${isListening}, speaking: ${isSpeaking} -> ${voiceState}`);
    window.dispatchEvent(new CustomEvent('voice-status-update', { detail: { status: voiceState } }));
  }, [(conversation as any).status, (conversation as any).isListening, (conversation as any).isSpeaking]);


  const handleToggleConversation = useCallback(async () => {
    const currentStatus = String(conversation.status);
    if (currentStatus === 'connected') {
      console.log('⏹️ Stopping conversation...');
      try {
        await conversation.endSession();
        console.log('✅ Conversation ended successfully');
        // Принудительно отправляем событие об изменении статуса на idle
        window.dispatchEvent(new CustomEvent('voice-status-update', { detail: { status: 'idle' } }));
      } catch (err) {
        console.error('❌ Error ending conversation:', err);
        // Даже при ошибке устанавливаем статус idle
        window.dispatchEvent(new CustomEvent('voice-status-update', { detail: { status: 'idle' } }));
      }
    } else if (currentStatus === 'disconnected' || currentStatus === 'error' || currentStatus === 'idle') {
      console.log('🎤 Attempting to start conversation...');
      window.dispatchEvent(new CustomEvent('voice-session-started'));
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const signedUrl = await getSignedUrl();
        console.log('✅ Got signed URL.');
        await conversation.startSession({ 
          signedUrl,
          dynamicVariables: {
            username: (user as any)?.name || (user as any)?.email || 'Marco',
            ailock_level: ailockProfile?.level || 1,
            ailock_skills: ailockProfile?.skills?.map(s => s.skillName).join(', ') || 'None'
          }
        });
      } catch (err) {
        console.error('💥 Failed to start conversation:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        toast.error(`Failed to start: ${errorMessage}`);
        // При ошибке также устанавливаем статус idle
        window.dispatchEvent(new CustomEvent('voice-status-update', { detail: { status: 'idle' } }));
      }
    }
  }, [conversation]);
  
  useEffect(() => {
    const handleToggle = () => handleToggleConversation();
    window.addEventListener('toggle-voice-agent', handleToggle);
    return () => {
      window.removeEventListener('toggle-voice-agent', handleToggle);
    };
  }, [handleToggleConversation]);

  // This component is now "headless" and renders nothing.
  return null;
}