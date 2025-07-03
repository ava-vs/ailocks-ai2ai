import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Plus, MapPin, Eye } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { appState, setMode, setLanguage, type AIMode, type Language } from '../../lib/store';
import { useUserSession } from '../../hooks/useUserSession';
import { useLocation } from '../../hooks/useLocation';
import MessageBubble from './MessageBubble';
import IntentPreview from './IntentPreview';
import LevelUpModal from '../Ailock/LevelUpModal';
import { searchIntents } from '../../lib/api';
import toast from 'react-hot-toast';
import IntentDetailModal from './IntentDetailModal';
import AuthModal from '../Auth/AuthModal';
import VoiceAgentWidget from '../VoiceAgentWidget';
import { useAilock } from '../../hooks/useAilock';
import MobileChatControls from '../Mobile/MobileChatControls';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  mode: string;
  intents?: IntentCard[];
}

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

interface IntentPreviewData {
  title: string;
  description: string;
  category: string;
  requiredSkills: string[];
  budget?: string;
  timeline?: string;
  priority: string;
}

export default function ChatInterface() {
  const state = useStore(appState);
  const { activeMode: mode, language } = state;

  const { currentUser, isAuthenticated, isLoading: isUserLoading } = useUserSession();
  const location = useLocation();
  const { profile: ailockProfile, gainXp } = useAilock();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [showIntentPreview, setShowIntentPreview] = useState(false);
  const [intentPreview, setIntentPreview] = useState<IntentPreviewData | null>(null);
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState<string>('');
  const [ailockStatus, setAilockStatus] = useState<'unknown' | 'available' | 'unavailable'>('unknown');
  const [ailockId, setAilockId] = useState<string | null>(null);
  const [levelUpInfo, setLevelUpInfo] = useState<{
    isOpen: boolean;
    newLevel: number;
    skillPointsGained: number;
    xpGained: number;
    newSkillUnlocked?: {
      id: string;
      name: string;
      description: string;
      branch: string;
    } | null;
  } | null>(null);
  const [isLevelUpModalOpen, setIsLevelUpModalOpen] = useState(false);
  const [newLevelInfo, setNewLevelInfo] = useState({ level: 0, xp: 0, skillPoints: 0 });
  const [showChatHistoryMessage, setShowChatHistoryMessage] = useState(false);
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [selectedIntent, setSelectedIntent] = useState<IntentCard | null>(null);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomOfMessagesRef = useRef<HTMLDivElement>(null);

  const getAvatarBorderColor = () => {
    switch (voiceState) {
      case 'listening':
      case 'speaking':
        return 'border-green-400/60 shadow-green-500/10';
      case 'processing':
        return 'border-yellow-400/60 shadow-yellow-500/10';
      default: // idle
        return 'border-blue-400/60 shadow-blue-500/10';
    }
  };

  const scrollToBottom = () => {
    bottomOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, showIntentPreview]);

  // Show auth modal if user is not authenticated
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  useEffect(() => {
    if (!isUserLoading && !isAuthenticated) {
      setShowAuthModal(true);
    }
  }, [isUserLoading, isAuthenticated]);

  // Check Ailock service health on component mount
  useEffect(() => {
    const checkAilockHealth = async () => {
      try {
        const response = await fetch('/.netlify/functions/ai-health-check');
        if (response.ok) {
          const data = await response.json();
          console.log('Ailock Health Check:', data);
          
          if (data.aiService?.status === 'available' && data.testResponse === 'success') {
            setAilockStatus('available');
            setError(null);
          } else {
            setAilockStatus('unavailable');
            setError('Ailock services are not properly configured.');
          }
        } else {
          setAilockStatus('unavailable');
          setError('Ailock health check failed.');
        }
      } catch (err) {
        console.warn('Ailock health check error:', err);
        setAilockStatus('unavailable');
        setError('Cannot connect to Ailock services.');
      }
    };

    checkAilockHealth();
  }, []);

  // Initialize session with user ID - only after user is authenticated
  useEffect(() => {
    const initSession = async () => {
      if (!isAuthenticated || !currentUser.id || currentUser.id === 'loading') {
        console.log('⏳ Waiting for user authentication...', {
          isAuthenticated,
          userId: currentUser.id,
          isLoading: currentUser.id === 'loading'
        });
        return;
      }

      try {
        setConnectionStatus('connecting');
        console.log('🔄 Creating session for user:', currentUser.id);
        
        const response = await fetch('/.netlify/functions/session-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            mode, 
            language, 
            userId: currentUser.id
          })
        });

        if (response.ok) {
          const data = await response.json();
          setSessionId(data.sessionId);
          setConnectionStatus('connected');
          
          if (data.fallback) {
            console.warn('Session created in fallback mode:', data.warning);
            setError('Session created without persistent storage');
          } else {
            console.log('✅ Session created with database persistence:', data.sessionId);
            setError(null);
          }
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }
      } catch (err) {
        console.warn('Session initialization error:', err);
        const mockSessionId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        setSessionId(mockSessionId);
        setConnectionStatus('connected');
        setError('Session created in offline mode - messages will not be saved');
      }
    };

    initSession();
  }, [mode, language, currentUser.id, isAuthenticated]);

  // Load chat history when session is created
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!sessionId || sessionId.startsWith('local-') || sessionId.startsWith('fallback-')) {
        return;
      }

      try {
        console.log('📥 Loading chat history in background for session:', sessionId);
        const response = await fetch(`/.netlify/functions/chat-history?sessionId=${sessionId}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.messages && data.messages.length > 0) {
            const loadedMessages = data.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }));
            setMessages(loadedMessages);
            console.log('✅ Background chat history loaded:', loadedMessages.length, 'messages');
          } else {
            console.log('📭 No chat history found for this session.');
          }
        } else {
          console.warn(`⚠️ Failed to load chat history in background: ${response.status}`);
        }
      } catch (error) {
        console.warn('Failed to load chat history in background:', error);
      }
    };

    if (sessionId) {
      loadChatHistory();
    }
  }, [sessionId]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    // If no session, try to create one
    if (!sessionId && currentUser.id && currentUser.id !== 'loading') {
      try {
        console.log('🔄 Creating session for message send...');
        const response = await fetch('/.netlify/functions/session-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            mode, 
            language, 
            userId: currentUser.id
          })
        });

        if (response.ok) {
          const data = await response.json();
          setSessionId(data.sessionId);
          setConnectionStatus('connected');
          console.log('✅ Session created for message send:', data.sessionId);
        } else {
          // Create fallback session
          const fallbackSessionId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          setSessionId(fallbackSessionId);
          setConnectionStatus('connected');
          console.warn('⚠️ Using fallback session for message send');
        }
      } catch (err) {
        console.warn('Failed to create session, using local fallback:', err);
        const fallbackSessionId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        setSessionId(fallbackSessionId);
        setConnectionStatus('connected');
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      role: 'user',
      timestamp: new Date(),
      mode
    };

    setMessages(prev => [...prev, userMessage]);
    setLastUserMessage(input.trim());
    setInput('');
    setIsStreaming(true);
    setError(null);

    // Immediately grant XP for the text message. The hook handles the logic.
    handleXpGain();

    try {
      await sendAilockMessage(userMessage);
    } catch (err) {
      console.warn('Ailock request failed, using fallback:', err);
      await sendFallbackMessage();
    }
  };

  const sendAilockMessage = async (userMessage: Message) => {
    return new Promise<void>((resolve, reject) => {
      const response = fetch('/.netlify/functions/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: sessionId || `temp-${Date.now()}`,
          mode,
          language,
          location: location,
          userId: currentUser.id === 'loading' ? undefined : currentUser.id,
          streaming: true
        })
      });

      response.then(res => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        if (!res.body) {
          throw new Error('No response body');
        }

        const reader = res.body.getReader();
        
        let assistantMessage: Message = {
          id: `${Date.now()}-ai`,
          content: '',
          role: 'assistant',
          timestamp: new Date(),
          mode
        };

        setMessages(prev => [...prev, assistantMessage]);
        setStreamingMessageId(assistantMessage.id);

        const readStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                setIsStreaming(false);
                setStreamingMessageId(null);
                setAilockStatus('available');
                setError(null);
                console.log('✅ Message conversation saved to database');
                resolve();
                return;
              }

              const decodedChunk = new TextDecoder().decode(value);
              const lines = decodedChunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  
                  if (data === '[DONE]') {
                    setIsStreaming(false);
                    setStreamingMessageId(null);
                    setAilockStatus('available');
                    setError(null);
                    console.log('✅ Message conversation saved to database');
                    resolve();
                    return;
                  }

                  try {
                    const parsed = JSON.parse(data);
                    
                    if (parsed.type === 'chunk') {
                      setMessages(prev => prev.map(msg => 
                        msg.id === assistantMessage.id 
                          ? { ...msg, content: msg.content + parsed.content } 
                          : msg
                      ));
                    } else if (parsed.type === 'complete') {
                      setMessages(prev => prev.map(msg => 
                        msg.id === assistantMessage.id 
                          ? { ...msg, content: parsed.fullResponse } 
                          : msg
                      ));
                    } else if (parsed.type === 'intents') {
                      // Send all results to the side panel
                      window.dispatchEvent(new CustomEvent('text-search-results', { 
                        detail: { 
                          query: lastUserMessage,
                          results: parsed.intents 
                        } 
                      }));
                      
                      // Attach top 3 results to the message for rendering in chat
                      setMessages(prev => prev.map(msg => 
                        msg.id === assistantMessage.id 
                          ? { ...msg, intents: parsed.intents.slice(0, 3) } 
                          : msg
                      ));
                    } else if (parsed.type === 'actions') {
                      // This type is no longer used in the new system
                    } else if (parsed.type === 'error') {
                      setError(parsed.error);
                      if (parsed.fallback) {
                        setMessages(prev => prev.map(msg => 
                          msg.id === assistantMessage.id 
                            ? { ...msg, content: parsed.fallback } 
                            : msg
                        ));
                      }
                      setAilockStatus('unavailable');
                    }
                  } catch (parseError) {
                    console.warn('Failed to parse SSE data:', parseError);
                  }
                }
              }
            }
          } catch (streamError) {
            console.error('Stream reading error:', streamError);
            reject(streamError);
          }
        };

        readStream();
      }).catch(reject);
    });
  };

  const sendFallbackMessage = async () => {
    setAilockStatus('unavailable');
    
    const assistantMessage: Message = {
      id: `${Date.now()}-ai`,
      content: '',
      role: 'assistant',
      timestamp: new Date(),
      mode
    };

    setMessages(prev => [...prev, assistantMessage]);
    
    const fallbackContent = getMockResponse(mode, language);
    let currentContent = '';
    
    for (let i = 0; i < fallbackContent.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 20));
      currentContent += fallbackContent[i];
      
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id ? { ...msg, content: currentContent } : msg
      ));
    }
    
    setError('Ailock services unavailable - using offline responses.');
    setIsStreaming(false);
    setStreamingMessageId(null);

    // Grant XP even when using fallback (offline) response
    handleXpGain();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleCreateIntentClick = () => {
    console.log('🎯 Create Intent clicked!');
    console.log('📝 Current input:', input);
        
    // Use current input if available, otherwise fall back to lastUserMessage
    const messageToUse = input.trim() || lastUserMessage;
    console.log('🔍 Message to use for intent:', messageToUse);
    
    if (!messageToUse) {
      console.warn('⚠️ No message available for intent creation');
      return;
    }
    
    // Create a basic intent preview from the current input or last user message
    const detectCategory = (text: string): string => {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('путешеств') || lowerText.includes('tour') || lowerText.includes('travel') || lowerText.includes('поездк') || lowerText.includes('trip')) return "Travel";
      if (lowerText.includes('маркетинг') || lowerText.includes('marketing') || lowerText.includes('реклам') || lowerText.includes('advertising')) return "Marketing";
      if (lowerText.includes('дизайн') || lowerText.includes('design') || lowerText.includes('креатив') || lowerText.includes('creative')) return "Design";
      if (lowerText.includes('программ') || lowerText.includes('разработ') || lowerText.includes('develop') || lowerText.includes('coding')) return "Technology";
      if (lowerText.includes('бизнес') || lowerText.includes('business') || lowerText.includes('консалт') || lowerText.includes('consulting')) return "Business";
      return "General";
    };

    const detectSkills = (text: string): string[] => {
      const lowerText = text.toLowerCase();
      const skills = ["Collaboration", "Communication"];
      if (lowerText.includes('react') || lowerText.includes('javascript') || lowerText.includes('программ')) skills.push("Programming");
      if (lowerText.includes('дизайн') || lowerText.includes('design')) skills.push("Design");
      if (lowerText.includes('маркетинг') || lowerText.includes('marketing')) skills.push("Marketing");
      if (lowerText.includes('путешеств') || lowerText.includes('travel')) skills.push("Travel Planning");
      return skills;
    };

    const detectedCategory = detectCategory(messageToUse);
    const detectedSkills = detectSkills(messageToUse);
    
    console.log('🏷️ Detected category:', detectedCategory);
    console.log('🎯 Detected skills:', detectedSkills);

    const previewData: IntentPreviewData = {
      title: messageToUse.length > 5 
        ? messageToUse.substring(0, Math.min(50, messageToUse.length)) 
        : "New Collaboration Opportunity",
      description: messageToUse.length > 5 
        ? messageToUse 
        : "Looking for collaboration on an exciting project.",
      category: detectedCategory,
      requiredSkills: detectedSkills,
      priority: "medium"
    };
    
    console.log('📋 Intent preview data created:', previewData);
    console.log('🚀 Setting states: showIntentPreview=true, intentPreview=data');
    
    // Устанавливаем состояние
    setIntentPreview(previewData);
    setShowIntentPreview(true);
    
    // Проверяем состояние через небольшую задержку
    setTimeout(() => {
      console.log('⏰ State check after 100ms - showIntentPreview should be true');
    }, 100);
  };

  const handleCreateIntent = async (updatedData?: any) => {
    if (!sessionId || !intentPreview) return;
    
    if (!currentUser.id || currentUser.id === 'loading') {
      setError('Please wait for user data to load before creating intents');
      return;
    }

    // Use updated data from IntentPreview if provided, otherwise use original data
    const finalIntentData = updatedData || intentPreview;
    const messageToUse = input.trim() || lastUserMessage;
    console.log('Creating intent with data:', finalIntentData);

    setIsCreatingIntent(true);
    try {
      const response = await fetch('/.netlify/functions/intents-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userInput: messageToUse,
          location: finalIntentData.location || location, // Use custom location if provided
          language,
          intentData: finalIntentData,
          userId: currentUser.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        const successMessage: Message = {
          id: `${Date.now()}-system`,
          content: `✅ Intent created successfully: "${data.intent.title}". Your collaboration opportunity is now live and visible to potential partners!`,
          role: 'assistant',
          timestamp: new Date(),
          mode
        };

        setMessages(prev => [...prev, successMessage]);
        
        window.dispatchEvent(new CustomEvent('intentCreated', { 
          detail: { 
            ...data.intent, 
            userId: currentUser.id,
            userName: currentUser.name,
            isOwn: true
          } 
        }));
        
        setShowIntentPreview(false);
        setIntentPreview(null);
        
        // Clear the input field after successful creation
        setInput('');
        
        console.log('Intent created successfully:', data.intent);

        if (data.xpResult) {
          const { xpGained, leveledUp, newLevel, skillPointsGained } = data.xpResult;
          
          if (xpGained > 0) {
            toast.success(`You gained ${xpGained} XP!`);
          }

          if (leveledUp) {
            let newSkillUnlocked = null;
            // Demo logic: unlock semantic search at level 2
            if (newLevel === 2) {
              newSkillUnlocked = {
                id: 'semantic_search',
                name: 'Semantic Search',
                description: 'Improves relevance and accuracy of all searches by understanding context.',
                branch: 'research'
              };
            }

            setLevelUpInfo({
              isOpen: true,
              newLevel: newLevel,
              skillPointsGained: skillPointsGained,
              xpGained: xpGained,
              newSkillUnlocked: newSkillUnlocked,
            });
          }
          
          // Notify other components like the header widget to refresh the profile
          window.dispatchEvent(new CustomEvent('ailock-profile-updated'));
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to create intent:', errorData);
        throw new Error(errorData.error || 'Failed to create intent');
      }
    } catch (error) {
      console.error('Intent creation error:', error);
      setError('Failed to create intent. Please try again.');
      setIsCreatingIntent(false);
    }
  };

  const handleCancelIntent = () => {
    setShowIntentPreview(false);
    setIntentPreview(null);
  };

  const handleStartWork = (intent: IntentCard) => {
    window.dispatchEvent(new CustomEvent('intent-in-work', { detail: intent }));
    toast.success(`Intent "${intent.title.substring(0, 20)}..." moved to "In Work"`);
  };

  const handleViewDetails = (intent: IntentCard) => {
    setSelectedIntent(intent);
  };

  const handleIntentCardClick = (intent: IntentCard) => {
    console.log('Intent card clicked:', intent);
    const message = `Tell me more about "${intent.title}" - this looks interesting!`;
    setInput(message);
    inputRef.current?.focus();
  };

  const getModeDescription = (mode: string) => {
    const descriptions: Record<string, Record<string, string>> = {
      en: {
        researcher: 'I excel at finding collaboration opportunities and analyzing market data.',
        creator: 'I help you find creative collaborators and bring innovative ideas to life.',
        analyst: 'I provide strategic analysis of opportunities and market insights.'
      },
      ru: {
        researcher: 'Я превосходно нахожу возможности для сотрудничества и анализирую рыночные данные.',
        creator: 'Я помогаю находить творческих соавторов и воплощать инновационные идеи в жизнь.',
        analyst: 'Я анализирую возможности и предоставляю инсайты.'
      }
    };

    return descriptions[language as keyof typeof descriptions]?.[mode as keyof typeof descriptions.en] || descriptions.en.researcher;
  };

  const getWelcomeText = () => {
    const texts: Record<string, Record<string, string>> = {
      en: {
        welcome: "Hello! I'm Ailock, your personal AI assistant.",
      },
      ru: {
        welcome: "Привет! Я Айлок, ваш персональный ИИ-помощник.",
      }
    };

    return texts[language] || texts.en;
  };

  const getPlaceholder = () => {
    const placeholders: Record<string, string> = {
      en: `Ask Ailock to find opportunities, analyze markets, or help with collaboration...`,
      ru: `Попросите Айлока найти возможности, проанализировать рынки или помочь с сотрудничеством...`
    };

    return placeholders[language] || placeholders.en;
  };

  const getMockResponse = (mode: string, language: string): string => {
    const responses: Record<string, Record<string, string[]>> = {
      en: {
        researcher: [
          "I'm Ailock, your personal AI assistant. I help you find collaboration opportunities and analyze market trends. I'm currently having trouble accessing the database, but I can still help you create new opportunities.",
        ],
        creator: [
          "I'm Ailock, your creative AI companion! I help you find collaborators and bring ideas to life. While I'm having some technical difficulties, I can still help you brainstorm and create new opportunities.",
        ],
        analyst: [
          "I'm Ailock, your strategic AI advisor. I analyze opportunities and provide insights. I'm currently experiencing some connectivity issues, but I can still help you plan and strategize.",
        ]
      },
      ru: {
        researcher: [
          "Я Айлок, ваш персональный ИИ-помощник. Я помогаю находить возможности для сотрудничества и анализировать рыночные тренды. У меня проблемы с доступом к базе данных, но я все еще могу помочь создать новые возможности.",
        ],
        creator: [
          "Я Айлок, ваш творческий ИИ-компаньон! Я помогаю находить соавторов и воплощать идеи в жизнь. Хотя у меня технические трудности, я все еще могу помочь с мозговым штурмом и созданием новых возможностей.",
        ],
        analyst: [
          "Я Айлок, ваш стратегический ИИ-советник. Я анализирую возможности и предоставляю инсайты. У меня проблемы с подключением, но я все еще могу помочь с планированием и стратегией."
        ]
      }
    };

    const modeResponses = responses[language]?.[mode] || responses.en.researcher;
    const randomResponse = modeResponses[Math.floor(Math.random() * modeResponses.length)];
    
    return `${randomResponse}\n\n*Note: Using offline mode - Ailock services may be temporarily unavailable.*`;
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

  const isPersistentSession = sessionId && !sessionId.startsWith('local-') && !sessionId.startsWith('fallback-');

  // Show chat history message for 3 seconds when session becomes persistent
  useEffect(() => {
    if (isPersistentSession) {
      setShowChatHistoryMessage(true);
      const timer = setTimeout(() => {
        setShowChatHistoryMessage(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isPersistentSession]);

  const handleXpGain = async () => {
    const result = await gainXp('chat_message_sent');

    if (result?.leveledUp) {
      let newSkillUnlocked = null;
      // Demo logic: unlock semantic search at level 2
      if (result.newLevel === 2) {
        newSkillUnlocked = {
          id: 'semantic_search',
          name: 'Semantic Search',
          description: 'Improves relevance and accuracy of all searches by understanding context.',
          branch: 'research'
        };
      }
      
      setLevelUpInfo({
        isOpen: true,
        newLevel: result.newLevel,
        skillPointsGained: result.skillPointsGained,
        xpGained: result.xpGained,
        newSkillUnlocked: newSkillUnlocked,
      });
    }
  };

  const handleModeChange = (newMode: AIMode) => {
    setMode(newMode);
    setInput('');
  };

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
    setInput('');
  };

  const handleVoiceClick = () => {
    window.dispatchEvent(new CustomEvent('toggle-voice-agent'));
  };

  // Listen to status updates from VoiceAgentWidget
  useEffect(() => {
    const updateStatus = (e: CustomEvent) => {
      try {
        const { status } = e.detail;
        if (status && ['idle', 'listening', 'processing', 'speaking'].includes(status)) {
          setVoiceState(status);
        }
      } catch (error) {
        console.warn('Error handling voice status update:', error);
      }
    };
    window.addEventListener('voice-status-update', updateStatus as EventListener);
    return () => {
      window.removeEventListener('voice-status-update', updateStatus as EventListener);
    };
  }, []);

  useEffect(() => {
    // Handler for text messages from voice
    const handleVoiceMessage = (event: CustomEvent) => {
      try {
        const { source, message } = event.detail;
        if (!message || typeof message !== 'string') return;
        
        const role = source === 'user' ? 'user' : 'assistant';
        const newMessage: Message = { 
          role, 
          content: message, 
          id: Date.now().toString(),
          timestamp: new Date(),
          mode: 'text'
        };
        setMessages(prev => [...prev, newMessage]);
      } catch (error) {
        console.warn('Error handling voice message:', error);
      }
    };

    // Handler for voice intents - keep our voice agent functionality
    const handleVoiceIntents = (event: CustomEvent) => {
      try {
        const { intents, query, source } = event.detail;
        
        if (intents && Array.isArray(intents) && intents.length > 0 && query) {
          const voiceResultsMessage: Message = { 
            role: 'assistant', 
            content: `🎤 Я нашел ${intents.length} возможностей по запросу "${query}":`,
            intents: intents,
            id: Date.now().toString(),
            timestamp: new Date(),
            mode: mode,
          };
          setMessages(prev => [...prev, voiceResultsMessage]);
          
          // Также отправляем уведомление о том, что результаты найдены голосовым агентом
          console.log(`Voice agent found ${intents.length} intents for "${query}"`);
        }
      } catch (error) {
        console.warn('Error handling voice intents:', error);
      }
    };

    // Handler for session start
    const handleVoiceSessionStart = () => {
      console.log('Voice session started, notified main chat.');
    };

    window.addEventListener('add-message-to-chat', handleVoiceMessage as EventListener);
    window.addEventListener('voice-intents-found', handleVoiceIntents as EventListener);
    window.addEventListener('voice-session-started', handleVoiceSessionStart as EventListener);

    return () => {
      window.removeEventListener('add-message-to-chat', handleVoiceMessage as EventListener);
      window.removeEventListener('voice-intents-found', handleVoiceIntents as EventListener);
      window.removeEventListener('voice-session-started', handleVoiceSessionStart as EventListener);
    };
  }, [mode]); 

  return (
    <div className="relative flex flex-col h-full bg-slate-900/95 rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
      <VoiceAgentWidget />
      <div className="h-full flex flex-col bg-slate-900/90 text-white">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3 md:p-6">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="max-w-md text-center px-4">
                <div className="w-20 h-20 mx-auto mb-4">
                  <img 
                    src="/images/ailock-character.png" 
                    alt="Ailock AI Assistant"
                    className="w-full h-full object-contain drop-shadow-2xl animate-float"
                    style={{
                      filter: 'drop-shadow(0 0 20px rgba(74, 158, 255, 0.3))',
                      border: 'none',
                      outline: 'none'
                    }}
                  />
                </div>
                <h1 className="text-2xl md:text-4xl font-bold mb-4 text-white">
                  {getWelcomeText().welcome}
                </h1>
                <p className="text-gray-300 mb-2 text-base md:text-lg">
                  I'm here to help you in <span className="text-blue-400 font-medium">{mode}</span> mode.
                </p>
                <p className="text-gray-400 mb-8 text-sm md:text-base">
                  {getModeDescription(mode)}
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              {messages.map(message => (
                <React.Fragment key={message.id}>
                  <MessageBubble 
                    message={message} 
                    isStreaming={streamingMessageId === message.id}
                  />
                  {message.role === 'assistant' && message.intents && message.intents.length > 0 && (
                    <div className="mb-6 ml-12">
                      <div className="grid gap-4">
                        {message.intents.map((intent: IntentCard) => (
                          <div 
                            key={intent.id}
                            className="bg-gradient-to-br from-blue-500/10 to-indigo-600/10 border border-blue-500/30 rounded-xl p-4 shadow-lg transition-all"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <h4 className="text-white font-medium text-sm flex-1 pr-4">
                                {intent.title}
                              </h4>
                              <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                                <div className="flex items-center space-x-1 bg-blue-500/20 text-blue-400 px-2 py-1 rounded-lg border border-blue-500/30">
                                  <span className="text-xs font-medium">{intent.matchScore}% match</span>
                                </div>
                              </div>
                            </div>
                            
                            <p className="text-white/60 text-xs leading-relaxed mb-4">
                              {intent.description.substring(0, 150)}{intent.description.length > 150 && '...'}
                            </p>
                            
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
                            
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center space-x-2 text-white/50">
                                <MapPin className="w-3 h-3" />
                                <span>{intent.distance}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleViewDetails(intent)} className="p-1.5 text-gray-300 hover:text-white hover:bg-slate-700/50 rounded-md transition-colors">
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleStartWork(intent)} className="p-1.5 text-gray-300 hover:text-white hover:bg-slate-700/50 rounded-md transition-colors">
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}
              
              {isStreaming && !streamingMessageId && (
                <div className="flex items-center space-x-3 text-white/60 mb-6">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              )}
              <div ref={bottomOfMessagesRef} />
            </div>
          )}
        </div>

        {/* Mobile Chat Controls - only visible on mobile */}
        <div className="md:hidden">
          <MobileChatControls 
            input={input}
            setInput={setInput}
            sendMessage={sendMessage}
            isStreaming={isStreaming}
            handleCreateIntentClick={handleCreateIntentClick}
            placeholder={getPlaceholder()}
            sessionId={sessionId}
          />
        </div>

        {/* Desktop Input Area - hidden on mobile */}
        <div className="hidden md:block px-6 pb-4 pt-2 bg-gradient-to-t from-slate-800/90 via-slate-800/90 to-transparent">
          <div className="relative max-w-5xl mx-auto">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={sessionId ? getPlaceholder() : "Initializing chat session..."}
                className="w-full px-6 py-6 pr-44 bg-transparent border border-blue-500/30 
                          rounded-2xl text-white placeholder-gray-400 text-lg
                           focus:outline-none focus:border-blue-500 focus:bg-slate-800/80 resize-none transition-all duration-300"
                disabled={isStreaming}
              />

              {/* INPUT ACTIONS */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                <button
                  title="Create Intent"
                  onClick={handleCreateIntentClick}
                  disabled={!input.trim() && !lastUserMessage.trim()}
                  className="flex h-8 items-center justify-center rounded-lg bg-blue-400 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Create Intent</span>
                </button>
                <button 
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-400 text-white transition-colors hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={sessionId ? "Send message" : "Send message (will create session)"}
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {levelUpInfo?.isOpen && (
        <LevelUpModal
          isOpen={levelUpInfo.isOpen}
          onClose={() => setLevelUpInfo(null)}
          newLevel={levelUpInfo.newLevel}
          skillPointsGained={levelUpInfo.skillPointsGained}
          xpGained={levelUpInfo.xpGained}
          newSkillUnlocked={levelUpInfo.newSkillUnlocked}
        />
      )}

      <IntentDetailModal 
        isOpen={!!selectedIntent}
        onClose={() => setSelectedIntent(null)}
        intent={selectedIntent}
        onStartWork={handleStartWork}
      />

      {/* Intent Preview Modal */}
      {showIntentPreview && intentPreview && (
        <IntentPreview
          title={intentPreview.title}
          description={intentPreview.description}
          category={intentPreview.category}
          requiredSkills={intentPreview.requiredSkills}
          location={location}
          budget={intentPreview.budget}
          timeline={intentPreview.timeline}
          priority={intentPreview.priority}
          onConfirm={handleCreateIntent}
          onCancel={handleCancelIntent}
          isLoading={isCreatingIntent}
        />
      )}

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </div>
  );
};