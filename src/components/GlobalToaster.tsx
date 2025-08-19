'use client';

import { Toaster } from 'react-hot-toast';

export default function GlobalToaster() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        className: '',
        duration: 2500, 
        style: {
          border: '1px solid #7132f5',
          padding: '10px',
          color: '#e5e7eb',
          background: '#1f2937',
          fontSize: '0.875rem',
          maxWidth: '300px',
          borderRadius: '8px',
        },
        success: {
          iconTheme: {
            primary: '#10b981',
            secondary: '#e5e7eb',
          },
          style: {
            border: '1px solid #10b981',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: '#e5e7eb',
          },
          style: {
            border: '1px solid #ef4444',
          },
        },
      }}
    />
  );
}