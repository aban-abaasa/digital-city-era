import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiClock, FiPackage, FiPlus, FiRefreshCw, FiSearch, FiX } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { supabaseConfig } from '../services/supabase';
import { REASON_LABELS, STOCK_REASONS, addProduct, adjustStock, getPendingStock, getStockHistory, listInventory } from '../services/localInventoryService';
import './BusinessLocalServerSetup.css';

const MODES = [
  ['add', 'Add stock'],
  ['remove', 'Remove'],
  ['set', 'Set count'],
];

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmtSigned = (n) => `${Number(n) > 0 ? '+' : ''}${fmt(n)}`;

// 'out' when nothing is left, 'low' when at or under the product's own minimum / reorder level
const stockState = (item) => {
  const stock = Number(item.current_stock);
  if (stock <= 0) return 'out';
  const threshold = Math.max(Number(item.minimum_stock) || 0, Number(item.reorder_point) || 0);
  return threshold > 0 && stock <= threshold ? 'low' : 'ok';
};

const parseQuantity = (text) => {
  const value = Number(String(text).trim().replace(',', '.'));
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : NaN;
};

const AdjustSheet = ({ item, onClose, onSaved }) => {
  const [mode, setMode] = useState('add');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('received');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState(null);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    getStockHistory(item.product_id, 8).then((rows) => { if (!cancelled) setHistory(rows); }).catch(() => { if (!cancelled) setHistory([]); });
    return () => { cancelled = true; };
  }, [item.product_id]);

  const changeMode = (next) => {
    setMode(next);
    setReason(STOCK_REASONS[next][0][0]);
    setError('');
  };

  const stock = Number(item.current_stock);
  const amount = parseQuantity(quantity);
  const valid = quantity.trim() !== '' && Number.isFinite(amount) && (mode === 'set' ? amount >= 0 : amount > 0);
  const after = !valid ? null : mode === 'add' ? stock + amount : mode === 'remove' ? stock - amount : amount;
  const tooMuch = after !== null && after < 0;

  const save = async (event) => {
    event.preventDefault();
    if (!valid || tooMuch) return;
    setSaving(true);
    setError('');
    try {
      const result = await adjustStock({ productId: item.product_id, mode, quantity: amount, reason, note: note.trim() });
      onSaved(item, result);
    } catch (requestError) {
      setError(requestError.message || 'Could not change the stock.');
      setSaving(false);
    }
  };

  return (
    <div className="bls-sheet-back" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="bls-sheet" onSubmit={save} role="dialog" aria-modal="true" aria-label={`Change stock for ${item.name}`}>
        <div className="bls-sheet-head">
          <div>
            <p className="bls-eyebrow">Change stock</p>
            <h2>{item.name}</h2>
            <p className="bls-sub">{item.sku || item.barcode || 'No code'} · now <strong>{fmt(stock)}</strong> in stock</p>
          </div>
          <button type="button" className="bls-btn is-ghost is-small" onClick={onClose} aria-label="Close"><FiX /></button>
        </div>

        <div className="bls-seg is-three" role="group" aria-label="Type of change">
          {MODES.map(([key, label]) => (
            <button key={key} type="button" aria-pressed={mode === key} onClick={() => changeMode(key)}>{label}</button>
          ))}
        </div>

        <div className="bls-field">
          <label htmlFor="inv-qty">{mode === 'set' ? 'Counted quantity' : mode === 'add' ? 'Quantity to add' : 'Quantity to remove'}</label>
          <input id="inv-qty" className="bls-input" inputMode="decimal" autoComplete="off" autoFocus value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="0" />
        </div>

        {after !== null && (
          <p className={`bls-preview${tooMuch ? ' is-bad' : ''}`}>
            {tooMuch ? `Not enough stock — only ${fmt(stock)} in stock.` : <>Stock will go from <b>{fmt(stock)}</b> to <b>{fmt(after)}</b> ({fmtSigned(after - stock)})</>}
          </p>
        )}

        <div className="bls-field">
          <label htmlFor="inv-reason">Reason</label>
          <select id="inv-reason" className="bls-select" value={reason} onChange={(event) => setReason(event.target.value)}>
            {STOCK_REASONS[mode].map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>

        <div className="bls-field">
          <label htmlFor="inv-note">Note<small>optional</small></label>
          <input id="inv-note" className="bls-input" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. invoice number" autoComplete="off" />
        </div>

        {error && <p role="alert" className="bls-err">{error}</p>}

        <button type="submit" className="bls-btn is-block" disabled={!valid || tooMuch || saving}>
          <FiCheck /> {saving ? 'Saving…' : 'Save change'}
        </button>
        <p className="bls-sub">The new number is saved on this server straight away and sent to the cloud when the internet is available.</p>

        {history && history.length > 0 && (
          <details className="bls-trouble">
            <summary><span>Recent changes to this product</span><span className="bls-chev" aria-hidden="true" /></summary>
            <ul className="bls-stafflist" style={{ padding: '0 14px 12px' }}>
              {history.map((row) => (
                <li key={row.id} className="bls-staffrow">
                  <div className="bls-staffinfo">
                    <b>{fmtSigned(row.delta)} <span className={`bls-badge ${row.synced ? 'is-ok' : 'is-gold'}`}>{row.synced ? 'Synced' : 'Waiting to sync'}</span></b>
                    <small>{REASON_LABELS[row.reason] || row.reason}{row.note ? ` · ${row.note}` : ''} · {fmt(row.stock_before)} → {fmt(row.stock_after)} · {row.staff_name} · {new Date(row.created_at).toLocaleString()}</small>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </form>
    </div>
  );
};

const AddProductSheet = ({ pairedToProfile, onClose, onAdded }) => {
  const [form, setForm] = useState({ name: '', price: '', stock: '', sku: '', barcode: '', tax: '18', low: '10' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const price = parseQuantity(form.price);
  const stock = form.stock.trim() === '' ? 0 : parseQuantity(form.stock);
  const tax = form.tax.trim() === '' ? 0 : parseQuantity(form.tax);
  const low = form.low.trim() === '' ? 0 : parseQuantity(form.low);
  const valid = form.name.trim().length > 0
    && form.price.trim() !== '' && Number.isFinite(price) && price >= 0
    && Number.isFinite(stock) && stock >= 0
    && Number.isFinite(tax) && tax >= 0 && tax <= 100
    && Number.isFinite(low) && low >= 0;

  const save = async (event) => {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError('');
    try {
      const result = await addProduct({
        name: form.name.trim(),
        sellingPrice: price,
        sku: form.sku.trim(),
        barcode: form.barcode.trim(),
        taxRate: tax,
        initialStock: stock,
        minimumStock: low,
        reorderPoint: Math.round(low * 2 * 100) / 100,
      });
      onAdded(form.name.trim(), result);
    } catch (requestError) {
      setError(requestError.message || 'Could not add the product.');
      setSaving(false);
    }
  };

  return (
    <div className="bls-sheet-back" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="bls-sheet" onSubmit={save} role="dialog" aria-modal="true" aria-label="Add a product">
        <div className="bls-sheet-head">
          <div>
            <p className="bls-eyebrow">New product</p>
            <h2>Add a product</h2>
            <p className="bls-sub">It is saved on this server right away and sent to your cloud store when the internet is available.</p>
          </div>
          <button type="button" className="bls-btn is-ghost is-small" onClick={onClose} aria-label="Close"><FiX /></button>
        </div>

        <div className="bls-field">
          <label htmlFor="np-name">Product name</label>
          <input id="np-name" className="bls-input" autoFocus maxLength={255} autoComplete="off" value={form.name} onChange={set('name')} />
        </div>
        <div className="bls-two">
          <div className="bls-field">
            <label htmlFor="np-price">Selling price</label>
            <input id="np-price" className="bls-input" inputMode="decimal" autoComplete="off" value={form.price} onChange={set('price')} placeholder="0" />
          </div>
          <div className="bls-field">
            <label htmlFor="np-stock">Opening stock<small>optional</small></label>
            <input id="np-stock" className="bls-input" inputMode="decimal" autoComplete="off" value={form.stock} onChange={set('stock')} placeholder="0" />
          </div>
        </div>

        <details className="bls-trouble">
          <summary><span>More details (barcode, SKU, tax, low-stock level)</span><span className="bls-chev" aria-hidden="true" /></summary>
          <div className="bls-form" style={{ padding: '0 14px 14px' }}>
            <div className="bls-field">
              <label htmlFor="np-barcode">Barcode<small>blank = we generate one</small></label>
              <input id="np-barcode" className="bls-input is-mono" maxLength={100} autoComplete="off" value={form.barcode} onChange={set('barcode')} />
            </div>
            <div className="bls-field">
              <label htmlFor="np-sku">SKU<small>optional</small></label>
              <input id="np-sku" className="bls-input is-mono" maxLength={100} autoComplete="off" value={form.sku} onChange={set('sku')} />
            </div>
            <div className="bls-two">
              <div className="bls-field">
                <label htmlFor="np-tax">Tax rate %</label>
                <input id="np-tax" className="bls-input" inputMode="decimal" autoComplete="off" value={form.tax} onChange={set('tax')} />
              </div>
              <div className="bls-field">
                <label htmlFor="np-low">Low-stock level</label>
                <input id="np-low" className="bls-input" inputMode="decimal" autoComplete="off" value={form.low} onChange={set('low')} />
              </div>
            </div>
          </div>
        </details>

        {error && <p role="alert" className="bls-err">{error}</p>}

        <button type="submit" className="bls-btn is-block" disabled={!valid || saving}>
          <FiPlus /> {saving ? 'Adding…' : 'Add product'}
        </button>
      </form>
    </div>
  );
};

const LocalInventory = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [pending, setPending] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rows, waiting] = await Promise.all([listInventory(), getPendingStock().catch(() => ({}))]);
      setItems(rows);
      setPending(waiting);
    } catch (requestError) {
      setError(requestError.message || 'Could not load the inventory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const counts = useMemo(() => {
    const result = { low: 0, out: 0 };
    items.forEach((item) => { const state = stockState(item); if (state !== 'ok') result[state] += 1; });
    return result;
  }, [items]);
  const waitingChanges = Object.values(pending).reduce((sum, p) => sum + p.changes, 0);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== 'all' && stockState(item) !== filter) return false;
      return !q || [item.name, item.sku, item.barcode].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [items, query, filter]);

  if (!supabaseConfig.localBusinessServer) return <Navigate to="/" replace />;
  if (!user) return <Navigate to="/local-staff-login" replace />;
  if (user.localRole !== 'owner' && user.localRole !== 'manager') return <Navigate to="/local-home" replace />;

  const onSaved = async (item, result) => {
    setSelected(null);
    setItems((current) => current.map((row) => (row.product_id === item.product_id ? { ...row, current_stock: result.stock } : row)));
    setNotice(`${item.name}: ${fmt(item.current_stock)} → ${fmt(result.stock)}. Waiting to sync with the cloud.`);
    try { setPending(await getPendingStock()); } catch { /* the badge just updates on the next refresh */ }
  };

  const onAdded = async (name) => {
    setAdding(false);
    setNotice(`${name} added. It will reach the cloud store when the internet is available.`);
    await refresh();
  };

  const business = supabaseConfig.businessType;

  return (
    <main className="bls-page">
      <div className="bls is-wide">
        <Link to="/local-home" className="bls-back"><FiArrowLeft /> Home</Link>

        <header className="bls-hero">
          <p className="bls-eyebrow">Local server</p>
          <h1>Inventory</h1>
          <p className="bls-lead">Add products and correct stock on this server — receive deliveries, record damage and count shelves. Changes work offline and reach the cloud when the internet is back.</p>
          <div className="bls-stats">
            <span>{items.length} {items.length === 1 ? 'product' : 'products'}</span>
            <span>{counts.low} low</span>
            <span>{counts.out} out of stock</span>
            {waitingChanges > 0 && <span><FiClock style={{ verticalAlign: '-2px' }} /> {waitingChanges} waiting to sync</span>}
          </div>
        </header>

        <section className="bls-card">
          <div className="bls-card-head">
            <div className="bls-search">
              <FiSearch aria-hidden="true" />
              <input className="bls-input" type="search" placeholder="Search name, SKU or barcode" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search products" />
            </div>
            <div className="bls-code-actions">
              <button type="button" className="bls-btn is-small" onClick={() => setAdding(true)}><FiPlus /> Add product</button>
              <button type="button" className="bls-btn is-ghost is-small" onClick={refresh} disabled={loading} aria-label="Refresh inventory">
                <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>
          <div className="bls-body" style={{ paddingTop: 0 }}>
            <div className="bls-filters" role="group" aria-label="Filter products">
              {[['all', `All (${items.length})`], ['low', `Low (${counts.low})`], ['out', `Out (${counts.out})`]].map(([key, label]) => (
                <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>
              ))}
            </div>

            {error && <p role="alert" className="bls-err">{error}</p>}

            {loading && items.length === 0 ? (
              <>
                <div className="bls-skel" style={{ width: '70%' }} />
                <div className="bls-skel" style={{ width: '90%' }} />
                <div className="bls-skel" style={{ width: '80%' }} />
              </>
            ) : items.length === 0 ? (
              <div className="bls-empty">
                <FiPackage style={{ verticalAlign: '-2px', marginRight: 6 }} />
                <strong>No products on this server yet.</strong>{' '}
                Products from your cloud store are copied here a little while after pairing and whenever the internet is available. You can also add products here yourself.
                <div style={{ marginTop: 10 }}>
                  <button type="button" className="bls-btn is-small" onClick={() => setAdding(true)}><FiPlus /> Add your first product</button>
                </div>
              </div>
            ) : visible.length === 0 ? (
              <p className="bls-empty">No products match.</p>
            ) : (
              <ul className="bls-stafflist">
                {visible.map((item) => {
                  const state = stockState(item);
                  const wait = pending[item.product_id];
                  return (
                    <li key={item.product_id} className="bls-staffrow bls-prow">
                      <div className="bls-staffinfo">
                        <b>{item.name}</b>
                        <small>{[item.sku, item.barcode].filter(Boolean).join(' · ') || 'No code'} · price {fmt(item.selling_price)}</small>
                      </div>
                      <div className="bls-stock">
                        <strong>{fmt(item.current_stock)}</strong>
                        <span className={`bls-badge ${state === 'ok' ? 'is-ok' : state === 'low' ? 'is-gold' : 'is-off'}`}>{state === 'ok' ? 'In stock' : state === 'low' ? 'Low' : 'Out'}</span>
                        {wait && <span className="bls-badge is-gold" title="Changed on this server; the cloud has not confirmed it yet"><FiClock style={{ verticalAlign: '-1px' }} /> {fmtSigned(wait.delta)} waiting</span>}
                      </div>
                      {item.inventory_mode === 'stock_controlled' ? (
                        <button type="button" className="bls-btn is-small" onClick={() => setSelected(item)}>Change</button>
                      ) : (
                        <span className="bls-sub" title="Only stock-controlled products can be changed here">Not tracked</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {selected && <AdjustSheet item={selected} onClose={() => setSelected(null)} onSaved={onSaved} />}
      {adding && <AddProductSheet pairedToProfile={business === 'business_profile'} onClose={() => setAdding(false)} onAdded={onAdded} />}

      {notice && (
        <div role="status" className="bls-toast">
          <FiCheck />
          <span style={{ flex: 1 }}>{notice}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><FiX /></button>
        </div>
      )}
    </main>
  );
};

export default LocalInventory;
