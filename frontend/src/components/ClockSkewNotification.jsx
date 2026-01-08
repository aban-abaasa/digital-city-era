/**
 * Clock Skew Notification Component
 * Shows a banner if device clock is out of sync
 */

import React, { useState, useEffect } from 'react';

const ClockSkewNotification = () => {
  const [hasClockSkew, setHasClockSkew] = useState(false);
  const [skewMessage, setSkewMessage] = useState('');

  useEffect(() => {
    // Check for clock skew warning in console logs
    const checkForClockSkew = () => {
      // This is triggered if we detect clock skew from auth errors
      const clockSkewFlag = sessionStorage.getItem('clock_skew_detected');
      
      if (clockSkewFlag) {
        const skewData = JSON.parse(clockSkewFlag);
        setHasClockSkew(true);
        setSkewMessage(skewData.message || 'Device clock is out of sync');
      }
    };

    checkForClockSkew();
    
    // Listen for custom events
    const handleClockSkewEvent = (event) => {
      setHasClockSkew(true);
      setSkewMessage(event.detail?.message || 'Device clock is out of sync');
    };

    window.addEventListener('clock-skew-detected', handleClockSkewEvent);
    
    return () => {
      window.removeEventListener('clock-skew-detected', handleClockSkewEvent);
    };
  }, []);

  if (!hasClockSkew) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: '#fef2f2',
      borderBottom: '1px solid #fecaca',
      padding: '1rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      zIndex: 50
    }}>
      <div style={{ maxWidth: '1536px', margin: '0 auto', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        {/* Alert Icon */}
        <div style={{ 
          color: '#dc2626', 
          marginTop: '0.25rem',
          flexShrink: 0,
          fontSize: '1.25rem'
        }}>
          ⚠️
        </div>
        
        <div style={{ flex: 1 }}>
          <h3 style={{ 
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#7f1d1d',
            margin: 0
          }}>
            ⏰ Device Clock Out of Sync
          </h3>
          <p style={{ 
            fontSize: '0.875rem',
            color: '#b91c1c',
            marginTop: '0.25rem',
            marginBottom: 0
          }}>
            Your device's clock is not synchronized with the server. This is preventing Google sign-in from working.
          </p>
          <div style={{ 
            marginTop: '0.5rem',
            fontSize: '0.875rem',
            color: '#b91c1c',
            backgroundColor: '#fee2e2',
            padding: '0.75rem',
            borderRadius: '0.375rem'
          }}>
            <strong>Fix:</strong> Go to Settings → Date & Time → Enable "Automatic date and time"
          </div>
        </div>
        
        <button
          onClick={() => setHasClockSkew(false)}
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
          onMouseEnter={(e) => e.target.style.color = '#991b1b'}
          onMouseLeave={(e) => e.target.style.color = '#dc2626'}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default ClockSkewNotification;
