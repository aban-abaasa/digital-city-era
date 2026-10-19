import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, MapPin, MessageCircle, Phone, RefreshCw, Search, Sprout } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  getOpenOffers, getCatalogForMatching, getMyInterests, expressInterest, withdrawInterest, subscribeToOffers, getAuthUserId,
} from '../services/farmProduceService';
import {
  REGIONS, SORTS, PROXIMITY_LABEL, MIN_SAMPLE, decorate, filterOffers, sortOffers, marketSummaries, topMarkets, comparable, fromBase,
  formatUgx, unitName, closesLabel, postedAgo, telLink, whatsappLink, enquiryText, describeMarket, describeCatalog,
} from '../utils/farmProduce';
import '../styles/supplier-classic.css';
import '../styles/farm-produce.css';

const PREFS_KEY = 'farmProduce.prefs';
const SEEN_KEY = 'farmProduce.lastSeen';
const FOCUS_REFRESH_MS = 60 * 1000;

// Browser storage can be missing or blocked (private windows): the board must still work without it.
const readPrefs = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return { area: typeof saved.area === 'string' ? saved.area : '', sort: SORTS.some((s) => s.value === saved.sort) ? saved.sort : 'best' };
  } catch { return { area: '', sort: 'best' }; }
};
const writePrefs = (prefs) => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* not remembered */ } };
const readSeen = () => { try { const n = Number(localStorage.getItem(SEEN_KEY)); return n > 0 ? n : null; } catch { return null; } };
const writeSeen = (t) => { try { localStorage.setItem(SEEN_KEY, String(t)); } catch { /* not remembered */ } };

const longDate = (iso) => new Date(iso).toLocaleDateString('en-UG', { day: 'numeric', month: 'short' });

const VERDICT_BADGE = {
  below: (v) => ({ tone: 'ok', text: `${Math.abs(v.diffPct)}% under market` }),
  above: (v) => ({ tone: 'warn', text: `${v.diffPct}% above market` }),
  fair: () => ({ tone: 'info', text: 'Fair price' }),
};

/** Where this offer's price sits between the cheapest and dearest offer for the crop. */
function PriceBar({ entry }) {
  const { offer, summary } = entry;
  const price = comparable(offer)?.price;
  if (!summary || summary.count < 2 || !(summary.max > summary.min) || !(price > 0)) return null;
  const pos = (p) => Math.min(100, Math.max(0, ((p - summary.min) / (summary.max - summary.min)) * 100));
  const show = (p) => formatUgx(fromBase(p, offer.unit));
  return (
    <div>
      <div className="spc-fp-bar" aria-hidden="true">
        <span className="median" style={{ left: `${pos(summary.median)}%` }} />
        <span className="you" style={{ left: `${pos(price)}%` }} />
      </div>
      <div className="spc-fp-bar-legend" aria-hidden="true">
        <span>{show(summary.min)}</span>
        <span>typical {show(summary.median)}</span>
        <span>{show(summary.max)}</span>
      </div>
    </div>
  );
}

function OfferRow({ entry, open, onToggle, isNew, interest, message, onMessage, busy, onInterested, onWithdraw, who, hasPhone }) {
  const { offer, verdict, near, ready, match, margin, restock, total } = entry;
  const badge = VERDICT_BADGE[verdict.level]?.(verdict);
  const where = [offer.district, offer.sub_region].filter(Boolean).join(', ');
  const per = unitName(offer.unit);

  return (
    <div className={`spc-item spc-fp-item${isNew ? ' is-new' : ''}`}>
      <button type="button" className="spc-item-head" onClick={onToggle} aria-expanded={open}>
        <div className="spc-item-main">
          <p className="spc-item-title">
            {offer.crop} · {Number(offer.quantity).toLocaleString('en-UG')} {unitName(offer.unit, offer.quantity)}
          </p>
          <p className="spc-item-meta">
            {formatUgx(offer.price_per_unit)} per {per} · {where || 'Uganda'} · {offer.farmer_name} · {postedAgo(offer.created_at)}
          </p>
          <div className="spc-fp-badges">
            {isNew && <span className="spc-badge info">New</span>}
            {badge && <span className={`spc-badge ${badge.tone}`}>{badge.text}</span>}
            {PROXIMITY_LABEL[near] && <span className="spc-badge ok">{PROXIMITY_LABEL[near]}</span>}
            {offer.is_organic && <span className="spc-badge ok">Organic</span>}
            {!ready.now && <span className="spc-badge warn">{ready.label.replace(/\d{4}-\d{2}-\d{2}/, longDate(ready.date))}</span>}
            {match?.kind === 'exact' && <span className="spc-badge info">In your catalog</span>}
            {restock && <span className="spc-badge warn">Low in your stock</span>}
            {interest && <span className="spc-badge ok">You’re interested</span>}
          </div>
        </div>
        <div className="spc-item-side">
          {total > 0 && <span className="spc-amount">{formatUgx(total)}</span>}
          <ChevronDown size={18} className={`spc-chev${open ? ' open' : ''}`} aria-hidden="true" />
        </div>
      </button>

      {open && (
        <div className="spc-item-body">
          <div className="spc-kv" style={{ paddingTop: 10 }}>
            <div><div className="k">Price</div><div className="v">{formatUgx(offer.price_per_unit)} per {per}</div></div>
            <div><div className="k">Total if you take it all</div><div className="v">{formatUgx(total)}</div></div>
            <div><div className="k">Ready</div><div className="v">{ready.now ? 'Now' : longDate(ready.date)}</div></div>
            <div><div className="k">Offer</div><div className="v">{closesLabel(offer)}</div></div>
            <div className="wide"><div className="k">Farmer</div><div className="v">{offer.farmer_name}{where ? ` · ${where}` : ''}</div></div>
          </div>

          <div>
            <p className="spc-sub">{describeMarket(offer, entry.summary, verdict)}</p>
            <PriceBar entry={entry} />
          </div>

          {match && (
            <p className={`spc-fp-cat${restock ? ' restock' : ''}`}>
              {describeCatalog(offer, match, margin)}
              {restock && ' Your stock of it is low, so this could refill it.'}
            </p>
          )}

          {offer.notes && <p className="spc-desc" style={{ paddingTop: 0 }}>“{offer.notes}”</p>}

          <div className="spc-fp-actions">
            <a className="spc-btn ghost" href={telLink(offer.contact_phone)}><Phone size={16} aria-hidden="true" /> Call {offer.farmer_name.split(' ')[0]}</a>
            <a className="spc-btn ghost" href={whatsappLink(offer.contact_phone, enquiryText(offer, who))} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={16} aria-hidden="true" /> WhatsApp
            </a>
          </div>

          {interest ? (
            <div className="spc-fp-interest">
              <span className="spc-badge ok"><Check size={13} aria-hidden="true" />&nbsp;The farmer can see you’re interested</span>
              <button type="button" className="spc-btn danger" disabled={busy} onClick={onWithdraw}>Withdraw</button>
            </div>
          ) : (
            <div className="spc-fp-interest">
              <input
                className="spc-input" value={message} maxLength={300} onChange={(e) => onMessage(e.target.value)}
                placeholder="Add a message (optional)" aria-label={`Message to ${offer.farmer_name}`}
              />
              <button type="button" className="spc-btn ok" disabled={busy} onClick={onInterested}>
                {busy ? 'Sending…' : 'I’m interested'}
              </button>
            </div>
          )}
          {!interest && !hasPhone && (
            <p className="spc-fp-mini">Add your phone number to your supplier profile so the farmer can call you back.</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Farm Produce: what farmers have on offer, at what price, live. Farmers post in the AgriBone app; this
 * board ranks the offers (against the typical price, your area, your own catalog) and lets you call,
 * WhatsApp or tell the farmer you're interested.
 *   userId          the id the My Catalog tab uses, for matching offers to the supplier's own items
 *   supplierProfile name / phone shown to the farmer when interest is shown
 */
export default function FarmProduceBoard({ userId, supplierProfile = null }) {
  const [offers, setOffers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [interests, setInterests] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [prefs, setPrefs] = useState(readPrefs);
  const [filters, setFilters] = useState({ search: '', organic: false, readyNow: false, inCatalog: false, onlyArea: false });
  const [openId, setOpenId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);

  const lastSeen = useRef(readSeen());
  const myUid = useRef(null);
  const loadedAt = useRef(0);

  const who = supplierProfile?.name || supplierProfile?.contactPerson || '';
  const phone = supplierProfile?.phone || '';

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    const [o, c, i] = await Promise.all([getOpenOffers(), getCatalogForMatching(userId), getMyInterests()]);
    if (!o.success) {
      setMissing(o.missingTable);
      setError(o.missingTable ? '' : 'Could not load farm produce. Check your connection and try again.');
      setOffers([]);
      setLoading(false);
      return;
    }
    setMissing(false);
    setError('');
    setOffers(o.data);
    setCatalog(c.data);
    setInterests(i.data);
    loadedAt.current = Date.now();
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getAuthUserId().then((id) => { myUid.current = id; }).catch(() => {}); }, []);

  // New offers arrive on their own: a toast, then a quiet reload of the list.
  useEffect(() => {
    let timer;
    let stop = () => {};
    try {
      stop = subscribeToOffers((payload) => {
        const row = payload?.new;
        if (payload?.eventType === 'INSERT' && row?.status === 'active' && row.farmer_id !== myUid.current) {
          toast.info(`New farm offer: ${row.crop}, ${Number(row.quantity).toLocaleString('en-UG')} ${unitName(row.unit, row.quantity)} at ${formatUgx(row.price_per_unit)} per ${unitName(row.unit)}`, { autoClose: 8000 });
        }
        clearTimeout(timer);
        timer = setTimeout(() => load({ quiet: true }), 600);
      });
    } catch (err) {
      console.warn('[FarmProduce] live updates unavailable:', err);
    }
    return () => { clearTimeout(timer); stop(); };
  }, [load]);

  // Coming back to the tab after a while: refresh, so a stale price is never shown.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - loadedAt.current > FOCUS_REFRESH_MS) load({ quiet: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  // "New" means posted since the last time the supplier looked.
  useEffect(() => {
    const markSeen = () => writeSeen(Date.now());
    window.addEventListener('pagehide', markSeen);
    return () => { window.removeEventListener('pagehide', markSeen); markSeen(); };
  }, []);

  const setPref = (patch) => setPrefs((p) => { const next = { ...p, ...patch }; writePrefs(next); return next; });
  const setFilter = (patch) => setFilters((f) => ({ ...f, ...patch }));

  const decorated = useMemo(() => decorate(offers, { catalog, area: prefs.area }), [offers, catalog, prefs.area]);
  const summaries = useMemo(() => marketSummaries(offers), [offers]);
  const markets = useMemo(() => topMarkets(summaries, 8), [summaries]);
  const shown = useMemo(
    () => sortOffers(filterOffers(decorated, { ...filters, area: prefs.area }), prefs.sort),
    [decorated, filters, prefs.area, prefs.sort],
  );

  const isNew = (offer) => lastSeen.current != null && new Date(offer.created_at).getTime() > lastSeen.current;
  const stats = {
    live: decorated.length,
    crops: summaries.size,
    below: decorated.filter((d) => d.verdict.level === 'below').length,
    inCatalog: decorated.filter((d) => d.match?.kind === 'exact').length,
    restock: decorated.filter((d) => d.restock).length,
    fresh: decorated.filter((d) => isNew(d.offer)).length,
  };
  const filtering = Boolean(filters.search || filters.organic || filters.readyNow || filters.inCatalog || filters.onlyArea);

  const interested = async (offer) => {
    setBusyId(offer.id);
    const result = await expressInterest(offer.id, { name: who, phone, message: drafts[offer.id] });
    setBusyId(null);
    if (!result.success) { toast.error(result.error); return; }
    toast.success(`Sent. ${offer.farmer_name} can now see that you’re interested.`);
    setInterests((prev) => ({ ...prev, [offer.id]: { offer_id: offer.id, message: drafts[offer.id] || null, created_at: new Date().toISOString() } }));
  };

  const withdraw = async (offer) => {
    setBusyId(offer.id);
    const result = await withdrawInterest(offer.id);
    setBusyId(null);
    if (!result.success) { toast.error(result.error); return; }
    setInterests((prev) => { const next = { ...prev }; delete next[offer.id]; return next; });
  };

  return (
    <div className="spc">
      <section className="spc-hero">
        <p className="spc-eyebrow">Straight from the farm</p>
        <h2>Farm Produce</h2>
        <p>Farmers post what they have and the price they want. See it the moment it is posted, compare it with what others are asking, and call, WhatsApp or tell the farmer you’re interested.</p>
      </section>

      {missing && (
        <div className="spc-note warn">Farm produce isn’t switched on for this project yet. Run <b>12_produce_offers.sql</b> (from the farm-agentera project) in Supabase, then refresh.</div>
      )}
      {error && <div className="spc-note bad">{error}</div>}

      {!missing && (
        <>
          <div className="spc-stats">
            <div className="spc-stat"><p className="spc-stat-label">Offers live</p><p className="spc-stat-value">{stats.live}</p>{stats.fresh > 0 && <p className="spc-stat-note">{stats.fresh} new since your last visit</p>}</div>
            <div className="spc-stat"><p className="spc-stat-label">Crops</p><p className="spc-stat-value">{stats.crops}</p></div>
            <div className={`spc-stat${stats.below ? ' is-ok' : ''}`}><p className="spc-stat-label">Under market</p><p className="spc-stat-value">{stats.below}</p><p className="spc-stat-note">{`Needs ${MIN_SAMPLE}+ offers of a crop to compare`}</p></div>
            <div className="spc-stat"><p className="spc-stat-label">In your catalog</p><p className="spc-stat-value">{stats.inCatalog}</p>{stats.restock > 0 && <p className="spc-stat-note">{stats.restock} for items you’re low on</p>}</div>
          </div>

          {markets.length > 0 && (
            <section className="spc-card" aria-label="Today's farm market">
              <div className="spc-card-head">
                <div>
                  <p className="spc-eyebrow">Today’s farm market</p>
                  <h3 className="spc-title">What’s on offer, and the typical price</h3>
                </div>
                <button type="button" className="spc-icon-btn" onClick={() => load()} disabled={loading} aria-label="Refresh offers">
                  <RefreshCw size={18} className={loading ? 'spc-spin' : ''} />
                </button>
              </div>
              <div className="spc-fp-markets">
                {markets.map((m) => {
                  const on = filters.search.trim().toLowerCase() === m.crop.toLowerCase();
                  return (
                    <button key={m.key} type="button" className={`spc-fp-market${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setFilter({ search: on ? '' : m.crop })}>
                      <b>{m.crop}</b>
                      <span>{m.count} offer{m.count === 1 ? '' : 's'}</span>
                      <em>{m.count >= MIN_SAMPLE ? `typical ${formatUgx(m.median)}/${m.unit}` : `${formatUgx(m.min)}${m.max > m.min ? `–${Math.round(m.max).toLocaleString('en-UG')}` : ''}/${m.unit}`}</em>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="spc-card" aria-label="Find produce">
            <div className="spc-fp-toolbar">
              <label className="spc-fp-search">
                <Search size={16} aria-hidden="true" />
                <input
                  className="spc-input" value={filters.search} onChange={(e) => setFilter({ search: e.target.value })}
                  placeholder="Search produce, farmer or place" aria-label="Search produce, farmer or place"
                />
              </label>
              <label className="spc-field">
                <span><MapPin size={11} aria-hidden="true" /> Your area</span>
                <select className="spc-input" value={prefs.area} onChange={(e) => { setPref({ area: e.target.value }); if (!e.target.value) setFilter({ onlyArea: false }); }}>
                  <option value="">Anywhere in Uganda</option>
                  {Object.entries(REGIONS).map(([region, subs]) => (
                    <optgroup key={region} label={region}>{subs.map((s) => <option key={s} value={s}>{s}</option>)}</optgroup>
                  ))}
                </select>
              </label>
            </div>

            <div className="spc-fp-chips" style={{ marginTop: 10 }}>
              <button type="button" className={`spc-fp-chip${filters.inCatalog ? ' on' : ''}`} aria-pressed={filters.inCatalog} onClick={() => setFilter({ inCatalog: !filters.inCatalog })}>In my catalog</button>
              <button type="button" className={`spc-fp-chip${filters.organic ? ' on' : ''}`} aria-pressed={filters.organic} onClick={() => setFilter({ organic: !filters.organic })}>Organic</button>
              <button type="button" className={`spc-fp-chip${filters.readyNow ? ' on' : ''}`} aria-pressed={filters.readyNow} onClick={() => setFilter({ readyNow: !filters.readyNow })}>Ready now</button>
              <button type="button" className={`spc-fp-chip${filters.onlyArea ? ' on' : ''}`} aria-pressed={filters.onlyArea} disabled={!prefs.area} title={prefs.area ? '' : 'Choose your area first'} onClick={() => setFilter({ onlyArea: !filters.onlyArea })}>
                {prefs.area ? `Near ${prefs.area} only` : 'Near me only'}
              </button>
            </div>

            <div className="spc-seg" role="group" aria-label="Sort offers" style={{ marginTop: 10 }}>
              {SORTS.map((s) => (
                <button key={s.value} type="button" className={prefs.sort === s.value ? 'on' : ''} aria-pressed={prefs.sort === s.value} onClick={() => setPref({ sort: s.value })}>{s.label}</button>
              ))}
            </div>
            {prefs.sort === 'nearest' && !prefs.area && <p className="spc-fp-mini" style={{ marginTop: 8 }}>Choose your area above to put the closest farms first.</p>}
          </section>

          {loading && !offers.length ? (
            <p className="spc-sub" style={{ textAlign: 'center', padding: 24 }}>Loading farm produce…</p>
          ) : shown.length === 0 ? (
            <div className="spc-empty">
              <b>{filtering ? 'Nothing matches those filters' : 'No farm produce on offer right now'}</b>
              <span>
                {filtering
                  ? 'Try removing a filter or searching for something else.'
                  : 'When a farmer posts what they have, it appears here straight away. You don’t need to refresh.'}
              </span>
              {filtering && (
                <button type="button" className="spc-btn ghost" style={{ marginTop: 12 }} onClick={() => setFilters({ search: '', organic: false, readyNow: false, inCatalog: false, onlyArea: false })}>
                  <Sprout size={16} aria-hidden="true" /> Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="spc-list" aria-live="polite">
              <p className="spc-sub">{shown.length} offer{shown.length === 1 ? '' : 's'}{filtering ? ` of ${decorated.length}` : ''}</p>
              {shown.map((entry) => (
                <OfferRow
                  key={entry.offer.id}
                  entry={entry}
                  open={openId === entry.offer.id}
                  onToggle={() => setOpenId(openId === entry.offer.id ? null : entry.offer.id)}
                  isNew={isNew(entry.offer)}
                  interest={interests[entry.offer.id]}
                  message={drafts[entry.offer.id] || ''}
                  onMessage={(text) => setDrafts((d) => ({ ...d, [entry.offer.id]: text }))}
                  busy={busyId === entry.offer.id}
                  onInterested={() => interested(entry.offer)}
                  onWithdraw={() => withdraw(entry.offer)}
                  who={who}
                  hasPhone={Boolean(phone)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
