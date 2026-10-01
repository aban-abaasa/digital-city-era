import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiCopy, FiHardDrive, FiRefreshCw, FiServer, FiShield, FiSmartphone, FiX } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { supabaseConfig } from '../services/supabase';
import businessLocalServerService from '../services/businessLocalServerService';
import { getLocalStaffSession } from '../services/localBusinessStaffService';

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
      setSelectedKey((current) => current || ownedBusinesses[0]?.key || '');
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

  const createPairing = async () => {
    if (!selectedBusiness) return;
    if (!protocolReady) {
      setError('Run the latest copies of all four cloud migrations in order before creating a pairing code.');
      return;
    }
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
      setError(requestError.message || 'Could not create a pairing code.');
    } finally {
      setWorking(false);
    }
  };

  const revokeNode = async (nodeId) => {
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
      setNotice(`${label} copied.`);
    } catch {
      setError('Clipboard access is unavailable. Select and copy the value manually.');
    }
  };

  if (supabaseConfig.localBusinessServer) {
    const localStaffSession = getLocalStaffSession();
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-amber-300 bg-white p-6 shadow-sm">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            <FiArrowLeft /> Back to the local app
          </Link>
          <h1 className="mt-5 text-2xl font-bold">This device is using the business LAN server</h1>
          <p className="mt-3 text-sm leading-6 text-slate-700">
                The preview supports LAN team chat, local owner and staff PIN sign-in, and a read-only supermarket catalog and stock mirror. Shared local cash sales, stock movements, and the other app workflows are not set up on this node yet.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {localStaffSession ? (
              <Link to={localStaffSession.user.localRole === 'owner' ? '/local-staff' : '/cashier-portal'} className="inline-flex items-center rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800">
                {localStaffSession.user.localRole === 'owner' ? 'Manage local staff' : 'Open cashier portal'}
              </Link>
            ) : (
              <Link to="/local-staff-login" className="inline-flex items-center rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800">Local staff sign in</Link>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link to={returnTo} className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
          <FiArrowLeft /> Back to profile
        </Link>

        <header className="mb-7 rounded-2xl bg-slate-900 p-6 text-white sm:p-8">
          <div className="flex items-start gap-4">
            <span className="rounded-xl bg-white/10 p-3"><FiServer className="h-6 w-6" /></span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-cyan-200">Optional business feature</p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Local server setup</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
                A business can run an optional local server on a Windows, macOS, or Linux Docker host. Android, iPhone, iPad, and desktop devices connect as clients over the same business Wi-Fi.
              </p>
            </div>
          </div>
        </header>

        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <strong>Setup is in preview.</strong> It installs the app shell, LAN team chat, local staff PIN sign-in, and a read-only supermarket product/stock mirror that syncs with the cloud. The local chat does not authenticate individual staff, so names can be impersonated by anyone on the business Wi-Fi. Do not put sensitive information in it. Local sales, stock movements, and the other app workflows are not enabled offline.
        </div>

        <section className="mb-6 rounded-2xl border border-cyan-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Your optional offline server</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Set up one computer at your business as the local server. Phones, tablets, and other computers can connect over the same business Wi-Fi.</p>
            </div>
            <a
              href="/downloads/business-local-server-installer.zip"
              download
              aria-disabled={!protocolReady || checkingProtocol}
              onClick={(event) => {
                if (!protocolReady || checkingProtocol) event.preventDefault();
              }}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white ${protocolReady && !checkingProtocol ? 'bg-cyan-700 hover:bg-cyan-800' : 'cursor-not-allowed bg-slate-400'}`}
            >
              <FiHardDrive /> {protocolReady ? 'Download setup package' : 'Setup not available yet'}
            </a>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">The setup package checks the computer before installation. A Windows computer can host this server, but Docker Desktop must be set to <strong>Linux containers</strong>. The server computer also needs at least 40 GB of free space and internet during setup. <a className="font-semibold text-cyan-800 underline" href="https://docs.docker.com/desktop/setup/install/windows-install/" target="_blank" rel="noreferrer">Download and install Docker Desktop for Windows</a>. Android and iOS devices connect to the server; they do not host it.</p>
          <p role="status" className={`mt-3 text-xs font-medium ${checkingProtocol ? 'text-slate-500' : protocolReady ? 'text-emerald-700' : 'text-amber-800'}`}>
            {checkingProtocol
              ? 'Checking whether offline setup is available...'
              : protocolReady
                ? 'Offline setup is ready for this business. Create a one-time setup code below to connect its local server.'
                : 'Offline setup is not enabled yet. Your platform administrator needs to finish the one-time platform setup. You do not need to run SQL or use a terminal.'}
          </p>
          {protocolReady && (
            <p className="mt-2 text-xs leading-5 text-slate-500">On Windows, extract the downloaded ZIP and double-click <code>local-server/installers/install-windows.cmd</code>. Keep the server computer at the business. The installer will ask for the public cloud settings and the one-time code created below.</p>
          )}
          <div className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-2">
            <div className="min-w-0">
              <p className="font-semibold text-slate-700">Cloud project URL</p>
              <div className="mt-1 flex items-start gap-2">
                <code className="min-w-0 flex-1 break-all text-slate-600">{supabaseConfig.supabaseUrl || 'Not configured'}</code>
                {supabaseConfig.supabaseUrl && <button type="button" onClick={() => copyValue(supabaseConfig.supabaseUrl, 'Cloud URL')} className="shrink-0 rounded border border-slate-300 px-2 py-1 text-cyan-800">Copy</button>}
              </div>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-700">Public anon/publishable key</p>
              <div className="mt-1 flex items-start gap-2">
                <code className="min-w-0 flex-1 break-all text-slate-600">{supabaseConfig.supabaseAnonKey || 'Not configured'}</code>
                {supabaseConfig.supabaseAnonKey && <button type="button" onClick={() => copyValue(supabaseConfig.supabaseAnonKey, 'Public client key')} className="shrink-0 rounded border border-slate-300 px-2 py-1 text-cyan-800">Copy</button>}
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">These are public client settings. The installer never asks for the cloud service-role key.</p>
        </section>

        {!user && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 text-sm">
            Sign in with the business owner account to manage local servers.
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <FiHardDrive className="h-5 w-5 text-cyan-700" />
            <div>
              <h2 className="font-semibold">Choose the business</h2>
              <p className="text-sm text-slate-500">Only businesses owned by your signed-in account are listed.</p>
            </div>
          </div>

          {loadingBusinesses ? (
            <p className="text-sm text-slate-500">Loading your businessesÃ¢â‚¬Â¦</p>
          ) : businesses.length ? (
            <select
              value={selectedKey}
              onChange={(event) => setSelectedKey(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm"
              aria-label="Business to set up"
            >
              {businesses.map((business) => (
                <option value={business.key} key={business.key}>{business.name} Ã‚Â· {business.type.replace('_', ' ')}</option>
              ))}
            </select>
          ) : (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              No businesses were found for this account. Sign in as the owner, or ask the owner to open this setup page.
            </p>
          )}

          <button
            type="button"
            onClick={createPairing}
            disabled={!selectedBusiness || working || checkingProtocol || !protocolReady}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiShield /> {working ? 'WorkingÃ¢â‚¬Â¦' : 'Create one-time pairing code'}
          </button>

          {pairing && (
            <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">One-time pairing code</p>
                  <p className="mt-1 break-all font-mono text-sm">{pairing.pairingToken}</p>
                  <p className="mt-2 text-xs text-slate-600">Expires {new Date(pairing.expiresAt).toLocaleString()}</p>
                </div>
                <button type="button" onClick={() => copyValue(pairing.pairingToken, 'Pairing code')} className="inline-flex items-center gap-2 rounded-lg border border-cyan-700 px-3 py-2 text-sm font-medium text-cyan-900">
                  <FiCopy /> Copy
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Registered local servers</h2>
              <p className="text-sm text-slate-500">Revoke a lost or retired host immediately.</p>
            </div>
            <button type="button" onClick={() => refreshNodes()} disabled={!selectedBusiness || working} aria-label="Refresh local servers" className="rounded-lg border border-slate-300 p-2 text-slate-700 disabled:opacity-50">
              <FiRefreshCw />
            </button>
          </div>
          {nodes.length ? (
            <ul className="divide-y divide-slate-100">
              {nodes.map((node) => (
                <li key={node.nodeId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{node.nodeName}</p>
                    <p className="text-xs text-slate-500">Added {new Date(node.createdAt).toLocaleDateString()} Ã‚Â· {node.revokedAt ? 'Revoked' : node.lastSeenAt ? `Last connected ${new Date(node.lastSeenAt).toLocaleString()}` : 'Never connected'}</p>
                  </div>
                  {!node.revokedAt && (
                    <button type="button" onClick={() => revokeNode(node.nodeId)} disabled={working} className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 disabled:opacity-50">
                      <FiX /> Revoke
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No local servers are registered for this business.</p>
          )}
        </section>

        {(error || notice) && (
          <div role="status" className={`mb-6 rounded-xl p-4 text-sm ${error ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>
            <span className="inline-flex items-center gap-2">{error ? <FiX /> : <FiCheck />}{error || notice}</span>
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <FiSmartphone className="mt-1 h-5 w-5 text-slate-600" />
            <div>
              <h2 className="font-semibold">Supported device roles</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">The server host is a Windows, macOS, or Linux computer with Docker. Android, iPhone, iPad, and desktop devices open the LAN address in a browser; this HTTP preview is not a native phone package or an installable PWA. Phones and tablets are clients and do not host the Supabase stack.</p>
              <a className="mt-3 inline-block text-sm font-semibold text-cyan-800 underline" href="/LOCAL_BUSINESS_SERVER.md" target="_blank" rel="noreferrer">Read the local server setup and sync status</a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default BusinessLocalServerSetup;
