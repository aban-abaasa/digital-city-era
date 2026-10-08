import { supabase, supabaseConfig } from './supabase';

const SESSION_KEY = 'business_local_staff_session_v1';

function readStoredSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getLocalStaffSession() {
  if (!supabaseConfig.localBusinessServer) return null;
  const session = readStoredSession();
  if (!session?.accessToken || !session?.user || Number(session.expiresAt) <= Date.now()) {
    clearLocalStaffSession();
    return null;
  }
  return session;
}

function saveSession(session) {
  if (!session?.accessToken || !session?.user || !session?.expiresAt) {
    throw new Error('The local server returned an incomplete staff session.');
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearLocalStaffSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* storage unavailable */ }
}

async function postLocalAuth(path, payload) {
  if (!supabaseConfig.localBusinessServer) throw new Error('Local staff sign-in is only available on a business LAN server.');
  const response = await fetch(new URL(`/local-auth/${path}`, window.location.origin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.error || `Local staff service returned ${response.status}.`);
  }
  return saveSession({
    accessToken: result.accessToken,
    expiresAt: result.expiresAt,
    user: result.user,
  });
}

// true / false once the server has answered, null when it cannot be asked (older server, offline):
// callers then fall back to offering both "sign in" and "create owner".
export async function getLocalOwnerExists() {
  if (!supabaseConfig.localBusinessServer) return null;
  try {
    const response = await fetch(new URL('/local-auth/status', window.location.origin), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success || typeof result.ownerExists !== 'boolean') return null;
    return result.ownerExists;
  } catch {
    return null;
  }
}

export function signInLocalStaff({ username, pin }) {
  return postLocalAuth('login', { username, pin });
}

export function bootstrapLocalOwner({ setupToken, username, displayName, pin }) {
  return postLocalAuth('bootstrap-owner', { setupToken, username, displayName, pin });
}

export async function listLocalStaff() {
  const { data, error } = await supabase.rpc('business_local_list_staff');
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Could not load local staff.');
  return data.staff || [];
}

export async function createLocalStaff({ username, displayName, role, pin }) {
  const { data, error } = await supabase.rpc('business_local_create_staff', {
    p_username: username,
    p_display_name: displayName,
    p_role: role,
    p_pin: pin,
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Could not add local staff.');
  return data.staff;
}

export async function setLocalStaffActive(staffId, isActive) {
  const { data, error } = await supabase.rpc('business_local_set_staff_active', {
    p_staff_id: staffId,
    p_is_active: isActive,
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Could not update local staff.');
}
