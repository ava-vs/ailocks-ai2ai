'use client';

import { useEffect, useState } from 'react';
import VoiceAgentWidget from './VoiceAgentWidget';

export default function VoiceAgentClientWrapper() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Не рендерим ничего на сервере
  if (!isClient) {
    return null;
  }

  return <VoiceAgentWidget />;
} 