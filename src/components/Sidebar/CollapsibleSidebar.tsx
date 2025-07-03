import React, { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { cn } from '@/lib/utils';
import { appState, toggleMobileMenu } from '@/lib/store';

interface CollapsibleSidebarProps {
  children: React.ReactNode;
  side: 'left' | 'right';
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    window.addEventListener('resize', listener);
    return () => window.removeEventListener('resize', listener);
  }, [matches, query]);

  return matches;
}

export default function CollapsibleSidebar({ children, side }: CollapsibleSidebarProps) {
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);
  const [isRightPanelExpanded, setIsRightPanelExpanded] = useState(false);
  const { isMobileMenuOpen } = useStore(appState);
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isMobile) {
    if (side === 'right') {
      return null;
    }
    
    return (
      <>
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            onClick={toggleMobileMenu}
          />
        )}
        <div
          className={cn(
            'fixed top-[60px] left-0 h-[calc(100vh-108px)] z-40 transition-transform duration-300 ease-in-out',
            'w-72 bg-[rgba(26,31,46,0.9)] backdrop-blur-[20px] border-r border-white/10',
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="h-full overflow-y-auto overflow-x-hidden">
            {React.Children.map(children, child => {
              if (React.isValidElement(child)) {
                return React.cloneElement(child, { isExpanded: true } as React.Attributes & { isExpanded: boolean });
              }
              return child;
            })}
          </div>
        </div>
      </>
    );
  }

  // For right sidebar, use state-controlled expansion
  const isExpanded = side === 'right' ? isRightPanelExpanded : isHoverExpanded;
  
  const sidebarClasses = cn(
    'fixed top-[60px] h-[calc(100vh-108px)] z-40 transition-all duration-300 ease-in-out',
    'bg-[rgba(26,31,46,0.9)] backdrop-blur-[20px]',
    side === 'left' ? 'left-0 border-r border-white/10' : 'right-0 border-l border-white/10',
    side === 'right' 
      ? (isExpanded ? 'w-[350px]' : 'w-[60px]')
      : (isExpanded ? 'w-[220px]' : 'w-[60px]')
  );

  const handleMouseEvents = side === 'left' ? {
    onMouseEnter: () => setIsHoverExpanded(true),
    onMouseLeave: () => setIsHoverExpanded(false)
  } : {};

  return (
    <div
      className={sidebarClasses}
      {...handleMouseEvents}
    >
      <div className="h-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            const props = { isExpanded } as React.Attributes & { isExpanded: boolean };
            if (side === 'right') {
              (props as any).setIsRightPanelExpanded = setIsRightPanelExpanded;
            }
            return React.cloneElement(child, props);
          }
          return child;
        })}
      </div>
    </div>
  );
}