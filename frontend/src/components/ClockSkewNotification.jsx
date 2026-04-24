/**
 * Clock Skew Notification
 * Shows a banner when the browser session has detected time drift.
 */

import React, { useEffect, useState } from 'react';
import { clearClockSkewState, getClockSkewState } from '../utils/clockDiagnostic.js';

const ClockSkewNotification = () => {
  const [hasClockSkew, setHasClockSkew] = useState(false);
  const [skewData, setSkewData] = useState(null);

  useEffect(() => {
    const syncFromStorage = () => {
      const stored = getClockSkewState();

      if (stored) {
        setHasClockSkew(true);
        setSkewData(stored);
      }
    };

    syncFromStorage();

    const handleClockSkewEvent = (event) => {
      setHasClockSkew(true);
      setSkewData(event.detail || null);
    };

    window.addEventListener('clock-skew-detected', handleClockSkewEvent);

    return () => {
      window.removeEventListener('clock-skew-detected', handleClockSkewEvent);
    };
  }, []);

  const handleDismiss = () => {
    clearClockSkewState();
    setHasClockSkew(false);
    setSkewData(null);
  };

  if (!hasClockSkew) {
    return null;
  }

  const skewSeconds =
    typeof skewData?.skew === 'number'
      ? Math.abs(skewData.skew)
      : null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fef2f2',
        borderBottom: '1px solid #fecaca',
        padding: '1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        zIndex: 50
      }}
    >
      <div
        style={{
          maxWidth: '1536px',
          margin: '0 auto',
          display: 'flex',
          gap: '1rem',
          alignItems: 'flex-start'
        }}
      >
        <div
          style={{
            color: '#dc2626',
            marginTop: '0.25rem',
            flexShrink: 0,
            fontSize: '1.25rem'
          }}
        >
          !
        </div>

        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#7f1d1d',
              margin: 0
            }}
          >
            Device clock out of sync
          </h3>
          <p
            style={{
              fontSize: '0.875rem',
              color: '#b91c1c',
              marginTop: '0.25rem',
              marginBottom: 0
            }}
          >
            Your device time does not match the time expected by the auth
            session. Supabase sign-in can fail until the clock is corrected.
          </p>
          <div
            style={{
              marginTop: '0.5rem',
              fontSize: '0.875rem',
              color: '#b91c1c',
              backgroundColor: '#fee2e2',
              padding: '0.75rem',
              borderRadius: '0.375rem'
            }}
          >
            <strong>Fix:</strong> enable automatic date and time in your device
            settings, then retry sign-in.
            {skewSeconds !== null ? ` Detected skew: ${skewSeconds} seconds.` : ''}
          </div>
        </div>

        <button
          onClick={handleDismiss}
          style={{
            color: '#dc2626',
            background: 'none',
            border: 'none',
            fontWeight: 500,
            fontSize: '0.875rem',
            cursor: 'pointer',
            padding: 0,
            marginTop: '0.25rem'
          }}
          onMouseEnter={(e) => {
            e.target.style.color = '#991b1b';
          }}
          onMouseLeave={(e) => {
            e.target.style.color = '#dc2626';
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default ClockSkewNotification;
