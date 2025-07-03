import { useState, useEffect } from 'react';

type Language = 'en' | 'ru';

interface TranslationStrings {
  'chat.placeholder': string;
  'chat.welcome': string;
  'chat.help_text': string;
  'mode.researcher': string;
  'mode.creator': string;
  'mode.analyst': string;
  'action.search_nearby': string;
  'action.analyze_trends': string;
  'action.find_sources': string;
  'location.connected': string;
  'intents.nearby': string;
  'header.title': string;
  'status.connected': string;
  'status.reconnecting': string;
}

const translations: Record<Language, TranslationStrings> = {
  en: {
    'chat.placeholder': 'Ask Ailocks anything in {mode} mode...',
    'chat.welcome': "Hello! I'm Ailocks, your AI assistant.",
    'chat.help_text': "I'm here to help you. Ask me anything or use the context actions below!",
    'mode.researcher': 'Researcher',
    'mode.creator': 'Creator', 
    'mode.analyst': 'Analyst',
    'action.search_nearby': 'Search Nearby',
    'action.analyze_trends': 'Analyze Trends',
    'action.find_sources': 'Find Sources',
    'location.connected': 'Connected',
    'intents.nearby': 'Nearby Opportunities',
    'header.title': 'Ailocks: Ai2Ai Network',
    'status.connected': 'Connected',
    'status.reconnecting': 'Reconnecting...'
  },
  ru: {
    'chat.placeholder': 'Спросите Ailocks что-нибудь в режиме {mode}...',
    'chat.welcome': 'Привет! Я Ailocks, ваш ИИ-ассистент.',
    'chat.help_text': 'Я здесь, чтобы помочь вам. Задайте любой вопрос или используйте контекстные действия ниже!',
    'mode.researcher': 'Исследователь',
    'mode.creator': 'Создатель',
    'mode.analyst': 'Аналитик', 
    'action.search_nearby': 'Поиск рядом',
    'action.analyze_trends': 'Анализ трендов',
    'action.find_sources': 'Найти источники',
    'location.connected': 'Подключено',
    'intents.nearby': 'Возможности рядом',
    'header.title': 'Ailocks: Ai2Ai Сеть',
    'status.connected': 'Подключено',
    'status.reconnecting': 'Переподключение...'
  }
};

export function useI18n() {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    // Detect language from browser/location
    const detectLanguage = () => {
      const browserLang = navigator.language.split('-')[0] as Language;
      const savedLang = localStorage.getItem('ailocks-language') as Language;
      
      if (savedLang && ['en', 'ru'].includes(savedLang)) {
        setLanguage(savedLang);
      } else if (browserLang === 'ru') {
        setLanguage('ru');
      }
    };

    detectLanguage();
  }, []);

  const changeLanguage = (newLanguage: Language) => {
    setLanguage(newLanguage);
    localStorage.setItem('ailocks-language', newLanguage);
  };

  const t = (key: keyof TranslationStrings, params?: Record<string, string>): string => {
    let translation = translations[language][key] || translations.en[key] || key;
    
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        translation = translation.replace(`{${param}}`, value);
      });
    }
    
    return translation;
  };

  return { language, setLanguage: changeLanguage, t };
}