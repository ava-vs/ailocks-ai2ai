import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { appState, setMode, setLanguage } from '@/lib/store';
import { useLocation } from '@/hooks/useLocation';
import { Bot, Zap, Globe, MapPin, Database, AlertCircle } from 'lucide-react';

export default function StatusBar() {
  const { activeMode, language } = useStore(appState);
  const location = useLocation();
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'loading'>('loading');
  const [aiStatus, setAiStatus] = useState<'available' | 'unavailable' | 'loading'>('loading');

  useEffect(() => {
    // Check database status
    const checkDbStatus = async () => {
      try {
        const response = await fetch('/.netlify/functions/db-status');
        if (response.ok) {
          const data = await response.json();
          setDbStatus(data.database === 'connected' ? 'connected' : 'error');
        } else {
          setDbStatus('error');
        }
      } catch (error) {
        console.error('Failed to check database status:', error);
        setDbStatus('error');
      }
    };

    // Check AI service status
    const checkAiStatus = async () => {
      try {
        const response = await fetch('/.netlify/functions/ai-health-check');
        if (response.ok) {
          const data = await response.json();
          setAiStatus(data.status === 'ok' ? 'available' : 'unavailable');
        } else {
          setAiStatus('unavailable');
        }
      } catch (error) {
        console.error('Failed to check AI service status:', error);
        setAiStatus('unavailable');
      }
    };

    checkDbStatus();
    checkAiStatus();
  }, []);

  const handleModeChange = (mode: string) => {
    setMode(mode as any);
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang as any);
  };

  return (
    <div className="status-bar flex items-center justify-between px-6">
      {/* LEFT STATUS */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
          <span className="text-xs text-gray-400">Multi-Modal AI Active</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span className="text-xs text-gray-400">Secure Connection</span>
        </div>
      </div>
      
      {/* RIGHT STATUS */}
      <div className="flex items-center gap-6">
        <span className="text-xs text-gray-400">Ailocks v8.0 • Ai2Ai Network</span>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span className="text-xs text-gray-400 px-2 py-1 border border-gray-600 rounded-lg bg-slate-800/50">
            Built on Bolt
          </span>
        </div>
      </div>
    </div>
  );
}