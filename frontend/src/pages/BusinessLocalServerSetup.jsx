import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiCopy, FiHardDrive, FiRefreshCw, FiServer, FiShield, FiSmartphone, FiX } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { supabaseConfig } from '../services/supabase';
import businessLocalServerService from '../services/businessLocalServerService';
import { getLocalStaffSession } from '../services/localBusinessStaffService';
import WindowsServerSetupGuide from '../components/WindowsServerSetupGuide';
import './BusinessLocalServerSetup.css';

// "9:41" style countdown for the one-time pairing code
const formatRemaining = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const installerDownloads = [
  {
    href: '/downloads/business-local-server-2gb-ram-lite-20gb-disk.zip',
    title: '2 GB RAM Lite · 20 GB disk',
    description: 'Low-disk package · product edits, stock, and cash sales',
  },
  {
    href: '/downloads/business-local-server-2gb-ram-lite-40gb-disk.zip',
    title: '2 GB RAM Lite · 40 GB disk',
    description: 'Same Lite features · more disk headroom',
  },
  {
    href: '/downloads/business-local-server-4gb-ram-full-40gb-disk.zip',
    title: '4 GB RAM Full · 40 GB disk',
    description: 'Full services · team chat, product edits, and stock',
  },
];

const BusinessLocalServerSetup = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [nodes, setNodes] = useState([]);
  const [pairing, setPairing] = useState(null);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [protocolReady, setProtocolReady] = useState(false);
  const [checkingProtocol, setCheckingProtocol] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const selectedBusiness = useMemo(
    () => businesses.find((business) => business.key === selectedKey),
    [businesses, selectedKey]
  );
  const requestedReturnTo = searchParams.get('returnTo');
  const returnTo = requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//')
    ? requestedReturnTo
    : '/profile';

  useEffect(() => {
    let cancelled = false;
    const loadBusinesses = async () => {
      if (supabaseConfig.localBusinessServer) {
        setLoadingBusinesses(false);
        setCheckingProtocol(false);
        return;
      }
      if (!user?.id) {
        setLoadingBusinesses(false);
        setCheckingProtocol(false);
        return;
      }

      setLoadingBusinesses(true);
      setError('');
      let ownedBusinesses = [];
      try {
        const [rows, protocol] = await Promise.all([
          businessLocalServerService.listBusinesses(),
          businessLocalServerService.getProtocolInfo().catch(() => null),
        ]);
        ownedBusinesses = rows.map((item) => ({
          key: `${item.businessType}:${item.businessId}`,
          type: item.businessType,
          id: item.businessId,
          name: item.businessName || 'Business',
        }));
        setProtocolReady(
          Number(protocol?.protocolVersion) >= 3
          && Number(protocol?.teamHistoryBootstrapVersion) >= 1
          && Number(protocol?.catalogBootstrapVersion) >= 1
          && Number(protocol?.cashSalesSyncVersion) >= 1
          && Number(protocol?.productEditingSyncVersion) >= 1
        );
      } catch (requestError) {
        if (cancelled) return;
        const details = String(requestError?.message || '');
        const setupUnavailable = /business_local|businesslocal|schema cache|does not exist|function .* not found/i.test(details);
        setError(setupUnavailable
          ? 'Offline server setup is not available on this platform yet. Please contact support.'
          : 'We could not check offline server setup. Check your internet connection and try again.');
      }

      if (cancelled) return;

      setBusinesses(ownedBusinesses);
      // Only a supermarket's products and stock are copied to a server, so offer that entry first.
      const preferred = ownedBusinesses.find((business) => business.type === 'supermarket') || ownedBusinesses[0];
      setSelectedKey((current) => current || preferred?.key || '');
      setLoadingBusinesses(false);
      setCheckingProtocol(false);
    };

    loadBusinesses();
    return () => { cancelled = true; };
  }, [user?.id]);

  const refreshNodes = async (business = selectedBusiness) => {
    if (!business) {
      setNodes([]);
      return;
    }
    try {
      const result = await businessLocalServerService.listNodes({
        businessType: business.type,
        businessId: business.id,
      });
      setNodes(result);
    } catch (requestError) {
      setError(requestError.message || 'Could not load local servers.');
    }
  };

  useEffect(() => {
    setPairing(null);
    setNotice('');
    refreshNodes();
  }, [selectedKey]);

  // Tick once a second only while a pairing code is on screen
  useEffect(() => {
    if (!pairing) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pairing]);

  // Confirmations fade by themselves; errors stay until dismissed
  useEffect(() => {
    if (!notice || error) return undefined;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice, error]);

  const createPairing = async () => {
    if (!selectedBusiness) return;
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const result = await businessLocalServerService.createPairing({
        businessType: selectedBusiness.type,
        businessId: selectedBusiness.id,
      });
      setPairing(result);
      setNotice('Pairing code created. It can be used once and expires in 10 minutes.');
    } catch (requestError) {
      const details = String(requestError?.message || '');
      const setupUnavailable = /business_local|businesslocal|schema cache|does not exist|function .* not found/i.test(details);
      setError(setupUnavailable
        ? 'The cloud pairing service is not available yet, so no code was created. Please try again later.'
        : details || 'Could not create a pairing code.');
    } finally {
      setWorking(false);
    }
  };

  const revokeNode = async (nodeId) => {
    if (!window.confirm('Revoke this local server? It will lose access immediately and cannot be undone.')) return;
    setWorking(true);
    setError('');
    try {
      await businessLocalServerService.revokeNode(nodeId);
      await refreshNodes();
      setNotice('Local server access revoked.');
    } catch (requestError) {
      setError(requestError.message || 'Could not revoke this local server.');
    } finally {
      setWorking(false);
    }
  };

  const copyValue = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      setError('');
      setNotice(`${label} copied.`);
    } catch {
      setError('Clipboard access is unavailable. Select and copy the value manually.');
    }
  };

  const toast = (error || notice) && (
    <div role="status" className={`bls-toast${error ? ' is-bad' : ''}`}>
      {error ? <FiX /> : <FiCheck />}
      <span style={{ flex: 1 }}>{error || notice}</span>
      <button type="button" aria-label="Dismiss message" onClick={() => { setError(''); setNotice(''); }}><FiX /></button>
    </div>
  );

  if (supabaseConfig.localBusinessServer) {
    const localStaffSession = getLocalStaffSession();
    return (
      <main className="bls-page">
        <div className="bls">
          <Link to="/" className="bls-back"><FiArrowLeft /> Back to the local app</Link>
          <section className="bls-card">
            <div className="bls-card-head">
              <div>
                <p className="bls-eyebrow">Local server</p>
                <h2>This device is using the local server</h2>
              </div>
            </div>
            <div className="bls-body">
              <p>This local server can add and edit products from this store’s own catalog, record stock changes, and complete cash sales on its local database. Sales reduce stock, print named receipts, remain in transaction history after shutdown, and sync to the cloud when internet returns. It does not search other stores’ product names. The server’s selected access mode determines whether only this computer or other trusted LAN devices can connect. Digital City Era enables cloud sync once for the platform; contact support if it is unavailable. You do not need to run SQL. Other app workflows remain online-only.</p>
              <div>
                {localStaffSession ? (
                  <Link to={['owner', 'admin'].includes(localStaffSession.user.localRole) ? '/local-staff' : '/cashier-portal'} className="bls-btn">
                    {['owner', 'admin'].includes(localStaffSession.user.localRole) ? 'Manage local staff' : 'Open cashier portal'}
                  </Link>
                ) : (
                  <Link to="/local-staff-login" className="bls-btn">Local staff sign in</Link>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const expiresAt = pairing?.expiresAt ? new Date(pairing.expiresAt).getTime() : 0;
  const remaining = expiresAt ? expiresAt - now : 0;
  const expired = Boolean(pairing) && expiresAt > 0 && remaining <= 0;

  return (
    <main className="bls-page">
      <div className="bls">
        <Link to={returnTo} className="bls-back"><FiArrowLeft /> Back to profile</Link>

        <header className="bls-hero">
          <p className="bls-eyebrow">Optional business feature</p>
          <h1>Offline server</h1>
          <p className="bls-lead">Run an optional local server on one Windows, macOS, or Linux Docker computer. Local-only access is the default; choose optional LAN access if other devices need to connect. Supported queued changes sync to the cloud when internet returns.</p>
          <span className={`bls-pill ${checkingProtocol ? 'is-wait' : protocolReady ? 'is-ready' : 'is-wait'}`} role="status">
            <i />
            {checkingProtocol
              ? 'Checking whether offline setup is available…'
              : protocolReady
                ? 'Offline setup is ready for this business'
                : 'Cloud sync setup is incomplete'}
          </span>
        </header>

        <div className="bls-note">
          <strong>Setup is in preview.</strong> Cash-only POS sales are saved to the local database with an atomic stock deduction and receipt, then queued for cloud sync. Choose local-only mode for this computer, or LAN mode for other devices on a trusted business network. Digital City Era handles the one-time cloud setup; customers do not run SQL. Wallet payments and other app workflows still need an internet connection.
        </div>

        <section className="bls-card">
          <div className="bls-card-head">
            <div>
              <h2>1 · Choose the installer</h2>
              <p>Pick a ZIP that matches the computer's RAM and free disk space. During installation, choose local-only or LAN access.</p>
            </div>
          </div>
          <div className="bls-body">
            <div className="bls-download-options">
              {installerDownloads.map((downloadOption) => (
                <a
                  key={downloadOption.href}
                  href={downloadOption.href}
                  download
                  className="bls-btn bls-download-option"
                >
                  <FiHardDrive aria-hidden="true" />
                  <span>
                    <strong>{downloadOption.title}</strong>
                    <small>{downloadOption.description}</small>
                    <small>Download ZIP</small>
                  </span>
                </a>
              ))}
            </div>
            <ul className="bls-chips">
              <li>Windows 10 / 11</li>
              <li>2 GB Lite / 4 GB Full RAM</li>
              <li>20 or 40 GB free disk</li>
              <li>Internet during setup</li>
              <li>Docker Desktop (Linux containers)</li>
              <li>Node.js 20+</li>
              <li>Git</li>
            </ul>
          </div>
        </section>

        <WindowsServerSetupGuide />

        <section className="bls-card">
          <div className="bls-card-head">
            <div>
              <h2>2 · Connect your server</h2>
              <p>The installer asks for these three values. Copy and paste them <strong>one at a time</strong>.</p>
            </div>
          </div>
          <div className="bls-body">
            {!user && <p className="bls-empty">Sign in with the business owner account to manage local servers.</p>}

            <div className="bls-copyrows">
              <div className="bls-copyrow">
                <b>Cloud project URL</b>
                <div>
                  <code>{supabaseConfig.supabaseUrl || 'Not configured'}</code>
                  {supabaseConfig.supabaseUrl && <button type="button" className="bls-btn is-ghost is-small" onClick={() => copyValue(supabaseConfig.supabaseUrl, 'Cloud URL')}><FiCopy /> Copy</button>}
                </div>
              </div>
              <div className="bls-copyrow">
                <b>Public anon/publishable key</b>
                <div>
                  <code>{supabaseConfig.supabaseAnonKey || 'Not configured'}</code>
                  {supabaseConfig.supabaseAnonKey && <button type="button" className="bls-btn is-ghost is-small" onClick={() => copyValue(supabaseConfig.supabaseAnonKey, 'Public client key')}><FiCopy /> Copy</button>}
                </div>
              </div>
            </div>
            <p className="bls-sub">These are public client settings. The installer never asks for the cloud service-role key.</p>

            <div>
              <p className="bls-eyebrow" style={{ marginBottom: 6 }}>Business</p>
              {loadingBusinesses ? (
                <p className="bls-sub">Loading your businesses…</p>
              ) : businesses.length ? (
                <select
                  value={selectedKey}
                  onChange={(event) => setSelectedKey(event.target.value)}
                  className="bls-select"
                  aria-label="Business to set up"
                >
                  {businesses.map((business) => (
                    <option value={business.key} key={business.key}>
                      {business.name} · {business.type === 'supermarket' ? 'supermarket (products, stock and chat)' : 'business profile (chat only)'}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="bls-empty">No businesses were found for this account. Sign in as the owner, or ask the owner to open this setup page.</p>
              )}
            </div>

            {selectedBusiness?.type === 'business_profile' && (
              <p className="bls-note">
                <strong>Choose the supermarket entry if you have one.</strong> A server only receives products and stock — and only lets the owner change inventory — when it is paired to a <em>supermarket</em>. A server paired to a business profile carries team chat only, and the pairing cannot be switched later without reinstalling the server.
              </p>
            )}

            <div>
              <button
                type="button"
                onClick={createPairing}
                disabled={!selectedBusiness || working}
                className="bls-btn"
              >
                <FiShield /> {working ? 'Working…' : 'Create one-time pairing code'}
              </button>
              <p className="bls-sub" style={{ marginTop: 8 }}>Create it only when the installer asks for it — it works once and lasts 10 minutes.</p>
            </div>

            {pairing && (
              <div className="bls-code">
                <p className="bls-eyebrow">One-time pairing code</p>
                <p className="bls-code-value">{pairing.pairingToken}</p>
                {expiresAt > 0 && (
                  <p className={`bls-code-time${expired ? ' is-late' : ''}`}>
                    {expired ? 'Expired — create a new code' : `Expires in ${formatRemaining(remaining)}`}
                  </p>
                )}
                <div className="bls-code-actions">
                  <button type="button" className="bls-btn is-small" disabled={expired} onClick={() => copyValue(pairing.pairingToken, 'Pairing code')}><FiCopy /> Copy code</button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="bls-card">
          <div className="bls-card-head">
            <div>
              <h2>Registered local servers</h2>
              <p>Revoke a lost or retired host immediately.</p>
            </div>
            <button type="button" className="bls-btn is-ghost is-small" onClick={() => refreshNodes()} disabled={!selectedBusiness || working} aria-label="Refresh local servers">
              <FiRefreshCw /> Refresh
            </button>
          </div>
          <div className="bls-body">
            {nodes.length ? (
              <ul className="bls-nodes">
                {nodes.map((node) => (
                  <li key={node.nodeId}>
                    <div>
                      <b><FiServer style={{ verticalAlign: '-2px', marginRight: 6 }} />{node.nodeName}</b>
                      <small>Added {new Date(node.createdAt).toLocaleDateString()} · {node.revokedAt ? 'Revoked' : node.lastSeenAt ? `Last connected ${new Date(node.lastSeenAt).toLocaleString()}` : 'Never connected'}</small>
                    </div>
                    {!node.revokedAt && (
                      <button type="button" className="bls-btn is-bad" onClick={() => revokeNode(node.nodeId)} disabled={working}>
                        <FiX /> Revoke
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="bls-sub">No local servers are registered for this business.</p>
            )}
          </div>
        </section>

        <details className="bls-card bls-collapse">
          <summary>
            <div className="bls-sum-text">
              <h2><FiSmartphone style={{ verticalAlign: '-2px', marginRight: 8 }} />Supported device roles</h2>
              <p>Which devices host the server and which connect to it.</p>
            </div>
            <span className="bls-chev" aria-hidden="true" />
          </summary>
          <div className="bls-body" style={{ paddingTop: 14 }}>
            <p>The local server runs on a Windows, macOS, or Linux computer with Docker. Local-only mode opens at <code>http://127.0.0.1:8080</code>; LAN mode lets other devices on the trusted business network connect. This HTTP preview is not a native phone package or an installable PWA.</p>
            <p><a href="/LOCAL_BUSINESS_SERVER.md" target="_blank" rel="noreferrer">Read the local server setup and sync status</a></p>
          </div>
        </details>
      </div>
      {toast}
    </main>
  );
};

export default BusinessLocalServerSetup;
