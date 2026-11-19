import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { FiChevronRight, FiLogOut, FiMonitor, FiPackage, FiServer, FiShoppingCart, FiUsers } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { supabase, supabaseConfig } from '../services/supabase';
import useSupermarketBranding from '../hooks/useSupermarketBranding';
import './BusinessLocalServerSetup.css';

// What this business server can do today, and what still needs the cloud app.
const NOT_YET = [
  ['Purchasing, supplier orders and stock transfers', 'Use the cloud app while online.'],
  ['Reports and the admin dashboard', 'Use the cloud app while online.'],
  ['IcanEra wallet, bookings and deliveries', 'Use the cloud app while online.'],
];

const Tile = ({ to, icon: Icon, title, text, tag }) => (
  <Link to={to} className="bls-tile">
    <span className="bls-tile-icon"><Icon /></span>
    <span className="bls-tile-text">
      <b>{title}{tag && <span className="bls-badge is-gold">{tag}</span>}</b>
      <small>{text}</small>
    </span>
    <FiChevronRight className="bls-tile-go" aria-hidden="true" />
  </Link>
);

const LocalHome = () => {
  const { user, logout } = useAuth();
  const branding = useSupermarketBranding();
  const navigate = useNavigate();
  const [catalogCount, setCatalogCount] = useState(undefined); // undefined = loading, null = could not read

  useEffect(() => {
    if (!supabaseConfig.localBusinessServer || !user) return undefined;
    let cancelled = false;
    supabase
      .from('business_local_catalog')
      .select('product_id', { count: 'exact', head: true })
      .eq('is_active', true)
      .then(({ count, error }) => { if (!cancelled) setCatalogCount(error ? null : count ?? 0); });
    return () => { cancelled = true; };
  }, [user]);

  if (!supabaseConfig.localBusinessServer) return <Navigate to="/" replace />;
  if (!user) return <Navigate to="/local-staff-login" replace />;

  const isLite = supabaseConfig.localServerEdition === 'lite';
  const isAdmin = user.localRole === 'owner' || user.localRole === 'admin';
  const roleLabel = isAdmin ? 'Admin' : 'Cashier';
  const name = (user.name || user.username || '').split(' ')[0];

  const signOut = async () => {
    await logout();
    navigate('/local-staff-login', { replace: true });
  };

  return (
    <main className="bls-page">
      <div className="bls is-wide">
        <header className="bls-hero">
          <p className="bls-eyebrow">{branding?.name || 'Business LAN server'}</p>
          <h1>Welcome{name ? `, ${name}` : ''}</h1>
              <p className="bls-lead">You are signed in to this business server as <strong>{roleLabel}</strong>{isLite ? ' on the Lite setup.' : '.'} It keeps working when the internet is down.</p>
          <div className="bls-stats">
            <span><FiServer style={{ verticalAlign: '-2px' }} /> {window.location.host}</span>
            <span>
              {catalogCount === undefined ? 'Checking catalog…' : catalogCount === null ? 'Catalog unavailable' : `${catalogCount} ${catalogCount === 1 ? 'product' : 'products'} in the local catalog`}
            </span>
          </div>
        </header>

        <section className="bls-card">
          <div className="bls-card-head">
            <div>
              <h2>What you can do here</h2>
              <p>{isLite ? 'Lite keeps product edits, stock corrections, and cash sales available over the business Wi-Fi.' : 'These tools work on this server, over the business Wi-Fi.'}</p>
            </div>
          </div>
          <div className="bls-body">
            <div className="bls-tiles">
              <Tile to="/cashier-portal" icon={FiShoppingCart} title="Cashier station" tag="Cash sales" text="Build a basket from this store’s local catalog and record cash sales." />
              {isAdmin && <Tile to="/local-inventory" icon={FiPackage} title="Products & inventory" text="Add and edit products, then review stock or record a reasoned stock change." />}
              {isAdmin && <Tile to="/local-staff" icon={FiUsers} title="Manage local staff" text="Create Admin or Cashier accounts, hand over their PINs, and disable accounts." />}
              {isAdmin && <Tile to="/business-local-server" icon={FiMonitor} title="Server settings" text="This server’s status and how phones and tablets connect." />}
            </div>
            {!isLite && <p className="bls-sub">Team chat is the chat bubble at the bottom right of every screen — messages stay on this server and sync to the cloud when it is reachable.</p>}
          </div>
        </section>

        <details className="bls-card bls-collapse">
          <summary>
            <div className="bls-sum-text">
              <h2>Not available offline yet</h2>
              <p>The offline server is a preview. These still need the cloud app.</p>
            </div>
            <span className="bls-chev" aria-hidden="true" />
          </summary>
          <div className="bls-body" style={{ paddingTop: 14 }}>
            <ul className="bls-stafflist">
              {NOT_YET.map(([title, text]) => (
                <li key={title} className="bls-staffrow">
                  <div className="bls-staffinfo"><b>{title}</b><small>{text}</small></div>
                </li>
              ))}
            </ul>
          </div>
        </details>

        <div>
          <button type="button" className="bls-btn is-ghost is-small" onClick={signOut}><FiLogOut /> Sign out</button>
        </div>
      </div>
    </main>
  );
};

export default LocalHome;
