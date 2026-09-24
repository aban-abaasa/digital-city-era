import React from 'react';
import PortalHeader from './PortalHeader';

// Shown while a portal's page is being fetched. The shared header stays put
// (same as BodaGoEra's unified header staying while a role's dashboard loads),
// so switching portals feels like changing a page, not reloading the app.
const PortalPageFallback = () => (
  <div className="min-h-screen">
    <PortalHeader />
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600" />
    </div>
  </div>
);

export default PortalPageFallback;
