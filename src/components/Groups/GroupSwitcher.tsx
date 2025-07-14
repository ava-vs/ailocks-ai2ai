import React, { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { useAuth } from '@/hooks/useAuth';
import { useUserSession } from '@/hooks/useUserSession';
import useNotifications from '@/hooks/useNotifications';
import type { Notification } from '@/hooks/useNotifications';

// Типы для групп
interface Group {
  id: string;
  name: string;
  type: 'family' | 'team' | 'friends';
  description?: string;
  status: string;
  created_at: Date;
  members_count?: number;
  user_role?: 'owner' | 'admin' | 'member' | 'guest';
  unread_count?: number; // Количество непрочитанных сообщений
  new_intents_count?: number; // Количество новых интентов
  invites_count?: number; // Количество новых приглашений
}

// Хук для работы с группами
function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const { user: authUser } = useAuth();
  const { currentUser } = useUserSession();
  const displayUser = authUser || currentUser;
  const { notifications, getUnreadCountForGroup } = useNotifications();

  // Загрузка групп пользователя
  const fetchGroups = async () => {
    setLoading(true);
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
              type: 'get_user_groups'
            }
          ]
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Не удалось загрузить группы');
      }

      if (data.results && data.results[0] && data.results[0].data && data.results[0].data.groups) {
        // Обогащаем группы данными о непрочитанных уведомлениях
        const enrichedGroups = data.results[0].data.groups.map((group: Group) => {
          // Подсчитываем непрочитанные сообщения для группы
          const unreadMessages = notifications.filter(
            (n: Notification) => n.type === 'message' && n.groupId === group.id && !n.read
          ).length;
          
          // Используем getUnreadCountForGroup для получения счетчиков
          return {
            ...group,
            members_count: group.members_count || 0,
            // Добавляем счётчики для бейджей на основе данных из useNotifications
            unread_count: getUnreadCountForGroup(group.id, 'message'),
            new_intents_count: getUnreadCountForGroup(group.id, 'intent'),
            invites_count: getUnreadCountForGroup(group.id, 'invite')
          };
        });
        setGroups(enrichedGroups);
        
        // Если есть группы и нет активной, выбираем первую
        if (enrichedGroups.length > 0 && !activeGroupId) {
          setActiveGroupId(enrichedGroups[0].id);
        }
      } else {
        setGroups([]);
      }
    } catch (err) {
      console.error('Ошибка при загрузке групп:', err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  // Получение деталей группы
  const fetchGroupDetails = async (groupId: string) => {
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
              type: 'get_group_details',
              groupId
            }
          ]
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Не удалось загрузить детали группы');
      }

      return data.results?.[0]?.data;
    } catch (err) {
      console.error('Ошибка при загрузке деталей группы:', err);
      throw err;
    }
  };

  // Переключение на группу
  const switchToGroup = async (groupId: string) => {
    setActiveGroupId(groupId);
    // Здесь можно добавить дополнительную логику при смене группы
    // Например, загрузку интентов группы или членов группы
  };

  // Загрузка групп при монтировании компонента или изменении уведомлений
  useEffect(() => {
    if (displayUser?.id) {
      fetchGroups();
    }
  }, [displayUser?.id, notifications.length]);

  return {
    groups,
    loading,
    error,
    activeGroupId,
    fetchGroups,
    fetchGroupDetails,
    switchToGroup
  };
}

// Основной компонент переключателя групп
export function GroupSwitcher() {
  const {
    groups,
    loading,
    error,
    activeGroupId,
    switchToGroup
  } = useGroups();

  // Функция отрисовки иконки типа группы
  const renderGroupTypeIcon = (type: 'family' | 'team' | 'friends') => {
    switch (type) {
      case 'family':
        return <span className="text-red-500">👨‍👩‍👧‍👦</span>;
      case 'team':
        return <span className="text-blue-500">👥</span>;
      case 'friends':
        return <span className="text-green-500">🤝</span>;
      default:
        return <span className="text-gray-500">👥</span>;
    }
  };

  if (loading && groups.length === 0) {
    return (
      <div className="p-3 text-sm text-center text-gray-500">
        Загрузка групп...
      </div>
    );
  }

  if (error && groups.length === 0) {
    return (
      <div className="p-3 text-sm text-center text-red-500">
        Ошибка: {error}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="p-3 text-sm text-center text-gray-500">
        У вас пока нет групп
      </div>
    );
  }

  return (
    <div className="group-switcher">
      <h3 className="text-sm font-semibold px-3 py-2 text-gray-700">Мои группы</h3>
      <ul className="space-y-1">
        {groups.map((group) => (
          <li 
            key={group.id}
            className={`
              flex items-center px-3 py-2 text-sm rounded-lg cursor-pointer
              ${activeGroupId === group.id ? 'bg-indigo-100 text-indigo-900' : 'hover:bg-gray-100 text-gray-700'}
            `}
            onClick={() => switchToGroup(group.id)}
          >
            <span className="mr-2">{renderGroupTypeIcon(group.type)}</span>
            <span className="truncate">{group.name}</span>
            
            {/* Бейджи непрочитанных сообщений */}
            {group.unread_count ? (
              <span className="ml-2 flex-shrink-0 h-5 min-w-[20px] flex items-center justify-center text-xs bg-red-500 text-white rounded-full px-1">
                {group.unread_count}
              </span>
            ) : null}
            
            {/* Бейджи новых интентов */}
            {group.new_intents_count ? (
              <span className="ml-1 flex-shrink-0 h-5 min-w-[20px] flex items-center justify-center text-xs bg-green-500 text-white rounded-full px-1">
                {group.new_intents_count}
              </span>
            ) : null}
            
            {/* Бейджи новых приглашений для владельцев/админов */}
            {(group.user_role === 'owner' || group.user_role === 'admin') && group.invites_count ? (
              <span className="ml-1 flex-shrink-0 h-5 min-w-[20px] flex items-center justify-center text-xs bg-blue-500 text-white rounded-full px-1">
                {group.invites_count}
              </span>
            ) : null}
            
            {/* Маркер роли */}
            {group.user_role === 'owner' && (
              <span className="ml-auto text-xs bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">
                владелец
              </span>
            )}
            {group.user_role === 'admin' && (
              <span className="ml-auto text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                админ
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 px-3">
        <button
          className="w-full flex items-center justify-center px-3 py-1.5 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          <span className="mr-1">+</span> Создать группу
        </button>
      </div>
    </div>
  );
}

// Экспорт хука для использования в других компонентах
export { useGroups };
