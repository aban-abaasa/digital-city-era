import React from 'react';

/**
 * Not real links. No visible label, no tab stop, hidden from screen
 * readers — a human never finds these. A scanner that crawls every
 * <a href> on the page will. Mounted once at the app root (see App.jsx) so
 * it's present on every route, not just the landing page. Paths must match
 * public/robots.txt's Disallow entries and the decoy trap in
 * backend/src/middleware/canweShield.js exactly.
 */
const HiddenDecoyLinks = () => (
  <div
    aria-hidden="true"
    style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', left: '-9999px' }}
  >
    <a href="/api/admin/export-transactions.json" tabIndex={-1}>export</a>
    <a href="/api/v1/debug/pos-keys" tabIndex={-1}>debug keys</a>
  </div>
);

export default HiddenDecoyLinks;
