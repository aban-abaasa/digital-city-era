/**
 * Clock diagnostic helper.
 * Detects device clock skew and exposes it to the UI.
 */

const CLOCK_SKEW_STORAGE_KEY = 'clock_skew_detected';
const CLOCK_SKEW_EVENT = 'clock-skew-detected';
const SKEW_WARNING_SECONDS = 60;
const SKEW_CRITICAL_SECONDS = 300;

let consolePatched = false;
let lastWarningSignature = '';

const isLikelyClockSkewWarning = (message) =>
  /@supabase\/gotrue-js|session as retrieved from url|issued in the future|clock skew/i.test(message);

const safeSessionWrite = (key, value) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
};

const safeSessionRead = (key) => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSessionRemove = (key) => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
};

const dispatchClockSkewEvent = (detail) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.dispatchEvent(new CustomEvent(CLOCK_SKEW_EVENT, { detail }));
  } catch {
    // Ignore event dispatch errors in older browser contexts.
  }
};

const persistClockSkew = (detail) => {
  const payload = {
    ...detail,
    detectedAt: new Date().toISOString()
  };

  safeSessionWrite(CLOCK_SKEW_STORAGE_KEY, JSON.stringify(payload));
  dispatchClockSkewEvent(payload);

  return payload;
};

const extractTokenTimes = (message) => {
  const timeMatch = message.match(/(\d{10})\s+(\d{10})\s+(\d{10})/);

  if (!timeMatch) {
    return null;
  }

  return {
    tokenIssuedTime: Number.parseInt(timeMatch[1], 10),
    tokenExpireTime: Number.parseInt(timeMatch[2], 10),
    currentTime: Number.parseInt(timeMatch[3], 10)
  };
};

export const checkClockSkew = () => {
  const deviceTime = Math.floor(Date.now() / 1000);

  console.log('[CLOCK DIAGNOSTIC]');
  console.log('Device time (UTC):', new Date(deviceTime * 1000).toISOString());
  console.log('Device timestamp:', deviceTime);

  return {
    deviceTime,
    deviceDate: new Date(deviceTime * 1000).toISOString(),
    timestamp: Date.now()
  };
};

export const validateTokenTiming = (tokenIssuedTime, tokenExpireTime, options = {}) => {
  const { log = true, source = 'auth-session' } = options;
  const now = Math.floor(Date.now() / 1000);
  const skew = now - tokenIssuedTime;

  if (log) {
    console.warn('[TOKEN TIMING]');
    console.warn('Token issued:', new Date(tokenIssuedTime * 1000).toISOString());
    console.warn('Token expires:', new Date(tokenExpireTime * 1000).toISOString());
    console.warn('Current time:', new Date(now * 1000).toISOString());
    console.warn('Clock skew:', skew, 'seconds');
  }

  if (skew < -SKEW_CRITICAL_SECONDS) {
    return persistClockSkew({
      status: 'CRITICAL',
      skew,
      source,
      message: 'Device clock is too far behind'
    });
  }

  if (skew < -SKEW_WARNING_SECONDS) {
    return persistClockSkew({
      status: 'WARNING',
      skew,
      source,
      message: 'Device clock is behind'
    });
  }

  if (skew > SKEW_WARNING_SECONDS) {
    return persistClockSkew({
      status: 'WARNING',
      skew,
      source,
      message: 'Device clock is ahead'
    });
  }

  return {
    status: 'OK',
    skew,
    source,
    message: 'Device clock is synchronized'
  };
};

export const getClockSkewState = () => {
  const raw = safeSessionRead(CLOCK_SKEW_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const clearClockSkewState = () => {
  safeSessionRemove(CLOCK_SKEW_STORAGE_KEY);
};

export const initClockDiagnostic = () => {
  if (typeof window === 'undefined') {
    return;
  }

  checkClockSkew();

  if (consolePatched) {
    return;
  }

  consolePatched = true;

  const originalWarn = console.warn.bind(console);

  console.warn = (...args) => {
    const message = args.map((arg) => String(arg)).join(' ');

    if (isLikelyClockSkewWarning(message)) {
      if (message !== lastWarningSignature) {
        lastWarningSignature = message;

        const extractedTimes = extractTokenTimes(message);

        if (extractedTimes) {
          validateTokenTiming(
            extractedTimes.tokenIssuedTime,
            extractedTimes.tokenExpireTime,
            { log: false, source: 'supabase-warning' }
          );
        } else {
          persistClockSkew({
            status: 'WARNING',
            skew: null,
            source: 'supabase-warning',
            message: 'Clock skew detected while processing an auth session',
            rawMessage: message
          });
        }
      }
    }

    return originalWarn(...args);
  };
};
