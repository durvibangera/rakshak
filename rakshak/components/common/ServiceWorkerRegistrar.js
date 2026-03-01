/**
 * FILE: ServiceWorkerRegistrar.js
 * PURPOSE: Registers the service worker on mount.
 *          Handles update notifications and lifecycle events.
 *
 * ROLE ACCESS: ALL — runs silently in the background for every user.
 */

'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Don't register SW in development (causes caching issues)
    const isDev = window.location.hostname === 'localhost'
      || window.location.hostname === '127.0.0.1';

    async function registerSW() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        console.log('[SW] Registered:', registration.scope);

        // Check for updates periodically (every 30 min)
        setInterval(() => {
          registration.update().catch(() => {});
        }, 30 * 60 * 1000);

        // Handle new SW waiting to activate
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // New version available — auto-activate
              console.log('[SW] New version available, activating...');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        // Reload page when a new SW takes over
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            refreshing = true;
            console.log('[SW] Controller changed, reloading...');
            window.location.reload();
          }
        });
      } catch (err) {
        console.warn('[SW] Registration failed:', err);
      }
    }

    // Register after page load to not block critical rendering
    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW, { once: true });
    }
  }, []);

  // This component renders nothing
  return null;
}
