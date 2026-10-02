import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FiCalendar, FiCheck, FiExternalLink, FiImage, FiMapPin, FiPackage, FiServer, FiShoppingBag,
  FiTrash2, FiUpload, FiUsers
} from 'react-icons/fi';
import { supabase } from '../../services/supabase';
import './AdminStoreSettings.css';

const LOGO_MAX_MB = 2;
const BACKGROUND_MAX_MB = 3;
const EMPTY_FORM = { name: '', location: '', phone: '', address: '' };

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const formFrom = (row) => ({
  name: row?.name || '',
  location: row?.location || '',
  phone: row?.phone || '',
  address: row?.address || ''
});

const validate = (form) => {
  const errors = {};
  if (form.name.trim().length < 2) errors.name = 'Enter your store name';
  if (!form.location.trim()) errors.location = 'Enter the town or area the store is in';
  const digits = form.phone.replace(/\D/g, '');
  if (form.phone.trim() && (digits.length < 7 || digits.length > 15)) errors.phone = 'Enter a valid phone number';
  return errors;
};

const Switch = ({ checked, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    className={`ass-switch${checked ? ' is-on' : ''}`}
    onClick={() => onChange(!checked)}
    disabled={disabled}
  >
    <span />
  </button>
);

const Section = ({ id, title, hint, flash, children }) => (
  <section className="ass-card" aria-labelledby={`${id}-title`}>
    <header className="ass-card-head">
      <div>
        <h3 id={`${id}-title`}>{title}</h3>
        {hint && <p>{hint}</p>}
      </div>
      <span className={`ass-flash${flash ? ` is-${flash.tone}` : ''}`} role="status" aria-live="polite">
        {flash ? <>{flash.tone === 'ok' && <FiCheck aria-hidden="true" />}{flash.text}</> : ''}
      </span>
    </header>
    <div className="ass-card-body">{children}</div>
  </section>
);

/**
 * The store's real settings in one place. Every control here reads and writes the store's own
 * record (name, contact, logo, background, what it offers, pickup point) — nothing is decorative.
 */
const AdminStoreSettings = ({ supermarketId, typeEmoji, typeLabel, onSaved }) => {
  const [store, setStore] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(''); // details | logo | background | offers | pickup
  const [flash, setFlash] = useState({}); // { [sectionId]: { tone, text } }
  const logoInput = useRef(null);
  const backgroundInput = useRef(null);
  const flashTimer = useRef({});

  const say = useCallback((section, text, tone = 'ok') => {
    setFlash((f) => ({ ...f, [section]: { text, tone } }));
    clearTimeout(flashTimer.current[section]);
    flashTimer.current[section] = setTimeout(() => setFlash((f) => ({ ...f, [section]: null })), tone === 'ok' ? 3000 : 6000);
  }, []);

  useEffect(() => () => Object.values(flashTimer.current).forEach(clearTimeout), []);

  useEffect(() => {
    if (!supermarketId) { setLoading(false); return undefined; }
    let alive = true;
    setLoading(true);
    supabase.from('supermarkets').select('*').eq('id', supermarketId).maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) { setLoadError(error.message || 'Could not load your store'); return; }
        setStore(data);
        setForm(formFrom(data));
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [supermarketId]);

  // One write path. An update that RLS silently refuses returns no row, so ask for the row back.
  const patch = useCallback(async (fields) => {
    const { data, error } = await supabase.from('supermarkets')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', supermarketId).select('*').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('You don’t have permission to change this store');
    setStore(data);
    if (onSaved) onSaved();
    return data;
  }, [supermarketId, onSaved]);

  const errors = validate(form);
  const dirty = store && ['name', 'location', 'phone', 'address'].some((k) => (form[k] || '').trim() !== (store[k] || ''));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const saveDetails = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length) return;
    setBusy('details');
    try {
      const saved = await patch({
        name: form.name.trim(),
        location: form.location.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null
      });
      setForm(formFrom(saved));
      setTouched(false);
      say('details', 'Saved');
    } catch (err) {
      say('details', err.message || 'Could not save', 'bad');
    } finally {
      setBusy('');
    }
  };

  const uploadImage = (field, section, maxMb, inputRef) => async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { say(section, 'Please choose an image file', 'bad'); return; }
    if (file.size > maxMb * 1024 * 1024) { say(section, `Image must be under ${maxMb}MB`, 'bad'); return; }
    setBusy(section);
    try {
      await patch({ [field]: await readAsDataUrl(file) });
      say(section, 'Saved');
    } catch (err) {
      say(section, err.message || 'Could not upload', 'bad');
    } finally {
      setBusy('');
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeImage = (field, section) => async () => {
    setBusy(section);
    try {
      await patch({ [field]: null });
      say(section, 'Removed');
    } catch (err) {
      say(section, err.message || 'Could not remove', 'bad');
    } finally {
      setBusy('');
    }
  };

  const setOffer = async (field, value) => {
    setBusy('offers');
    try {
      await patch({ [field]: value });
      say('offers', 'Saved');
    } catch (err) {
      say('offers', err.message || 'Could not save', 'bad');
    } finally {
      setBusy('');
    }
  };

  // Rider delivery needs real coordinates; a street address alone is not enough to route a rider here.
  const usePickupLocation = () => {
    if (!navigator.geolocation) { say('pickup', 'This browser can’t share a location', 'bad'); return; }
    setBusy('pickup');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await patch({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          say('pickup', 'Pickup point saved');
        } catch (err) {
          say('pickup', err.message || 'Could not save the location', 'bad');
        } finally {
          setBusy('');
        }
      },
      () => {
        say('pickup', 'Couldn’t get your location — stand at the store and allow location access', 'bad');
        setBusy('');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (!supermarketId) {
    return <div className="ass"><p className="ass-note">Your admin account isn’t linked to a store yet, so there are no settings to show.</p></div>;
  }
  if (loading) {
    return <div className="ass"><div className="ass-card ass-loading" role="status">Loading your store settings…</div></div>;
  }
  if (loadError || !store) {
    return <div className="ass"><p className="ass-note">{loadError || 'We couldn’t find your store.'}</p></div>;
  }

  const hasPickup = store.latitude !== null && store.latitude !== undefined && store.longitude !== null && store.longitude !== undefined;
  const fieldError = (k) => (touched && errors[k]) || '';

  return (
    <div className="ass">
      <header className="ass-head">
        <p className="ass-eyebrow">Settings</p>
        <h2>Store settings</h2>
        <p className="ass-sub">Everything here belongs to {store.name || 'your store'} and applies in every portal — admin, manager, cashier and customer.</p>
      </header>

      <Section id="details" title="Store details" hint="Shown on receipts and to your customers." flash={flash.details}>
        <form onSubmit={saveDetails} noValidate>
          <div className="ass-grid">
            <label className={`ass-field${fieldError('name') ? ' has-error' : ''}`}>
              <span>Store name</span>
              <input value={form.name} onChange={set('name')} autoComplete="organization" maxLength={80} aria-invalid={Boolean(fieldError('name'))} />
              {fieldError('name') && <em>{fieldError('name')}</em>}
            </label>
            <label className={`ass-field${fieldError('location') ? ' has-error' : ''}`}>
              <span>Town / area</span>
              <input value={form.location} onChange={set('location')} autoComplete="address-level2" maxLength={80} aria-invalid={Boolean(fieldError('location'))} />
              {fieldError('location') && <em>{fieldError('location')}</em>}
            </label>
            <label className={`ass-field${fieldError('phone') ? ' has-error' : ''}`}>
              <span>Phone <small>optional</small></span>
              <input type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" maxLength={20} aria-invalid={Boolean(fieldError('phone'))} />
              {fieldError('phone') && <em>{fieldError('phone')}</em>}
            </label>
            <label className="ass-field ass-wide">
              <span>Street address <small>optional</small></span>
              <textarea value={form.address} onChange={set('address')} rows={2} maxLength={200} autoComplete="street-address" />
            </label>
          </div>
          <div className="ass-actions">
            <button type="submit" className="ass-btn ass-btn-primary" disabled={!dirty || busy === 'details'}>
              {busy === 'details' ? 'Saving…' : 'Save changes'}
            </button>
            {dirty && (
              <button type="button" className="ass-btn" onClick={() => { setForm(formFrom(store)); setTouched(false); }} disabled={busy === 'details'}>
                Discard
              </button>
            )}
          </div>
        </form>
      </Section>

      <Section id="logo" title="Store logo" hint={`Shown in the portal header and printed on receipts. Under ${LOGO_MAX_MB}MB.`} flash={flash.logo}>
        <div className="ass-media">
          <div className="ass-thumb ass-thumb-logo">
            {store.logo_url ? <img src={store.logo_url} alt="Store logo" /> : <FiImage aria-hidden="true" />}
          </div>
          <div className="ass-media-actions">
            <input ref={logoInput} type="file" accept="image/*" hidden onChange={uploadImage('logo_url', 'logo', LOGO_MAX_MB, logoInput)} />
            <button type="button" className="ass-btn" onClick={() => logoInput.current?.click()} disabled={busy === 'logo'}>
              <FiUpload aria-hidden="true" />{busy === 'logo' ? 'Uploading…' : store.logo_url ? 'Change logo' : 'Upload logo'}
            </button>
            {store.logo_url && (
              <button type="button" className="ass-btn ass-btn-quiet" onClick={removeImage('logo_url', 'logo')} disabled={busy === 'logo'}>
                <FiTrash2 aria-hidden="true" />Remove
              </button>
            )}
          </div>
        </div>
      </Section>

      <Section id="background" title="Portal background" hint={`A photo behind every portal for your store. Under ${BACKGROUND_MAX_MB}MB.`} flash={flash.background}>
        <div className="ass-media">
          <div className="ass-thumb ass-thumb-wide">
            {store.background_image_url ? <img src={store.background_image_url} alt="Portal background" /> : <FiImage aria-hidden="true" />}
          </div>
          <div className="ass-media-actions">
            <input ref={backgroundInput} type="file" accept="image/*" hidden onChange={uploadImage('background_image_url', 'background', BACKGROUND_MAX_MB, backgroundInput)} />
            <button type="button" className="ass-btn" onClick={() => backgroundInput.current?.click()} disabled={busy === 'background'}>
              <FiUpload aria-hidden="true" />{busy === 'background' ? 'Uploading…' : store.background_image_url ? 'Change image' : 'Upload image'}
            </button>
            {store.background_image_url && (
              <button type="button" className="ass-btn ass-btn-quiet" onClick={removeImage('background_image_url', 'background')} disabled={busy === 'background'}>
                <FiTrash2 aria-hidden="true" />Remove
              </button>
            )}
          </div>
        </div>
      </Section>

      <Section id="offers" title="What your business offers" hint="Switch on what customers can buy or book from you." flash={flash.offers}>
        <ul className="ass-rows">
          <li className="ass-row">
            <span className="ass-row-icon"><FiShoppingBag aria-hidden="true" /></span>
            <div className="ass-row-text">
              <b>Products</b>
              <span>Stock-tracked items sold at the till and listed to customers.</span>
            </div>
            <Switch label="Offer products" checked={Boolean(store.offers_products)} disabled={busy === 'offers'} onChange={(v) => setOffer('offers_products', v)} />
          </li>
          <li className="ass-row">
            <span className="ass-row-icon"><FiCalendar aria-hidden="true" /></span>
            <div className="ass-row-text">
              <b>Services</b>
              <span>Customers book a time slot. Turns on the Bookings tab.</span>
            </div>
            <Switch label="Offer bookable services" checked={Boolean(store.offers_services)} disabled={busy === 'offers'} onChange={(v) => setOffer('offers_services', v)} />
          </li>
        </ul>
      </Section>

      <Section id="pickup" title="Delivery pickup point" hint="Riders need real coordinates to find your store — a street address alone isn’t enough." flash={flash.pickup}>
        <div className="ass-pickup">
          <div className="ass-row-text">
            <b>{hasPickup ? 'Pickup point set' : 'Not set yet'}</b>
            <span>
              {hasPickup
                ? `${Number(store.latitude).toFixed(5)}, ${Number(store.longitude).toFixed(5)}`
                : 'Stand at the store, then use your current location.'}
            </span>
          </div>
          <button type="button" className="ass-btn" onClick={usePickupLocation} disabled={busy === 'pickup'}>
            <FiMapPin aria-hidden="true" />{busy === 'pickup' ? 'Locating…' : hasPickup ? 'Update location' : 'Use my current location'}
          </button>
        </div>
      </Section>

      <Section id="more" title="More" hint="Other places that shape how your store runs.">
        <ul className="ass-rows">
          <li>
            <a className="ass-row ass-link" href="/profile">
              <span className="ass-row-icon"><FiPackage aria-hidden="true" /></span>
              <div className="ass-row-text">
                <b>Business type · {typeEmoji} {typeLabel}</b>
                <span>Changing it adjusts how new products default and which till features switch on.</span>
              </div>
              <FiExternalLink aria-hidden="true" />
            </a>
          </li>
          <li>
            <a className="ass-row ass-link" href="/profile">
              <span className="ass-row-icon"><FiUsers aria-hidden="true" /></span>
              <div className="ass-row-text">
                <b>Profile, team &amp; roles</b>
                <span>Your own profile and who can act as manager or cashier.</span>
              </div>
              <FiExternalLink aria-hidden="true" />
            </a>
          </li>
          <li>
            <a className="ass-row ass-link" href="/business-local-server?returnTo=%2Fadmin-portal">
              <span className="ass-row-icon"><FiServer aria-hidden="true" /></span>
              <div className="ass-row-text">
                <b>Offline business server</b>
                <span>Optional LAN server so the till keeps working without internet.</span>
              </div>
              <FiExternalLink aria-hidden="true" />
            </a>
          </li>
        </ul>
      </Section>
    </div>
  );
};

export default AdminStoreSettings;
