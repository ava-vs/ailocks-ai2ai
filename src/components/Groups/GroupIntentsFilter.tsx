import React, { useState, useEffect } from 'react';
import { useGroups } from './GroupSwitcher';
import { useAuth } from '@/hooks/useAuth';
import { useUserSession } from '@/hooks/useUserSession';

// Типы для интентов
interface GroupIntent {
  id: string;
  group_id: string;
  intent_id: string;
  intent: {
    id: string;
    title: string;
    content: string;
    status: string;
    created_at: Date;
    created_by: string;
    tags?: string[];
  };
}

// Хук для работы с интентами группы
function useGroupIntents(groupId: string | null) {
  const [intents, setIntents] = useState<GroupIntent[]>([]);
  const [filteredIntents, setFilteredIntents] = useState<GroupIntent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  
  const { user: authUser } = useAuth();
  const { currentUser } = useUserSession();
  const displayUser = authUser || currentUser;
  
  // Загрузка интентов группы
  const fetchIntents = async (groupId: string) => {
    if (!groupId) return;
    
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
              type: 'get_group_intents',
              groupId
            }
          ]
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Не удалось загрузить интенты группы');
      }

      if (data.results && data.results[0] && data.results[0].data && data.results[0].data.intents) {
        setIntents(data.results[0].data.intents);
        setFilteredIntents(data.results[0].data.intents);
      } else {
        setIntents([]);
        setFilteredIntents([]);
      }
    } catch (err) {
      console.error('Ошибка при загрузке интентов группы:', err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  // Фильтрация интентов
  const applyFilters = () => {
    let result = [...intents];
    
    // Фильтр по поисковому запросу
    if (filterValue) {
      const searchTerm = filterValue.toLowerCase();
      result = result.filter(item => 
        item.intent.title.toLowerCase().includes(searchTerm) || 
        item.intent.content.toLowerCase().includes(searchTerm)
      );
    }
    
    // Фильтр по статусу
    if (filterStatus) {
      result = result.filter(item => item.intent.status === filterStatus);
    }
    
    setFilteredIntents(result);
  };

  // Применяем фильтры при изменении параметров
  useEffect(() => {
    applyFilters();
  }, [filterValue, filterStatus, intents]);

  // Загружаем интенты при изменении groupId
  useEffect(() => {
    if (groupId) {
      fetchIntents(groupId);
    } else {
      setIntents([]);
      setFilteredIntents([]);
    }
  }, [groupId]);

  return {
    intents: filteredIntents,
    loading,
    error,
    filterValue,
    setFilterValue,
    filterStatus,
    setFilterStatus,
    fetchIntents
  };
}

// Основной компонент фильтра интентов группы
export function GroupIntentsFilter() {
  const { activeGroupId } = useGroups();
  const { 
    intents, 
    loading, 
    error,
    filterValue,
    setFilterValue,
    filterStatus,
    setFilterStatus
  } = useGroupIntents(activeGroupId);

  // Форматирование даты
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ru', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(date));
  };

  // Статусы интентов
  const statuses = [
    { value: null, label: 'Все' },
    { value: 'open', label: 'Открытые' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'completed', label: 'Завершённые' },
    { value: 'archived', label: 'Архивные' }
  ];

  if (!activeGroupId) {
    return (
      <div className="text-center p-4 text-gray-500">
        Выберите группу для отображения интентов
      </div>
    );
  }

  return (
    <div className="group-intents-filter">
      <div className="flex items-center mb-4">
        <div className="flex-1 mr-2">
          <input
            type="text"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder="Поиск интентов..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div>
          <select
            value={filterStatus || ''}
            onChange={(e) => setFilterStatus(e.target.value === '' ? null : e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            {statuses.map((status) => (
              <option key={status.value || 'all'} value={status.value || ''}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-4">
          <div className="w-6 h-6 border-4 border-gray-300 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="text-center p-4 text-red-500">
          Ошибка: {error}
        </div>
      ) : intents.length === 0 ? (
        <div className="text-center p-4 text-gray-500">
          {filterValue || filterStatus ? 
            'Нет интентов, соответствующих фильтрам' : 
            'В этой группе пока нет интентов'}
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {intents.map((item) => (
            <div key={item.id} className="py-3 group cursor-pointer hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700">
                  {item.intent.title}
                </h3>
                <span className="text-xs text-gray-500">
                  {formatDate(item.intent.created_at)}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-600 line-clamp-2">
                {item.intent.content}
              </p>
              <div className="mt-2 flex items-center">
                <span 
                  className={`
                    inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                    ${item.intent.status === 'open' ? 'bg-green-100 text-green-800' :
                      item.intent.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      item.intent.status === 'completed' ? 'bg-indigo-100 text-indigo-800' :
                      'bg-gray-100 text-gray-800'}
                  `}
                >
                  {item.intent.status === 'open' ? 'Открыт' :
                   item.intent.status === 'in_progress' ? 'В работе' :
                   item.intent.status === 'completed' ? 'Завершен' :
                   item.intent.status === 'archived' ? 'В архиве' : 
                   item.intent.status}
                </span>
                {item.intent.tags && item.intent.tags.length > 0 && (
                  <div className="ml-2 flex items-center space-x-1">
                    {item.intent.tags.slice(0, 3).map((tag, idx) => (
                      <span 
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                      >
                        {tag}
                      </span>
                    ))}
                    {item.intent.tags.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{item.intent.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Экспорт хука для использования в других компонентах
export { useGroupIntents };
