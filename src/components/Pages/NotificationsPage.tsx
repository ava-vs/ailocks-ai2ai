import useNotifications, { type Notification } from '@/hooks/useNotifications';
import { Bell, MessageSquare, UserPlus, FileText, CheckCircle, Trash2 } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning';
}

export default function NotificationsPage() {
  const { notifications, loading, error, markAsRead, markAllAsRead } = useNotifications();

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'invite':
        return <UserPlus className="h-5 w-5 text-blue-400" />;
      case 'message':
        return <MessageSquare className="h-5 w-5 text-green-400" />;
      case 'intent':
        return <FileText className="h-5 w-5 text-purple-400" />;
      default:
        return <Bell className="h-5 w-5 text-gray-400" />;
    }
  };

  const formatTimeAgo = (dateInput: string | Date | undefined | null) => {
    if (!dateInput) return '';
    try {
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      if (!date || isNaN(date.getTime())) {
        console.error('Invalid date provided to formatTimeAgo:', dateInput);
        return 'Invalid Date';
      }
      const now = new Date();
      const diff = now.getTime() - date.getTime();

      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) return `${days}д назад`;
      if (hours > 0) return `${hours}ч назад`;
      if (minutes > 0) return `${minutes}м назад`;
      return 'только что';
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'Invalid Date';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading notifications...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-400">{error.message}</div>;
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <h1 className="text-3xl font-bold text-white flex items-center gap-2"><Bell className="w-7 h-7" /> Notifications</h1>

        {notifications.length === 0 ? (
          <p className="text-white/70">You have no notifications right now.</p>
        ) : (
          <ul className="space-y-4">
            {notifications.map((item) => (
              <li key={item.id} className="flex items-start gap-4 bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex-shrink-0">
                  {getIcon(item.type)}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="text-sm text-gray-300" style={{ whiteSpace: 'pre-wrap' }}>{item.message}</p>
                </div>
                <p className="text-sm text-gray-400 whitespace-nowrap">
                  {formatTimeAgo(item.createdAt)}
                </p>
                {!item.read && (
                  <button
                    onClick={() => markAsRead(item.id)}
                    className="text-xs text-blue-400 hover:underline"
                  >
                    Mark as read
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
} 