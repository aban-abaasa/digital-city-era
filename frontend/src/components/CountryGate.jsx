import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { COUNTRY_NAMES } from '../data/countries';

// Google OAuth (used by SupplierAuth and any other future OAuth entry
// point) never collects a country the way Register.jsx's form does, so
// this re-checks on every session — not just at signup — and blocks with a
// mandatory picker until public.users.country_code is set. Also catches
// accounts created before country became required.
export default function CountryGate({ children }) {
  const [checking, setChecking] = useState(true);
  const [needsCountry, setNeedsCountry] = useState(false);
  const [userRowId, setUserRowId] = useState(null);
  const [country, setCountry] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const check = async (session) => {
      if (!session?.user) {
        if (active) {
          setNeedsCountry(false);
          setChecking(false);
        }
        return;
      }

      // Don't trap offline users behind a picker they can't submit anyway.
      if (!navigator.onLine) {
        if (active) {
          setNeedsCountry(false);
          setChecking(false);
        }
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('users')
        .select('id, country_code')
        .or(`auth_id.eq.${session.user.id},id.eq.${session.user.id}`)
        .maybeSingle();

      if (!active) return;

      if (fetchError || !data) {
        setNeedsCountry(false);
      } else {
        setUserRowId(data.id);
        setNeedsCountry(!data.country_code || !data.country_code.trim());
      }
      setChecking(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => check(session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setChecking(true);
      check(session);
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const handleSave = async () => {
    if (!country || !userRowId) return;
    setSaving(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ country_code: country })
        .eq('id', userRowId);

      if (updateError) throw updateError;
      setNeedsCountry(false);
    } catch (err) {
      console.error('[CountryGate] Failed to save country:', err);
      setError(err.message || 'Failed to save country. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (checking || !needsCountry) return children;

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
          Select Your Country
        </h2>
        <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 14 }}>
          We need to know your country to continue using Supermartkera.
        </p>
        <select value={country} onChange={(e) => setCountry(e.target.value)} style={selectStyle}>
          <option value="">Select your country</option>
          {COUNTRY_NAMES.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button onClick={handleSave} disabled={saving || !country} style={buttonStyle}>
          {saving ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: 16
};

const cardStyle = {
  background: '#fff',
  borderRadius: 12,
  padding: 32,
  width: '100%',
  maxWidth: 420,
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
};

const selectStyle = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  marginBottom: 16,
  fontSize: 14,
  boxSizing: 'border-box'
};

const buttonStyle = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  fontWeight: 600,
  fontSize: 15,
  cursor: 'pointer'
};
