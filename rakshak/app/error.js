'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('[Sahaay] App error:', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh', background: '#0F172A', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#F1F5F9', margin: '0 0 8px' }}>
        Something went wrong
      </h2>
      <p style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', margin: '0 0 24px', maxWidth: 320 }}>
        {error?.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={reset}
          style={{
            padding: '10px 20px', background: '#3B82F6', border: 'none',
            borderRadius: 8, color: '#FFF', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Try Again
        </button>
        <button
          onClick={() => window.location.href = '/'}
          style={{
            padding: '10px 20px', background: '#1E293B', border: '1px solid #334155',
            borderRadius: 8, color: '#94A3B8', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Go Home
        </button>
      </div>
    </div>
  );
}
