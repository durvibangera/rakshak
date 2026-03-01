/**
 * FILE: AlertBanner.js
 * PURPOSE: Emergency alert banner displayed at the top of all pages during active alerts.
 *
 * CONTEXT: When a disaster alert is active (e.g., flood warning), a persistent
 *          banner appears at the top of every page showing the alert message in the
 *          user's language. Shows severity-appropriate colors and pulsing animation
 *          for HIGH severity alerts.
 *
 * ROLE ACCESS: BOTH
 *
 * EXPORTS:
 *   - AlertBanner: React component
 *
 * KEY DEPENDENCIES:
 *   - hooks/useRealtimeAlerts.js
 */

'use client';

import { useState, useEffect } from 'react';
import { useRealtimeAlerts } from '@/hooks/useRealtimeAlerts';

const SEVERITY_STYLES = {
  HIGH: {
    bg: '#DC2626',
    border: '#991B1B',
    text: '#FFFFFF',
    icon: '⚠',
    label: 'CRITICAL',
  },
  MEDIUM: {
    bg: '#F97316',
    border: '#C2410C',
    text: '#FFFFFF',
    icon: '⚡',
    label: 'WARNING',
  },
  LOW: {
    bg: '#EAB308',
    border: '#A16207',
    text: '#1F2937',
    icon: 'ℹ',
    label: 'ADVISORY',
  },
};

export default function AlertBanner() {
  const { alerts, loading } = useRealtimeAlerts();
  const [dismissed, setDismissed] = useState(new Set());
  const [lastAlertCount, setLastAlertCount] = useState(0);

  // Re-show banners when new alerts arrive
  useEffect(() => {
    if (alerts.length > lastAlertCount) {
      setDismissed(new Set());
    }
    setLastAlertCount(alerts.length);
  }, [alerts.length, lastAlertCount]);

  if (loading || !alerts || alerts.length === 0) return null;

  // Filter active, non-dismissed alerts
  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.id));
  if (visibleAlerts.length === 0) return null;

  return (
    <div style={{ position: 'relative', zIndex: 9999 }}>
      {visibleAlerts.map((alert) => {
        const severity = alert.severity?.toUpperCase() || 'MEDIUM';
        const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.MEDIUM;
        const isFlood = alert.type === 'FLOOD';
        const isHigh = severity === 'HIGH';

        return (
          <div
            key={alert.id}
            style={{
              backgroundColor: style.bg,
              borderBottom: `2px solid ${style.border}`,
              color: style.text,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: '14px',
              fontWeight: 600,
              animation: isHigh ? 'alert-pulse 2s ease-in-out infinite' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
              <span style={{ fontSize: '20px' }} role="img" aria-label="alert">
                {style.icon}
              </span>

              <span
                style={{
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}
              >
                {style.label}
              </span>

              <span>
                {isFlood && isHigh
                  ? '⚠ Flood Risk Detected — Move to safety immediately!'
                  : alert.message || 'Disaster alert active in your area'}
              </span>
            </div>

            <button
              onClick={() => setDismissed((prev) => new Set([...prev, alert.id]))}
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: 'none',
                color: style.text,
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                flexShrink: 0,
              }}
              aria-label="Dismiss alert"
            >
              ✕
            </button>
          </div>
        );
      })}

      {/* Pulsing animation for HIGH severity */}
      <style>{`
        @keyframes alert-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
