import express from 'express';
import { decoyRouteTrap, honeytokenReportHandler } from '../middleware/canweShield.js';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export function buildSecurityRoutes(supabase) {
  const router = express.Router();
  const noopTrap = (req, res) => res.status(200).json({ success: true, data: [] });

  // Client reports a filled honeytoken field from any staff/customer login form.
  router.post('/report', supabase ? honeytokenReportHandler(supabase) : noopTrap);

  return router;
}

/**
 * Decoy admin/debug endpoint handler — mounted directly on app-root paths
 * in src/index.js (e.g. /api/admin/export-transactions.json,
 * /api/v1/debug/pos-keys), not nested under /api/security, so they match
 * robots.txt and the hidden sr-only links byte-for-byte.
 */
export function buildDecoyTrap(supabase) {
  return supabase ? decoyRouteTrap(supabase) : (req, res) => res.status(200).json({ success: true, data: [] });
}
