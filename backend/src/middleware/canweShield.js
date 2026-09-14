/**
 * FAREDEAL Canwe Shield — deception-based bot/attacker detection.
 *
 * Named deliberately generic (not a recognizable security term) so nothing
 * in this file's name, import paths, or log tags gives away what it does
 * to anyone who reads the shipped client bundle or greps the repo.
 *
 * Two independent triggers feed the same pipeline:
 *   1. honeytoken_field — a hidden form field only a script would fill
 *      (checked client-side in React; reported via POST /api/security/report).
 *   2. decoy_route      — a fake admin/debug endpoint no real user link
 *      points to (see routes/securityRoutes.js + robots.txt + hidden links).
 *
 * State lives in Supabase (security_flagged_ips / security_threat_events —
 * see ../../database/SECURITY_CANWE_SHIELD.sql), not in a process-local Map,
 * so a flag raised by one request is visible to the very next request even
 * across a restart. A small in-memory cache just avoids a DB round trip on
 * every single request from a clean IP.
 *
 * Design choice: this gate FAILS OPEN. If Supabase is unreachable, real
 * users/cashiers must never be blocked because a deception layer's backing
 * store hiccuped — this is a bonus detection layer, not the primary authz
 * check (helmet + the existing rate limiters in src/index.js still apply).
 */

const CACHE_TTL_MS = 30_000;
const ipCache = new Map(); // ip -> { flagged, hit_count, severity, expiresAt }

export const HONEYTOKEN_FIELDS = ['admin_pass', 'root_token', 'backup_key', 'website', 'confirm_email_2'];
const SENSITIVE_LOG_KEYS = ['password', 'pin', 'pass', 'token', 'secret', 'card', 'cvv'];

export function getClientIp(req) {
  // Trust X-Forwarded-For only because src/index.js sets `app.set('trust
  // proxy', 1)` for exactly one hop — req.ip already resolves it safely;
  // this is just a defensive fallback.
  return req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
}

function redactPayload(body) {
  if (!body || typeof body !== 'object') return null;
  const out = {};
  for (const [key, value] of Object.entries(body)) {
    const isSensitive = SENSITIVE_LOG_KEYS.some((k) => key.toLowerCase().includes(k));
    out[key] = isSensitive ? '[redacted]' : value;
  }
  return out;
}

function tarpitDelayMs(hitCount = 1) {
  return Math.min(10_000 + (Math.max(hitCount, 1) - 1) * 4_000, 30_000);
}

function wantsHtml(req) {
  return String(req.headers.accept || '').includes('text/html');
}

async function isIpFlagged(supabase, ip) {
  const cached = ipCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const { data, error } = await supabase.rpc('check_ip_flagged', { p_ip: ip, p_app_name: 'faredeal' });
  const result = error || !data ? { flagged: false } : data;
  ipCache.set(ip, { ...result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

export async function logThreat(supabase, { ip, userAgent, triggerType, route, method, payload, severity = 'medium' }) {
  ipCache.delete(ip);
  const { data, error } = await supabase.rpc('log_security_threat', {
    p_ip: ip,
    p_user_agent: userAgent || null,
    p_trigger_type: triggerType,
    p_route: route || null,
    p_http_method: method || null,
    p_payload: redactPayload(payload),
    p_app_name: 'faredeal',
    p_severity: severity,
  });
  if (error) {
    console.error('[canwe] failed to log threat:', error.message);
    return null;
  }
  console.warn(`[canwe] THREAT ${triggerType} ip=${ip} route=${route || '-'} severity=${data?.severity} hits=${data?.hit_count}`);
  return data;
}

function decoyBaitResponse() {
  return {
    success: true,
    data: [],
    meta: { generated_at: new Date().toISOString(), version: '1.0.0' },
  };
}

export function ipReputationGate(supabase) {
  return async function (req, res, next) {
    try {
      const ip = getClientIp(req);
      const status = await isIpFlagged(supabase, ip);
      if (!status.flagged) return next();

      await new Promise((resolve) => setTimeout(resolve, tarpitDelayMs(status.hit_count)));

      if (wantsHtml(req)) {
        return res.redirect(302, '/decoy-portal');
      }
      return res.status(200).json(decoyBaitResponse());
    } catch (err) {
      console.error('[canwe] gate error (failing open):', err.message);
      return next();
    }
  };
}

export function decoyRouteTrap(supabase) {
  return async function (req, res) {
    const ip = getClientIp(req);
    await logThreat(supabase, {
      ip,
      userAgent: req.headers['user-agent'],
      triggerType: 'decoy_route',
      route: req.originalUrl,
      method: req.method,
      payload: req.body,
      severity: 'high',
    });
    await new Promise((resolve) => setTimeout(resolve, tarpitDelayMs(2)));
    res.status(200).json(decoyBaitResponse());
  };
}

export function honeytokenReportHandler(supabase) {
  return async function (req, res) {
    const ip = getClientIp(req);
    const body = req.body || {};
    const trippedField = HONEYTOKEN_FIELDS.find((f) => body[f] !== undefined && String(body[f]).trim() !== '');

    if (trippedField) {
      await logThreat(supabase, {
        ip,
        userAgent: req.headers['user-agent'],
        triggerType: 'honeytoken_field',
        route: body.formContext || 'unknown-form',
        method: 'POST',
        payload: { field: trippedField },
        severity: 'critical',
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 700 + Math.random() * 500));
    res.status(200).json({ success: false, error: 'Invalid credentials' });
  };
}
