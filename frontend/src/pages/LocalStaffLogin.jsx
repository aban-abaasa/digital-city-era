import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiCopy, FiLock, FiServer } from 'react-icons/fi';
import PinInput from '../components/PinField';
import { supabaseConfig } from '../services/supabase';
import { bootstrapLocalOwner, getLocalOwnerExists, getLocalStaffSession, signInLocalStaff } from '../services/localBusinessStaffService';
import './BusinessLocalServerSetup.css';

const FIND_CODE_COMMAND = 'Select-String LOCAL_SETUP_TOKEN .env.local-sync';
const COMMON_PINS = new Set(['123456', '1234567', '12345678', '654321', '000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999', '123123', '121212', '112233']);

const Check = ({ ok, children }) => (
  <li className={ok ? 'is-ok' : ''}><i aria-hidden="true">{ok ? '✓' : ''}</i>{children}</li>
);

// Letters, numbers and . _ - only (the server rejects anything else, including spaces)
const USERNAME_OK = /^[A-Za-z0-9._-]{3,64}$/;

const LocalStaffLogin = () => {
  const location = useLocation();
  // null = still asking the server, true/false = answered. A server that cannot answer (null after the
  // check) falls back to offering both screens, as before.
  const [ownerExists, setOwnerExists] = useState(undefined);
  const [setupMode, setSetupMode] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [pinAgain, setPinAgain] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!supabaseConfig.localBusinessServer) return undefined;
    let cancelled = false;
    getLocalOwnerExists().then((exists) => {
      if (cancelled) return;
      setOwnerExists(exists);
      if (exists === false) setSetupMode(true);
      if (exists === true) setSetupMode(false);
    });
    return () => { cancelled = true; };
  }, []);

  const codeLooksRight = /^[0-9a-f]{64}$/i.test(setupToken);
  const pinLengthOk = pin.length >= 6 && pin.length <= 12;
  const pinsMatch = pin.length > 0 && pin === pinAgain;
  const pinIsCommon = COMMON_PINS.has(pin);
  const setupReady = useMemo(
    () => codeLooksRight && displayName.trim().length > 0 && USERNAME_OK.test(username.trim()) && pinLengthOk && pinsMatch,
    [codeLooksRight, displayName, username, pinLengthOk, pinsMatch],
  );

  if (!supabaseConfig.localBusinessServer) return <Navigate to="/login" replace />;
  const activeSession = getLocalStaffSession();
  if (activeSession) return <Navigate to="/local-home" replace />;

  const checking = ownerExists === undefined;
  const canToggle = ownerExists === null; // only when the server could not say which screen applies

  const submit = async (event) => {
    event.preventDefault();
    if (setupMode && !setupReady) return;
    setError('');
    setWorking(true);
    try {
      if (setupMode) await bootstrapLocalOwner({ setupToken, username: username.trim(), displayName: displayName.trim(), pin });
      else await signInLocalStaff({ username: username.trim(), pin });
      const requestedPath = location.state?.from?.pathname;
      const destination = !setupMode && requestedPath && requestedPath.startsWith('/') && !requestedPath.startsWith('//')
        ? requestedPath
        : '/local-home';
      window.location.assign(destination);
    } catch (requestError) {
      setError(requestError.message || 'Could not sign in to this local server.');
    } finally {
      setWorking(false);
    }
  };

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(FIND_CODE_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked on plain HTTP: the command is selectable below */ }
  };

  return (
    <main className="bls-page">
      <div className="bls bls-auth">
        <a href="/" className="bls-back"><FiArrowLeft /> Local app</a>

        <header className="bls-hero">
          <p className="bls-eyebrow">Business LAN</p>
          <h1>{checking ? 'Local server' : setupMode ? 'Create the owner account' : 'Staff sign in'}</h1>
          <p className="bls-lead">
            {setupMode
              ? 'This server has no owner yet. Create it once with the setup code from the installer — then you can add your staff.'
              : 'Sign in with your username and PIN. Accounts live on this business server, so the internet is not needed.'}
          </p>
        </header>

        <section className="bls-card">
          <div className="bls-body" style={{ paddingTop: 18 }}>
            {checking ? (
              <>
                <div className="bls-skel" style={{ width: '60%' }} />
                <div className="bls-skel" style={{ width: '90%' }} />
                <div className="bls-skel" style={{ width: '75%' }} />
              </>
            ) : (
              <form onSubmit={submit} className="bls-form">
                {setupMode && (
                  <>
                    <div className="bls-field">
                      <label htmlFor="ls-code">One-time owner setup code<small>{setupToken.length}/64</small></label>
                      <input
                        id="ls-code"
                        className="bls-input is-mono"
                        value={setupToken}
                        onChange={(event) => setSetupToken(event.target.value.replace(/\s/g, ''))}
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        required
                      />
                    </div>
                    <details className="bls-trouble">
                      <summary><span>Where do I find the setup code?</span><span className="bls-chev" aria-hidden="true" /></summary>
                      <p>
                        The installer prints it at the end. To show it again, open PowerShell on the <strong>server computer</strong>, go to the install folder (for example <code>cd D:\Servers\DigitalCityLocalServer</code>) and run the command below. The code is the long value after <code>LOCAL_SETUP_TOKEN=</code>.
                      </p>
                      <div className="bls-cmd" style={{ margin: '0 14px 12px' }}>
                        <code>{FIND_CODE_COMMAND}</code>
                        <button type="button" onClick={copyCommand}><FiCopy /> {copied ? 'Copied' : 'Copy'}</button>
                      </div>
                    </details>
                    <div className="bls-field">
                      <label htmlFor="ls-name">Your name<small>shown to staff</small></label>
                      <input id="ls-name" className="bls-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" maxLength={120} required />
                    </div>
                  </>
                )}

                <div className="bls-field">
                  <label htmlFor="ls-user">Username{setupMode && <small>letters, numbers . _ - (no spaces)</small>}</label>
                  <input id="ls-user" className="bls-input" value={username} onChange={(event) => setUsername(event.target.value.replace(/\s/g, ''))} autoComplete="username" autoCapitalize="off" spellCheck={false} minLength={3} maxLength={64} required />
                </div>

                <PinInput
                  id="ls-pin"
                  label={setupMode ? 'Create a PIN' : 'PIN'}
                  hint={setupMode ? '6 to 12 digits' : undefined}
                  value={pin}
                  onChange={setPin}
                  autoComplete={setupMode ? 'new-password' : 'current-password'}
                />

                {setupMode && (
                  <>
                    <PinInput id="ls-pin2" label="Type the PIN again" value={pinAgain} onChange={setPinAgain} autoComplete="new-password" />
                    <ul className="bls-checks" aria-label="Checklist">
                      <Check ok={codeLooksRight}>Setup code is 64 letters and numbers</Check>
                      <Check ok={USERNAME_OK.test(username.trim())}>Username is 3+ letters, numbers or . _ -</Check>
                      <Check ok={pinLengthOk}>PIN is 6 to 12 digits</Check>
                      <Check ok={pinsMatch}>Both PINs match</Check>
                    </ul>
                    {pinIsCommon && <p className="bls-note">That PIN is easy to guess. Anyone on your Wi-Fi who knows the username could try it — consider something less obvious.</p>}
                    <p className="bls-sub"><FiLock style={{ verticalAlign: '-2px' }} /> There is no “forgot PIN” email on a local server, so choose one you will remember and keep a written copy somewhere safe.</p>
                  </>
                )}

                {error && <p role="alert" className="bls-err">{error}</p>}

                <button type="submit" disabled={working || (setupMode && !setupReady)} className="bls-btn is-block">
                  <FiServer /> {working ? 'Please wait…' : setupMode ? 'Create owner account' : 'Sign in'}
                </button>
              </form>
            )}

            {canToggle && (
              <button type="button" className="bls-linkbtn" onClick={() => { setSetupMode((value) => !value); setError(''); }}>
                {setupMode ? 'Return to staff sign in' : 'First time setting up this server? Create its owner account'}
              </button>
            )}
            {!checking && !setupMode && ownerExists === true && (
              <p className="bls-sub">Forgot your username or PIN? Ask the server’s owner — staff accounts are managed under <strong>Manage local staff</strong>.</p>
            )}
          </div>
        </section>

        <p className="bls-sub" style={{ textAlign: 'center' }}>
          The local staff login is separate from your cloud account. Keep the one-time owner setup code private until the owner account exists.
        </p>
      </div>
    </main>
  );
};

export default LocalStaffLogin;
