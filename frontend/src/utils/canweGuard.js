// Must match the field names rendered by components/security/CanweFields.jsx.
const TRAP_FIELDS = ['admin_pass', 'root_token', 'backup_key', 'website'];

// Same VITE_API_URL / prod-fallback convention as the existing services
// (see src/services/backendApiService.js) — baseURL already includes /api.
const BASE_URL = import.meta.env.VITE_API_URL
  || (import.meta.env.PROD ? 'https://api.faredeal.vercel.app/api' : 'http://localhost:3001/api');

/**
 * Call this first inside any onSubmit that also renders <CanweFields />,
 * before doing any real login/network work. Reads the trap fields straight
 * off the DOM form element (they aren't wired into React state) so a
 * scripted client that fills every <input> it finds still gets caught even
 * though our own JS never touches those values in the happy path.
 *
 * Returns true if a trap field was filled (caller should stop and show a
 * normal-looking generic error) or false to proceed as usual.
 *
 * @param {HTMLFormElement} formEl
 * @param {string} formContext e.g. 'staff-login' | 'customer-login'
 */
export function checkCanweFields(formEl, formContext = 'unknown-form') {
  if (!formEl) return false;

  const data = new FormData(formEl);
  const trippedField = TRAP_FIELDS.find((name) => {
    const value = data.get(name);
    return value !== null && String(value).trim() !== '';
  });

  if (!trippedField) return false;

  fetch(`${BASE_URL}/security/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [trippedField]: data.get(trippedField), formContext }),
    keepalive: true,
  }).catch(() => {
    // Never let a reporting failure surface to the user.
  });

  return true;
}

export default checkCanweFields;
