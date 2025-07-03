import { atom, map } from 'nanostores';
import type { FullAilockProfile as AilockProfile } from './ailock/shared';

export type AIMode = 'researcher' | 'creator' | 'analyst';
export type Language = 'en' | 'ru';

export interface UserLocation {
  country: string;
  city: string;
  timezone: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

interface AppState {
  activeMode: AIMode;
  language: Language;
  location: UserLocation | null;
  isMobileMenuOpen: boolean;
  isClientInitialized: boolean;
}

export const appState = map<AppState>({
  activeMode: 'researcher',
  language: 'en',
  location: null,
  isMobileMenuOpen: false,
  isClientInitialized: false,
});

// Getter for client initialization status
export const isClientInitialized = atom(false);

// Actions to update the store
export function initializeClient() {
  if (typeof window !== 'undefined' && !appState.get().isClientInitialized) {
    const storedLang = localStorage.getItem('ailocks-language') as Language | null;
    if (storedLang && ['en', 'ru'].includes(storedLang)) {
      appState.setKey('language', storedLang);
    }
    appState.setKey('isClientInitialized', true);
  }
}

export function setMode(mode: AIMode) {
  appState.setKey('activeMode', mode);
}

export function setLanguage(language: Language) {
  const currentLanguage = appState.get().language;
  if (currentLanguage !== language) {
    appState.setKey('language', language);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ailocks-language', language);
    }
  }
}

export function setLocation(location: UserLocation) {
  appState.setKey('location', location);
}

export function toggleMobileMenu() {
  appState.setKey('isMobileMenuOpen', !appState.get().isMobileMenuOpen);
}

// Legacy stores - can be phased out
export const currentLanguage = atom<Language>('en');
export const userLocation = atom<UserLocation>({ country: 'US', city: 'New York', timezone: 'America/New_York', isDefault: true });

// Sync legacy stores with the main appState
appState.subscribe(state => {
  currentLanguage.set(state.language);
  if (state.location) {
    userLocation.set(state.location);
  }
});

// Initialize from server-detected data only on client
if (typeof window !== 'undefined') {
  // Client-side initialization
  const initializeFromServer = () => {
    // Mark as initialized
    isClientInitialized.set(true);
    
    // Initialize language from server meta tag first (for hydration consistency)
    const detectedLang = document.querySelector('meta[name="detected-language"]')?.getAttribute('content');
    if (detectedLang && ['en', 'ru'].includes(detectedLang)) {
      currentLanguage.set(detectedLang as Language);
    } else {
      const browserLang = navigator.language.split('-')[0];
      if (browserLang === 'ru') {
        currentLanguage.set('ru');
      } else {
        currentLanguage.set('en');
      }
    }

    // Initialize location from server data
    const userLocationMeta = document.querySelector('meta[name="user-location"]')?.getAttribute('content');
    if (userLocationMeta) {
      try {
        const locationData = JSON.parse(userLocationMeta);
        userLocation.set(locationData);
      } catch (error) {
        console.warn('Failed to parse user location from meta tag:', error);
      }
    }
  };

  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFromServer);
  } else {
    initializeFromServer();
  }
}

// --- Ailock Profile Store ---

export type FullAilockProfile = AilockProfile;

export interface AilockState {
  profile: FullAilockProfile | null;
  isLoading: boolean;
  error: string | null;
}

export const ailockStore = map<AilockState>({
  profile: null,
  isLoading: false,
  error: null,
});

export function setAilockProfile(profile: FullAilockProfile | null) {
  ailockStore.setKey('profile', profile);
  ailockStore.setKey('isLoading', false);
  ailockStore.setKey('error', null);
}

export function setAilockLoading(isLoading: boolean) {
  ailockStore.setKey('isLoading', isLoading);
}

export function setAilockError(error: string | null) {
  ailockStore.setKey('error', error);
  ailockStore.setKey('isLoading', false);
}