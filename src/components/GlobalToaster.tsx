'use client';

import { Toaster } from 'react-hot-toast';

export default function GlobalToaster() {
  return (
    <Toaster
      position="bottom-center"
      toastOptions={{
        className: '',
        style: {
          border: '1px solid #7132f5',
          padding: '16px',
          color: '#e5e7eb',
          background: '#1f2937',
        },
      }}
    />
  );
} 