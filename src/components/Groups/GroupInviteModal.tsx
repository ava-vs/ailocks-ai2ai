import React, { useState, useEffect } from 'react';
import { useGroups } from './GroupSwitcher';
import { useAuth } from '@/hooks/useAuth';
import { useUserSession } from '../../hooks/useUserSession';

// Типы для приглашений
interface UserSearchResult {
  id: string;
  display_name: string;
  email: string;
  ailock_id?: string;
  avatar?: string;
}

interface GroupInvite {
  id: string;
  group_id: string;
  user_id: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: Date;
  expires_at?: Date;
  role: 'admin' | 'member' | 'guest';
  user?: {
    display_name: string;
    email: string;
    avatar?: string;
  };
}

// Хук для работы с приглашениями в группу
function useGroupInvites(groupId: string | null) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [pendingInvites, setPendingInvites] = useState<GroupInvite[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'member' | 'guest'>('member');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { user: authUser } = useAuth();
  const { currentUser } = useUserSession();
  const displayUser = authUser || currentUser;
  
  // Поиск пользователей для приглашения
  const searchUsers = async (query: string, groupId: string) => {
    if (!query.trim() || !groupId) return;
    
    setSearchLoading(true);
    setError(null);

    try {
      if (!displayUser?.id) {
        throw new Error('Не авторизован');
      }

      const response = await fetch('/.netlify/functions/ailock-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          requests: [
            {
              type: 'search_users_for_invite',
              groupId,
              query
            }
          ]
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Ошибка при поиске пользователей');
      }

      if (data.results && data.results[0] && data.results[0].data && data.results[0].data.users) {
        setSearchResults(data.results[0].data.users);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Ошибка при поиске пользователей:', err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setSearchLoading(false);
    }
  };

  // Загрузка ожидающих приглашений группы
  const fetchPendingInvites = async (groupId: string) => {
    if (!groupId) return;
    
    setLoading(true);
    setError(null);

    try {
      if (!displayUser?.id) {
        throw new Error('Не авторизован');
      }

      // В будущем здесь будет запрос к API для получения приглашений
      // Пока используем заглушку
      setPendingInvites([
        {
          id: '1',
          group_id: groupId,
          user_id: 'user1',
          invited_by: 'current_user',
          status: 'pending',
          created_at: new Date(Date.now() - 86400000),
          role: 'member',
          user: {
            display_name: 'Иван Петров',
            email: 'ivan@example.com',
            avatar: 'https://i.pravatar.cc/150?img=10'
          }
        },
        {
          id: '2',
          group_id: groupId,
          user_id: 'user2',
          invited_by: 'current_user',
          status: 'pending',
          created_at: new Date(Date.now() - 43200000),
          role: 'guest',
          user: {
            display_name: 'Мария Сидорова',
            email: 'maria@example.com',
            avatar: 'https://i.pravatar.cc/150?img=12'
          }
        }
      ]);
      
    } catch (err) {
      console.error('Ошибка при загрузке приглашений:', err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  // Отправка приглашения
  const sendInvite = async (groupId: string, userId: string, role: 'admin' | 'member' | 'guest') => {
    try {
      if (!displayUser?.id) {
        throw new Error('Не авторизован');
      }

      // В будущем здесь будет запрос к API для отправки приглашения
      // Сейчас только убираем пользователя из выбранных
      setSelectedUsers(prev => prev.filter(user => user.id !== userId));
      
      // Можно добавить этого пользователя в список ожидающих приглашений
      // Для наглядности интерфейса
      const user = selectedUsers.find(u => u.id === userId);
      if (user) {
        const newInvite: GroupInvite = {
          id: `temp-${Date.now()}`,
          group_id: groupId,
          user_id: userId,
          invited_by: 'current_user',
          status: 'pending',
          created_at: new Date(),
          role,
          user: {
            display_name: user.display_name,
            email: user.email,
            avatar: user.avatar
          }
        };
        
        setPendingInvites(prev => [...prev, newInvite]);
      }
      
      return true;
    } catch (err) {
      console.error('Ошибка при отправке приглашения:', err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      return false;
    }
  };

  // Отмена приглашения
  const cancelInvite = async (inviteId: string) => {
    try {
      if (!displayUser?.id) {
        throw new Error('Не авторизован');
      }

      // В будущем здесь будет запрос к API для отмены приглашения
      // Пока просто удаляем из локального списка
      setPendingInvites(prev => prev.filter(invite => invite.id !== inviteId));
      
      return true;
    } catch (err) {
      console.error('Ошибка при отмене приглашения:', err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      return false;
    }
  };

  // Добавление и удаление пользователей из списка выбранных
  const toggleUserSelection = (user: UserSearchResult) => {
    const isSelected = selectedUsers.some(u => u.id === user.id);
    
    if (isSelected) {
      setSelectedUsers(prev => prev.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers(prev => [...prev, user]);
    }
  };

  // Эффект для поиска пользователей при вводе
  useEffect(() => {
    if (searchTerm && groupId) {
      const debounce = setTimeout(() => {
        searchUsers(searchTerm, groupId);
      }, 500);
      
      return () => clearTimeout(debounce);
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, groupId]);

  // Загружаем приглашения при изменении groupId
  useEffect(() => {
    if (groupId) {
      fetchPendingInvites(groupId);
    } else {
      setPendingInvites([]);
    }
    
    // Сбрасываем состояние
    setSearchTerm('');
    setSearchResults([]);
    setSelectedUsers([]);
  }, [groupId]);

  return {
    searchTerm,
    setSearchTerm,
    searchResults,
    pendingInvites,
    selectedUsers,
    selectedRole,
    setSelectedRole,
    loading,
    searchLoading,
    error,
    toggleUserSelection,
    sendInvite,
    cancelInvite,
    fetchPendingInvites
  };
}

// Компонент модального окна приглашений в группу
export function GroupInviteModal({ 
  groupId,
  isOpen,
  onClose
}: { 
  groupId: string | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const {
    searchTerm,
    setSearchTerm,
    searchResults,
    pendingInvites,
    selectedUsers,
    selectedRole,
    setSelectedRole,
    loading,
    searchLoading,
    error,
    toggleUserSelection,
    sendInvite,
    cancelInvite
  } = useGroupInvites(groupId);

  // Роли для выбора
  const roles = [
    { value: 'admin', label: 'Администратор' },
    { value: 'member', label: 'Участник' },
    { value: 'guest', label: 'Гость' }
  ];

  // Форматирование даты
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ru', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(date));
  };

  // Отправка всех выбранных приглашений
  const handleSendInvites = async () => {
    if (!groupId || selectedUsers.length === 0) return;
    
    for (const user of selectedUsers) {
      await sendInvite(groupId, user.id, selectedRole);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* Заголовок */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Приглашение в группу</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Содержимое */}
        <div className="px-6 py-4">
          {/* Поиск пользователей */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Поиск пользователей
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Имя или email..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {searchLoading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>

          {/* Результаты поиска */}
          {searchResults.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Результаты поиска
              </h3>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-200">
                {searchResults.map((user) => {
                  const isSelected = selectedUsers.some(u => u.id === user.id);
                  
                  return (
                    <div 
                      key={user.id}
                      className={`
                        flex items-center p-2 cursor-pointer
                        ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}
                      `}
                      onClick={() => toggleUserSelection(user)}
                    >
                      <div className="flex-shrink-0 mr-2">
                        <img
                          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name)}`}
                          alt={user.display_name}
                          className="w-8 h-8 rounded-full"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {user.display_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {user.email}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Выбранные пользователи */}
          {selectedUsers.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Выбранные пользователи ({selectedUsers.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <div 
                    key={user.id}
                    className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800"
                  >
                    <img
                      src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name)}`}
                      alt={user.display_name}
                      className="w-5 h-5 rounded-full mr-1"
                    />
                    <span className="mr-1">{user.display_name}</span>
                    <button
                      onClick={() => toggleUserSelection(user)}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Выбор роли */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Роль для приглашаемых
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as 'admin' | 'member' | 'guest')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {selectedRole === 'admin' ? 'Администраторы могут приглашать участников и управлять группой' :
               selectedRole === 'member' ? 'Участники имеют доступ ко всем функциям группы' :
               'Гости имеют ограниченный доступ к функциям группы'}
            </p>
          </div>

          {/* Ожидающие приглашения */}
          {pendingInvites.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Отправленные приглашения ({pendingInvites.length})
              </h3>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-200">
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center p-2">
                    <div className="flex-shrink-0 mr-2">
                      <img
                        src={invite.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(invite.user?.display_name || 'User')}`}
                        alt={invite.user?.display_name || 'User'}
                        className="w-8 h-8 rounded-full"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {invite.user?.display_name}
                      </p>
                      <div className="flex items-center text-xs text-gray-500">
                        <span className="truncate">{invite.user?.email}</span>
                        <span className="mx-1">•</span>
                        <span>
                          {invite.role === 'admin' ? 'Администратор' :
                           invite.role === 'member' ? 'Участник' : 'Гость'}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-xs text-gray-500">
                      {formatDate(invite.created_at)}
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      <button
                        onClick={() => cancelInvite(invite.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ошибка */}
          {error && (
            <div className="mb-4 p-2 bg-red-100 border border-red-300 text-red-700 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Действия */}
        <div className="px-6 py-4 border-t flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Закрыть
          </button>
          <button
            onClick={handleSendInvites}
            disabled={selectedUsers.length === 0 || loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Отправка...' : 'Пригласить'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Экспорт хука для использования в других компонентах
export { useGroupInvites };
