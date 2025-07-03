import { Home, Lock, Key, LogOut, History, Bookmark, Clock } from 'lucide-react';
import type { LucideProps } from 'lucide-react';

const icons = {
  home: Home,
  ailock: Lock,
  key: Key,
  logout: LogOut,
  history: History,
  bookmark: Bookmark,
  recent: Clock,
};

interface IconProps extends LucideProps {
  name: keyof typeof icons;
}

export const Icon = ({ name, ...props }: IconProps) => {
  const LucideIcon = icons[name];
  if (!LucideIcon) {
    return null;
  }
  return <LucideIcon {...props} />;
}; 