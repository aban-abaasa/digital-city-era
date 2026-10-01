import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

const localUrl = String(process.env.LOCAL_SUPABASE_URL || '').replace(/\/$/, '');
const localAnonKey = process.env.LOCAL_SUPABASE_ANON_KEY;
const localServiceKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.JWT_SECRET;
const setupToken = process.env.LOCAL_SETUP_TOKEN;
const businessId = process.env.BUSINESS_SYNC_BUSINESS_ID;
const businessType = process.env.BUSINESS_SYNC_BUSINESS_TYPE;
const port = Math.max(1, Number(process.env.LOCAL_AUTH_PORT) || 3010);
const sessionLifetimeSeconds = 8 * 60 * 60;

for (const [name, value] of Object.entries({
  LOCAL_SUPABASE_URL: localUrl,
  LOCAL_SUPABASE_ANON_KEY: localAnonKey,
  LOCAL_SUPABASE_SERVICE_ROLE_KEY: localServiceKey,
  JWT_SECRET: jwtSecret,
  LOCAL_SETUP_TOKEN: setupToken,
  BUSINESS_SYNC_BUSINESS_ID: businessId,
  BUSINESS_SYNC_BUSINESS_TYPE: businessType,
})) {
  if (!value) throw new Error(`Missing local staff-auth setting: ${name}`);
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (!uuidPattern.test(businessId)) throw new Error('BUSINESS_SYNC_BUSINESS_ID must be a UUID.');
if (!['supermarket', 'business_profile'].includes(businessType)) throw new Error('BUSINESS_SYNC_BUSINESS_TYPE is invalid.');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');

const base64url = (value) => Buffer.from(value).toString('base64url');

function issueStaffJwt(staff) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    aud: 'authenticated',
    exp: issuedAt + sessionLifetimeSeconds,
    iat: issuedAt,
    iss: 'supabase',
    role: 'authenticated',
    sub: staff.id,
    app_metadata: {
      provider: 'business-local',
      providers: ['business-local'],
      business_id: staff.businessId,
      business_type: businessType,
      local_role: staff.isOwner ? 'owner' : staff.role,
    },
    user_metadata: {
      full_name: staff.displayName,
      username: staff.username,
      role: staff.role,
      local_server: true,
    },
  }));
  const message = `${header}.${payload}`;
  const signature = createHmac('sha256', jwtSecret).update(message).digest('base64url');
  return {
    accessToken: `${message}.${signature}`,
    expiresAt: (issuedAt + sessionLifetimeSeconds) * 1000,
    user: {
      id: staff.id,
      username: staff.username,
      name: staff.displayName,
      full_name: staff.displayName,
      role: staff.role,
      localRole: staff.isOwner ? 'owner' : staff.role,
      businessId: staff.businessId,
    },
  };
}

function safeEqual(left, right) {
  const leftBytes = Buffer.from(String(left || ''));
  const rightBytes = Buffer.from(String(right || ''));
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 16 * 1024) throw new Error('Request is too large.');
  }
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

async function rpc(name, payload, key) {
  const response = await fetch(`${localUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(String(result?.message || result?.error || `Local staff service returned ${response.status}.`).slice(0, 300));
  }
  return result;
}

function sendJson(response, status, result) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(result));
}

const server = createServer(async (request, response) => {
  if (request.method !== 'POST' || !['/login', '/bootstrap-owner'].includes(request.url)) {
    sendJson(response, 404, { success: false, error: 'Not found.' });
    return;
  }

  try {
    const body = await readJson(request);
    if (request.url === '/bootstrap-owner') {
      if (!safeEqual(body.setupToken, setupToken)) {
        sendJson(response, 401, { success: false, error: 'The one-time owner setup code is invalid.' });
        return;
      }
      const result = await rpc('business_local_bootstrap_owner', {
        p_business_id: businessId,
        p_username: body.username,
        p_display_name: body.displayName,
        p_pin: body.pin,
      }, localServiceKey);
      if (!result?.success || !result.staff) {
        sendJson(response, 409, { success: false, error: result?.error || 'Owner setup could not be completed.' });
        return;
      }
      sendJson(response, 201, { success: true, ...issueStaffJwt(result.staff) });
      return;
    }

    const result = await rpc('business_local_authenticate_staff', {
      p_business_id: businessId,
      p_username: body.username,
      p_pin: body.pin,
    }, localAnonKey);
    if (!result?.success || !result.staff) {
      sendJson(response, 401, { success: false, error: result?.error || 'Invalid username or PIN.' });
      return;
    }
    sendJson(response, 200, { success: true, ...issueStaffJwt(result.staff) });
  } catch (error) {
    console.warn('[local-auth] request failed:', error.message);
    sendJson(response, 503, { success: false, error: 'Local staff service is unavailable. Try again.' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.info(`[local-auth] staff login service listening on internal port ${port}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
