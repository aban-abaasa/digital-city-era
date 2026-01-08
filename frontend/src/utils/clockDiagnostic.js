/**
 * Clock Diagnostic Utility
 * Detects and reports device clock skew issues
 * This helps identify when device time is out of sync with server
 */

export const checkClockSkew = () => {
  // Current device time in seconds
  const deviceTime = Math.floor(Date.now() / 1000);
  
  console.log('📊 [CLOCK DIAGNOSTIC]');
  console.log('🕐 Device time (UTC):', new Date(deviceTime * 1000).toISOString());
  console.log('🕐 Device timestamp:', deviceTime);
  
  // Return diagnostic info
  return {
    deviceTime,
    deviceDate: new Date(deviceTime * 1000).toISOString(),
    timestamp: Date.now()
  };
};

export const validateTokenTiming = (tokenIssuedTime, tokenExpireTime) => {
  const now = Math.floor(Date.now() / 1000);
  const skew = now - tokenIssuedTime;
  
  console.warn('⚠️ [TOKEN TIMING]');
  console.warn('Token issued:', new Date(tokenIssuedTime * 1000).toISOString());
  console.warn('Token expires:', new Date(tokenExpireTime * 1000).toISOString());
  console.warn('Current time:', new Date(now * 1000).toISOString());
  console.warn('Clock skew:', skew, 'seconds');
  
  if (skew < -300) {
    console.error('❌ CRITICAL: Device clock is TOO FAR BEHIND (skew:', skew, 'sec)');
    console.error('📱 Fix: Go to Settings → Date & Time → Enable "Automatic date and time"');
    return { status: 'CRITICAL', skew, message: 'Device clock is too far behind' };
  } else if (skew < -60) {
    console.error('❌ WARNING: Device clock is behind by', Math.abs(skew), 'seconds');
    return { status: 'WARNING', skew, message: 'Device clock is slightly behind' };
  } else if (skew > 60) {
    console.error('❌ WARNING: Device clock is ahead by', skew, 'seconds');
    return { status: 'WARNING', skew, message: 'Device clock is ahead' };
  } else {
    console.log('✅ Clock is in sync (skew:', skew, 'sec)');
    return { status: 'OK', skew, message: 'Device clock is synchronized' };
  }
};

// Run diagnostic on page load
export const initClockDiagnostic = () => {
  if (typeof window !== 'undefined') {
    checkClockSkew();
    
    // Also check if there are any token timing warnings from Supabase
    const originalWarn = console.warn;
    console.warn = function(...args) {
      const message = args.join(' ');
      
      if (message.includes('future') || message.includes('clock') || message.includes('skew')) {
        console.error('🚨 DETECTED: Clock skew issue!');
        console.error('Full message:', message);
        
        // Try to extract token times from error message
        const timeMatch = message.match(/(\d{10})\s+(\d{10})\s+(\d{10})/);
        if (timeMatch) {
          validateTokenTiming(parseInt(timeMatch[1]), parseInt(timeMatch[2]));
        }
      }
      
      originalWarn.apply(console, args);
    };
  }
};
