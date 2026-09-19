import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// React Router doesn't reset scroll position on navigation (browser default
// is for full page loads, not SPA route swaps). Without this, switching
// between portals (e.g. Customer -> Cashier) while scrolled down mounts the
// new page already scrolled, so its fixed header/content look broken until
// the user manually scrolls up. Most jarring on phones since portal pages
// are typically viewed scrolled.
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
