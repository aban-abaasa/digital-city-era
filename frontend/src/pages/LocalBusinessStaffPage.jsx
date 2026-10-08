import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiCopy, FiRefreshCw, FiShuffle, FiUserCheck, FiUserPlus, FiUserX, FiX } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import PinField from '../components/PinField';
import { supabaseConfig } from '../services/supabase';
import { createLocalStaff, listLocalStaff, setLocalStaffActive } from '../services/localBusinessStaffService';
import './BusinessLocalServerSetup.css';

const EMPTY_FORM = { username: '', displayName: '', role: 'cashier', pin: '' };
// Letters, numbers and . _ - only (the server rejects anything else, including spaces)
const USERNAME_OK = /^[A-Za-z0-9._-]{3,64}$/;
const COMMON_PINS = new Set(['123456', '654321', '000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999', '123123', '121212', '112233']);

// A random 6-digit PIN that is not all one digit or an obvious run
const generatePin = () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const bytes = crypto.getRandomValues(new Uint32Array(6));
    const pin = Array.from(bytes, (n) => String(n % 10)).join('');
    if (!COMMON_PINS.has(pin) && new Set(pin).size > 2) return pin;
  }
  return '493817';
};

const LocalBusinessStaffPage = () => {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [created, setCreated] = useState(null); // credentials to hand over: the PIN cannot be read back later
  const [copiedCreds, setCopiedCreds] = useState(false);
  const [revealPin, setRevealPin] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStaff(await listLocalStaff());
    } catch (requestError) {
      setError(requestError.message || 'Could not load local staff.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Confirmations fade by themselves; errors stay until dismissed
  useEffect(() => {
    if (!notice || error) return undefined;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice, error]);

  if (!supabaseConfig.localBusinessServer) return <Navigate to="/" replace />;
  if (user?.localRole !== 'owner') return <Navigate to="/cashier-portal" replace />;

  const activeCount = staff.filter((member) => member.isActive).length;
  const usernameOk = USERNAME_OK.test(form.username.trim());
  const formReady = usernameOk && form.displayName.trim().length > 0 && /^[0-9]{6,12}$/.test(form.pin);

  const addStaff = async (event) => {
    event.preventDefault();
    if (!formReady) return;
    setWorking(true);
    setError('');
    setNotice('');
    try {
      await createLocalStaff({ ...form, username: form.username.trim(), displayName: form.displayName.trim() });
      setCreated({ username: form.username.trim().toLowerCase(), displayName: form.displayName.trim(), role: form.role, pin: form.pin });
      setForm(EMPTY_FORM);
      setRevealPin(false);
      setNotice('Account created.');
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Could not create the staff account.');
    } finally {
      setWorking(false);
    }
  };

  const toggleStaff = async (member) => {
    if (member.isActive && !window.confirm(`Disable ${member.displayName}? They will not be able to sign in on this server until you enable them again.`)) return;
    setWorking(true);
    setError('');
    setNotice('');
    try {
      await setLocalStaffActive(member.id, !member.isActive);
      setNotice(member.isActive ? `${member.displayName} disabled.` : `${member.displayName} enabled.`);
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Could not update this account.');
    } finally {
      setWorking(false);
    }
  };

  const copyCredentials = async () => {
    if (!created) return;
    const text = `Server: ${window.location.origin}\nUsername: ${created.username}\nPIN: ${created.pin}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCreds(true);
      setTimeout(() => setCopiedCreds(false), 2000);
    } catch {
      setError('Clipboard access is unavailable on this page. Write the details down instead.');
    }
  };

  return (
    <main className="bls-page">
      <div className="bls is-wide">
        <Link to="/local-home" className="bls-back"><FiArrowLeft /> Home</Link>

        <header className="bls-hero">
          <p className="bls-eyebrow">Local server settings</p>
          <h1>Manage local staff</h1>
          <p className="bls-lead">Add or disable the accounts that can sign in to this business server without internet. PINs are stored as password hashes here, and these accounts do not create or change cloud accounts.</p>
          <div className="bls-stats">
            <span>{staff.length} {staff.length === 1 ? 'account' : 'accounts'}</span>
            <span>{activeCount} active</span>
            {staff.length - activeCount > 0 && <span>{staff.length - activeCount} disabled</span>}
          </div>
        </header>

        <div className="bls-grid2">
          <section className="bls-card">
            <div className="bls-card-head">
              <div>
                <h2><FiUserPlus style={{ verticalAlign: '-2px', marginRight: 8 }} />Add a staff account</h2>
                <p>Staff sign in at this server with the username and PIN you set here.</p>
              </div>
            </div>
            <div className="bls-body">
              {created && (
                <div className="bls-cred" role="status">
                  <h3>{created.displayName} can now sign in</h3>
                  <dl>
                    <dt>Server</dt><dd>{window.location.origin}</dd>
                    <dt>Username</dt><dd>{created.username}</dd>
                    <dt>PIN</dt><dd>{created.pin}</dd>
                  </dl>
                  <p className="bls-sub">Hand these over now and in private. For safety the PIN cannot be shown again once you close this box.</p>
                  <div className="bls-code-actions">
                    <button type="button" className="bls-btn is-small" onClick={copyCredentials}>{copiedCreds ? <FiCheck /> : <FiCopy />} {copiedCreds ? 'Copied' : 'Copy details'}</button>
                    <button type="button" className="bls-btn is-ghost is-small" onClick={() => setCreated(null)}>I’ve handed them over</button>
                  </div>
                </div>
              )}

              <form onSubmit={addStaff} className="bls-form">
                <div className="bls-field">
                  <label htmlFor="st-name">Display name<small>shown on the till</small></label>
                  <input id="st-name" className="bls-input" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} maxLength={120} autoComplete="off" required />
                </div>
                <div className="bls-field">
                  <label htmlFor="st-user">Username<small>letters, numbers . _ - (no spaces)</small></label>
                  <input id="st-user" className="bls-input" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value.replace(/\s/g, '') })} autoComplete="off" autoCapitalize="off" spellCheck={false} minLength={3} maxLength={64} required />
                </div>
                <div className="bls-field">
                  <label id="st-role-label">Role</label>
                  <div className="bls-seg" role="group" aria-labelledby="st-role-label">
                    <button type="button" aria-pressed={form.role === 'cashier'} onClick={() => setForm({ ...form, role: 'cashier' })}>Cashier</button>
                    <button type="button" aria-pressed={form.role === 'manager'} onClick={() => setForm({ ...form, role: 'manager' })}>Manager</button>
                  </div>
                </div>
                <PinField
                  id="st-pin"
                  label="PIN"
                  hint="6 to 12 digits"
                  value={form.pin}
                  onChange={(pin) => setForm({ ...form, pin })}
                  autoComplete="new-password"
                  forceShown={revealPin}
                  action={(
                    <button type="button" className="bls-btn is-ghost is-small" style={{ minHeight: 48 }} onClick={() => { setForm({ ...form, pin: generatePin() }); setRevealPin(true); }}>
                      <FiShuffle /> Generate
                    </button>
                  )}
                />
                <p className="bls-sub">Give every person their own PIN, so each sale and message can be traced to them. “Generate” picks a random 6-digit PIN.</p>

                <button type="submit" disabled={working || !formReady} className="bls-btn is-block">
                  <FiUserPlus /> {working ? 'Saving…' : 'Create account'}
                </button>
              </form>
            </div>
          </section>

          <section className="bls-card">
            <div className="bls-card-head">
              <div>
                <h2>Staff on this server</h2>
                <p>Disable someone to stop them signing in; you can enable them again later.</p>
              </div>
              <button type="button" className="bls-btn is-ghost is-small" onClick={refresh} disabled={loading || working} aria-label="Refresh staff list">
                <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
            <div className="bls-body">
              {loading && staff.length === 0 ? (
                <>
                  <div className="bls-skel" style={{ width: '70%' }} />
                  <div className="bls-skel" style={{ width: '85%' }} />
                </>
              ) : staff.length === 0 ? (
                <p className="bls-empty">No local staff accounts yet.</p>
              ) : (
                <ul className="bls-stafflist">
                  {staff.map((member) => (
                    <li key={member.id} className={`bls-staffrow${member.isActive ? '' : ' is-off'}`}>
                      <span className="bls-avatar" aria-hidden="true">{(member.displayName || member.username || '?').charAt(0).toUpperCase()}</span>
                      <div className="bls-staffinfo">
                        <b>
                          {member.displayName}
                          {member.isOwner && <span className="bls-badge is-gold">Owner</span>}
                          <span className={`bls-badge ${member.isActive ? 'is-ok' : 'is-off'}`}>{member.isActive ? 'Active' : 'Disabled'}</span>
                        </b>
                        <small>{member.username} · {member.isOwner ? 'owner' : member.role}</small>
                      </div>
                      {!member.isOwner && (
                        <button
                          type="button"
                          className={`bls-btn ${member.isActive ? 'is-bad' : 'is-ok'}`}
                          onClick={() => toggleStaff(member)}
                          disabled={working}
                        >
                          {member.isActive ? <FiUserX /> : <FiUserCheck />} {member.isActive ? 'Disable' : 'Enable'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="bls-note">Staff access is local to this server. A disabled account cannot sign in here. Protect the server computer and the business Wi-Fi.</p>
            </div>
          </section>
        </div>
      </div>

      {(error || notice) && (
        <div role="status" className={`bls-toast${error ? ' is-bad' : ''}`}>
          {error ? <FiX /> : <FiCheck />}
          <span style={{ flex: 1 }}>{error || notice}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => { setError(''); setNotice(''); }}><FiX /></button>
        </div>
      )}
    </main>
  );
};

export default LocalBusinessStaffPage;
