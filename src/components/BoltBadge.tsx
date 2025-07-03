import React from 'react';

export default function BoltBadge() {
  return (
    <a 
      href="https://bolt.new/" 
      target="_blank" 
      rel="noopener noreferrer"
      className="fixed top-20 right-4 md:right-24 z-50 transition-transform hover:scale-110"
      aria-label="Built with Bolt.new"
    >
      <img 
        src="/images/bolt-badge-white.png" 
        alt="Built with Bolt.new" 
        className="w-12 h-12 md:w-16 md:h-16"
      />
    </a>
  );
}