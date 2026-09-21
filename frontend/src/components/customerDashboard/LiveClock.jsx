import React, { useEffect, useState } from 'react';

// Each of these owns its own timer so only the tiny text node re-renders —
// the dashboard used to tick a `currentTime` state every second, re-rendering
// the entire 2,000-line page (and everything under it) 60x a minute just to
// repaint a clock in the header.
function useNow(intervalMs) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function Greeting({ className = '' }) {
  const hour = useNow(60000).getHours();
  const text = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return <span className={className}>{text}</span>;
}

export function LiveClock({ className = '' }) {
  const now = useNow(15000);
  return (
    <span className={className}>
      {now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
      {' · '}
      {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
    </span>
  );
}
