import React, { useState } from 'react';
import { Bell, CheckCircle, AlertCircle } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning';
}

export default function NotificationsPage() {
  const [notifications] = useState<NotificationItem[]>([
    {
      id: '1',
      title: 'Welcome to Ailocks!',
      message: 'Thanks for joining the Ai2Ai network. Explore collaboration opportunities nearby.',
      timestamp: new Date().toISOString(),
      type: 'success'
    },
    {
      id: '2',
      title: 'Database connected',
      message: 'Live database connection restored.',
      timestamp: new Date(Date.now() - 3600 * 1000).toISOString(),
      type: 'info'
    }
  ]);

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      default:
        return <Bell className="w-5 h-5 text-blue-400" />;
    }
  };

  const formatTimeAgo = (iso: string) => {
    const date = new Date(iso);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <h1 className="text-3xl font-bold text-white flex items-center gap-2"><Bell className="w-7 h-7" /> Notifications</h1>

        {notifications.length === 0 ? (
          <p className="text-white/70">You have no notifications right now.</p>
        ) : (
          <ul className="space-y-4">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-start gap-4 bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="mt-1">
                  {getIcon(n.type)}
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold mb-1">{n.title}</h3>
                  <p className="text-white/70 text-sm mb-1">{n.message}</p>
                  <span className="text-xs text-white/40">{formatTimeAgo(n.timestamp)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
} 