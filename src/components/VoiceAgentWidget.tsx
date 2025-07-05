'use client';

import { useConversation } from '@elevenlabs/react';
import { useCallback, useEffect } from 'react';
import { searchIntents } from '../lib/api';
import { useAilock } from '../hooks/useAilock';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

const AGENT_ID = import.meta.env.PUBLIC_AGENT_ID || import.meta.env.AGENT_ID;

const getSignedUrl = async (): Promise<string> => {
  const response = await fetch('/.netlify/functions/get-elevenlabs-signed-url');
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
        console.log(`[Tool] 'search_intents' called with query: "${query}"`);

        if (typeof query !== 'string' || !query.trim()) {
          console.warn('[Tool] search_intents called with an invalid query.');
          return "Please provide a valid search query to find intents.";
        }

        try {
          const results = await searchIntents(query);
          console.log(`[Tool] Found ${results.length} results.`);
          
          window.dispatchEvent(new CustomEvent('voice-search-results', { detail: { query, results } }));
          
          window.dispatchEvent(new CustomEvent('voice-intents-found', { 
            detail: { 
              intents: results.slice(0, 3),
              query: query,
              source: 'voice'
            } 
          }));

          if (!results || results.length === 0) {
            return `I couldn't find any intents matching "${query}". You can try a different search or create a new intent.`;
          }
          
          return `Found ${results.length} intents for "${query}". I have displayed the top results on the screen.`;
        } catch (toolError) {
          console.error('[Tool] The "search_intents" tool failed:', toolError);
          return JSON.stringify({ tool: 'search_intents', error: 'Search failed' });
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
            username: (user as any)?.name || (user as any)?.email || 'Marco'
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