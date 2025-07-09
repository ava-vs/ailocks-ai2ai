import React, { useState, useEffect, useRef } from 'react';
import { useGroups } from './GroupSwitcher';
import { useStore } from '@nanostores/react';
import { useAuth } from '@/hooks/useAuth';
import { useUserSession } from '@/hooks/useUserSession';

// Типы для сообщений
interface GroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  ailock_id: string;
  content: string;
  created_at: Date;
  user_name?: string;
  user_avatar?: string;
}

// Хук для работы с чатом группы
function useGroupChat(groupId: string | null) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user: authUser } = useAuth();
  const { currentUser } = useUserSession();
  const displayUser = authUser || currentUser;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Загрузка сообщений группы
  const fetchMessages = async (groupId: string) => {
    if (!groupId) return;
    
    setLoading(true);
    setError(null);

    try {
      if (!displayUser?.id) {
        throw new Error('Не авторизован');
      }

      // В будущем здесь будет запрос к endpoint для сообщений группы
      // Временно используем заглушку
      setMessages([
        {
          id: '1',
          group_id: groupId,
          user_id: 'user1',
          ailock_id: 'ailock1',
          content: 'Привет всем в группе!',
          created_at: new Date(Date.now() - 3600000),
          user_name: 'Анна',
          user_avatar: 'https://i.pravatar.cc/150?img=1'
        },
        {
          id: '2',
          group_id: groupId,
          user_id: 'user2',
          ailock_id: 'ailock2',
          content: 'Здравствуйте! Как у всех дела?',
          created_at: new Date(Date.now() - 2400000),
          user_name: 'Михаил',
          user_avatar: 'https://i.pravatar.cc/150?img=3'
        },
        {
          id: '3',
          group_id: groupId,
          user_id: 'user3',
          ailock_id: 'ailock3',
          content: 'У меня всё хорошо. Работаю над проектом.',
          created_at: new Date(Date.now() - 1800000),
          user_name: 'Екатерина',
          user_avatar: 'https://i.pravatar.cc/150?img=5'
        },
        {
          id: '4',
          group_id: groupId,
          user_id: 'user1',
          ailock_id: 'ailock1',
          content: 'Отлично! Какой проект?',
          created_at: new Date(Date.now() - 1200000),
          user_name: 'Анна',
          user_avatar: 'https://i.pravatar.cc/150?img=1'
        },
        {
          id: '5',
          group_id: groupId,
          user_id: 'user3',
          ailock_id: 'ailock3',
          content: 'Разрабатываю новое приложение для управления задачами. Думаю, вам понравится!',
          created_at: new Date(Date.now() - 600000),
          user_name: 'Екатерина',
          user_avatar: 'https://i.pravatar.cc/150?img=5'
        }
      ]);
      
    } catch (err) {
      console.error('Ошибка при загрузке сообщений группы:', err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  // Отправка сообщения в группу
  const sendMessage = async (groupId: string, content: string) => {
    if (!groupId || !content.trim()) return;
    
    try {
      if (!displayUser?.id) {
        throw new Error('Не авторизован');
      }

      // В будущем здесь будет запрос к API для отправки сообщения
      // Пока добавляем сообщение только в локальный стейт
      const newMessage: GroupMessage = {
        id: `temp-${Date.now()}`,
        group_id: groupId,
        user_id: displayUser?.id || '',
        ailock_id: '', // У AuthUser нет свойства ailockId
        content,
        created_at: new Date(),
        user_name: displayUser?.name || 'Вы',
        user_avatar: 'https://i.pravatar.cc/150?img=8' // У AuthUser нет свойства avatar
      };

      setMessages(prev => [...prev, newMessage]);
      
      // Прокручиваем вниз к новому сообщению
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      
    } catch (err) {
      console.error('Ошибка при отправке сообщения:', err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    }
  };

  // Загружаем сообщения при изменении groupId
  useEffect(() => {
    if (groupId) {
      fetchMessages(groupId);
    } else {
      setMessages([]);
    }
  }, [groupId]);

  // Прокрутка вниз при загрузке новых сообщений
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return {
    messages,
    loading,
    error,
    sendMessage,
    messagesEndRef
  };
}

// Основной компонент чата группы
export function GroupChat() {
  const { activeGroupId } = useGroups();
  const { messages, loading, error, sendMessage, messagesEndRef } = useGroupChat(activeGroupId);
  const [newMessage, setNewMessage] = useState('');
  const [groupDetails, setGroupDetails] = useState<any>(null);
  const { user: authUser } = useAuth();
  const { currentUser } = useUserSession();
  const displayUser = authUser || currentUser;
  const { fetchGroupDetails } = useGroups();

  // Загрузка деталей группы
  useEffect(() => {
    const getGroupDetails = async () => {
      if (activeGroupId) {
        try {
          const details = await fetchGroupDetails(activeGroupId);
          setGroupDetails(details);
        } catch (err) {
          console.error('Не удалось загрузить детали группы:', err);
        }
      } else {
        setGroupDetails(null);
      }
    };

    getGroupDetails();
  }, [activeGroupId, fetchGroupDetails]);

  // Форматирование даты и времени
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('ru', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeGroupId && newMessage.trim()) {
      sendMessage(activeGroupId, newMessage);
      setNewMessage('');
    }
  };

  if (!activeGroupId) {
    return (
      <div className="flex items-center justify-center h-full text-center text-gray-500">
        <div>
          <p className="mb-4">Выберите группу для отображения чата</p>
          <button
            className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            Создать новую группу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Заголовок чата */}
      <div className="flex items-center px-4 py-3 border-b">
        <div className="mr-3 text-xl">
          {groupDetails?.group?.type === 'family' ? '👨‍👩‍👧‍👦' : 
           groupDetails?.group?.type === 'team' ? '👥' : '🤝'}
        </div>
        <div>
          <h2 className="text-lg font-semibold">{groupDetails?.group?.name || 'Загрузка...'}</h2>
          <p className="text-sm text-gray-500">
            {groupDetails?.meta?.membersCount || 0} участников • {groupDetails?.meta?.intentsCount || 0} интентов
          </p>
        </div>
        <div className="ml-auto">
          <button
            className="p-2 text-gray-500 rounded-full hover:bg-gray-100"
            title="Настройки группы"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Сообщения */}
      <div className="flex-1 p-4 overflow-y-auto">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-4 border-gray-300 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-500">
            Ошибка: {error}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <p className="mb-2">В этой группе пока нет сообщений</p>
            <p>Будьте первым, кто напишет!</p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isCurrentUser = message.user_id === displayUser?.id;
              return (
                <div 
                  key={message.id}
                  className={`flex mb-4 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isCurrentUser && (
                    <div className="mr-2">
                      <img 
                        src={message.user_avatar} 
                        alt={message.user_name} 
                        className="w-8 h-8 rounded-full"
                      />
                    </div>
                  )}
                  <div className={`max-w-xs lg:max-w-md ${isCurrentUser ? 'bg-indigo-100' : 'bg-gray-100'} rounded-lg px-4 py-2`}>
                    {!isCurrentUser && (
                      <div className="text-xs font-semibold text-gray-700">{message.user_name}</div>
                    )}
                    <div className="text-sm">{message.content}</div>
                    <div className="text-right text-xs text-gray-500 mt-1">
                      {formatTime(message.created_at)}
                    </div>
                  </div>
                  {isCurrentUser && (
                    <div className="ml-2">
                      <img 
                        src={message.user_avatar} 
                        alt="Вы" 
                        className="w-8 h-8 rounded-full"
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Форма отправки сообщения */}
      <form onSubmit={handleSendMessage} className="flex items-center p-4 border-t">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="Напишите сообщение..."
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          className="ml-2 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Отправить
        </button>
      </form>
    </div>
  );
}
