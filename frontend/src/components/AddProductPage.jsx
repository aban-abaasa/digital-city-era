// =====================================================================
// ADD PRODUCTS PAGE - full screen, for Order Inventory - POS
// =====================================================================
// Opens over the whole admin dashboard so nothing else competes for attention. Built for shops
// that do not use a scanner: a name, a price and how many you have is all it takes. Everything
// else (barcode, SKU and tax, wholesale price, flavors) is folded away until it is wanted.
//
//   One product  - photo, name, prices and stock, with a profit helper, a warning when the
//                  product is already listed, a category guessed from the name, and
//                  "Save & add another" (or Enter) for working down a shelf.
//   Quick list   - a grid for typing many products at once: name, price, stock.
//
// The parent (OrderInventoryPOSControl) owns the form state and does the saving; this file is
// the screen. Pure rules (duplicates, category guess, margin) live in utils/addProductSmarts.js.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiAlertTriangle, FiArrowLeft, FiCamera, FiCheck, FiChevronDown, FiHash, FiImage,
  FiList, FiMinus, FiPackage, FiPlus, FiTrash2, FiZap
} from 'react-icons/fi';
import ProductFlavorsEditor from './ProductFlavorsEditor';
import { withDiscountPercent, withSellingPrice, withWholesalePrice } from '../utils/wholesalePricing';
import {
  checkQuickRows, findSimilarProducts, marginPercent, newQuickRow, priceFromMargin, suggestCategoryId
} from '../utils/addProductSmarts';

const AP_STYLES = `
.ap-root {
  --ap-ink: #14213d; --ap-ink-2: #1f3260; --ap-gold: #b8912f; --ap-gold-soft: #f4ead0;
  --ap-bg: #f6f3ea; --ap-card: #ffffff; --ap-line: #e7dfcc; --ap-muted: #6b7280;
  --ap-green: #1f6f4a; --ap-green-soft: #e4f3ea; --ap-warn: #9a3412; --ap-warn-soft: #fff4e0; --ap-red: #b42318;
  background: var(--ap-bg); color: var(--ap-ink);
  animation: ap-in .22s ease-out both;
}
@keyframes ap-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.ap-bar { background: linear-gradient(90deg, #14213d, #1f3260); color: #fff; border-bottom: 2px solid var(--ap-gold); }
.ap-bar-btn { display: inline-flex; align-items: center; gap: .35rem; padding: .5rem .7rem; border-radius: 8px; background: rgba(255,255,255,.12); color: #fff; font-weight: 600; font-size: .875rem; }
.ap-bar-btn:hover { background: rgba(255,255,255,.22); }
.ap-added { background: var(--ap-green-soft); color: var(--ap-green); border-radius: 999px; padding: .2rem .65rem; font-size: .8rem; font-weight: 700; white-space: nowrap; }
.ap-modes { background: var(--ap-card); border-bottom: 1px solid var(--ap-line); }
.ap-mode { position: relative; padding: .7rem 1rem; font-weight: 700; font-size: .9rem; color: var(--ap-muted); display: inline-flex; align-items: center; gap: .4rem; }
.ap-mode[aria-selected='true'] { color: var(--ap-ink); }
.ap-mode[aria-selected='true']::after { content: ''; position: absolute; left: .75rem; right: .75rem; bottom: 0; height: 3px; border-radius: 3px 3px 0 0; background: var(--ap-gold); }
/* No boxes: sections sit flat on the page, separated by a thin line */
.ap-card { background: none; border: 0; border-bottom: 1px solid var(--ap-line); border-radius: 0; padding: .25rem 0 1.1rem; }
.ap-label { display: block; font-size: .8rem; font-weight: 700; color: #374151; margin-bottom: .35rem; }
.ap-hint { font-size: .75rem; color: var(--ap-muted); margin-top: .3rem; }
.ap-input { width: 100%; border: 2px solid #d9d2bf; border-radius: 10px; background: #fff; color: #111827; padding: .6rem .8rem; font-size: 1rem; }
.ap-input:focus { outline: none; border-color: var(--ap-gold); box-shadow: 0 0 0 3px rgba(184,145,47,.2); }
.ap-input[aria-invalid='true'] { border-color: #f04438; }
.ap-input:disabled { background: #f3f4f6; color: #6b7280; cursor: not-allowed; }
.ap-big { font-size: 1.35rem; font-weight: 800; padding-left: 3.6rem; }
.ap-prefix { position: absolute; left: .85rem; top: 50%; transform: translateY(-50%); font-weight: 700; color: var(--ap-muted); font-size: .85rem; pointer-events: none; }
.ap-error { color: var(--ap-red); font-size: .78rem; font-weight: 600; margin-top: .3rem; }
.ap-chip { display: inline-flex; align-items: center; gap: .3rem; border: 1px solid #d9d2bf; background: #fff; color: var(--ap-ink); border-radius: 999px; padding: .3rem .7rem; font-size: .8rem; font-weight: 700; }
.ap-chip:hover { border-color: var(--ap-gold); background: var(--ap-gold-soft); }
.ap-chip:active { transform: scale(.96); }
.ap-chip:disabled { opacity: .5; cursor: not-allowed; }
.ap-notice { display: flex; gap: .55rem; align-items: flex-start; border-radius: 10px; padding: .6rem .75rem; font-size: .82rem; margin-top: .6rem; }
.ap-notice-warn { background: var(--ap-warn-soft); color: var(--ap-warn); border: 1px solid #f1d59e; }
.ap-notice-info { background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; }
.ap-notice-good { background: var(--ap-green-soft); color: var(--ap-green); border: 1px solid #bfe0cd; }
.ap-fold { background: none; border: 0; border-bottom: 1px solid var(--ap-line); border-radius: 0; }
.ap-fold-head { width: 100%; display: flex; align-items: center; gap: .6rem; text-align: left; padding: .8rem 0; font-weight: 700; }
.ap-fold-head:hover { color: var(--ap-gold); }
.ap-fold-body { padding: 0 0 1rem; }
.ap-btn { white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; gap: .45rem; border-radius: 12px; padding: .8rem 1.1rem; font-weight: 800; font-size: .95rem; border: 2px solid transparent; transition: transform .1s, background .15s; }
.ap-btn:active:not(:disabled) { transform: scale(.98); }
.ap-btn:disabled { opacity: .6; cursor: wait; }
.ap-btn-primary { background: var(--ap-green); color: #fff; }
.ap-btn-primary:hover:not(:disabled) { background: #185a3b; }
.ap-btn-second { background: #fff; color: var(--ap-ink); border-color: var(--ap-ink); }
.ap-btn-second:hover:not(:disabled) { background: var(--ap-gold-soft); }
.ap-btn-ghost { background: transparent; color: var(--ap-muted); }
.ap-btn-ghost:hover { color: var(--ap-ink); background: rgba(0,0,0,.05); }
.ap-foot .ap-btn { padding: .75rem .9rem; }
@media (max-width: 400px) {
  .ap-foot { padding-inline: .6rem; gap: .4rem; }
  .ap-foot .ap-btn { padding: .75rem .6rem; font-size: .9rem; }
  .ap-foot .ap-btn-ghost { padding-inline: .35rem; }
}
.ap-foot { background: var(--ap-card); border-top: 1px solid var(--ap-line); padding: .75rem 1rem calc(.75rem + env(safe-area-inset-bottom)); }
.ap-step { width: 2.6rem; flex: none; border-radius: 10px; border: 2px solid #d9d2bf; background: #fff; display: inline-flex; align-items: center; justify-content: center; }
.ap-step:hover { border-color: var(--ap-gold); background: var(--ap-gold-soft); }
.ap-photo { width: 5rem; height: 5rem; flex: none; border-radius: 12px; border: 2px dashed #cbbf9c; background: #fbf8f1; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; color: var(--ap-muted); font-size: .65rem; font-weight: 700; gap: .15rem; }
.ap-photo:hover { border-color: var(--ap-gold); }
.ap-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) 2.5rem; gap: .5rem; align-items: center; }
.ap-row > :first-child { grid-column: 1 / -1; }
.ap-row-card { padding: 0 0 .7rem; border-bottom: 1px solid var(--ap-line); }
.ap-row-head { display: none; font-size: .72rem; font-weight: 800; color: var(--ap-muted); text-transform: uppercase; letter-spacing: .04em; }
.ap-cellinput { padding: .6rem .7rem; font-size: 1rem; min-height: 2.75rem; }
.ap-del { display: inline-flex; align-items: center; justify-content: center; width: 2.5rem; height: 2.75rem; border-radius: 10px; color: var(--ap-muted); }
.ap-del:hover:not(:disabled) { color: var(--ap-red); background: rgba(240,68,56,.08); }
.ap-del:disabled { opacity: .35; }
@media (min-width: 560px) {
  .ap-row { grid-template-columns: minmax(0, 1fr) 6.5rem 6.5rem 6.5rem 2.5rem; }
  .ap-row > :first-child { grid-column: auto; }
  .ap-row-card { padding: 0; border: 0; }
  .ap-row-head { display: grid; }
}
.ap-chip { min-height: 2.25rem; }
@media (max-width: 400px) {
  .ap-photo { width: 4.25rem; height: 4.25rem; }
  .ap-big { font-size: 1.2rem; padding-left: 3.2rem; }
  .ap-mode { padding: .65rem .7rem; }
}
.ap-prev { border: 1px solid var(--ap-line); border-radius: 12px; overflow: hidden; background: #fff; }
.ap-prev-img { aspect-ratio: 4 / 3; background: linear-gradient(135deg, #e0e7ff, #fde68a); display: flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: 800; color: rgba(20,33,61,.55); overflow: hidden; }
[data-theme='dark'] .ap-root { --ap-bg: #0a1f17; --ap-card: #0f2a20; --ap-line: rgba(196,160,82,.3); --ap-ink: #f1ead4; --ap-muted: #a3b3aa; --ap-gold-soft: rgba(184,145,47,.22); --ap-green-soft: rgba(31,111,74,.3); --ap-green: #4cc38a; --ap-warn-soft: rgba(180,95,6,.22); --ap-warn: #f6c177; }
[data-theme='dark'] .ap-root .ap-label { color: #d6ddd9; }
[data-theme='dark'] .ap-root .ap-input, [data-theme='dark'] .ap-root .ap-step, [data-theme='dark'] .ap-root .ap-chip, [data-theme='dark'] .ap-root .ap-btn-second, [data-theme='dark'] .ap-root .ap-prev { background: #0c231b; color: #f1ead4; border-color: rgba(196,160,82,.4); }
[data-theme='dark'] .ap-root .ap-btn-primary { color: #06210f; }
[data-theme='dark'] .ap-root .ap-notice-info { background: rgba(255,255,255,.06); color: #d6ddd9; border-color: rgba(255,255,255,.12); }
@media (prefers-reduced-motion: reduce) { .ap-root { animation: none; } .ap-btn, .ap-chip { transition: none; } }
`;

const money = (value) => `UGX ${Math.round(Number(value) || 0).toLocaleString()}`;
const STOCK_CHIPS = [6, 12, 24, 50, 100];
const MARGIN_CHIPS = [10, 20, 30, 50];

// A section that stays out of the way until opened. Its content stays mounted while folded so
// nothing typed inside is lost. `openWhen` opens it (never closes it) when something fills it in
// for you, such as a scanned barcode.
const Fold = ({ icon, title, subtitle, badge, openWhen = false, children }) => {
  const [open, setOpen] = useState(openWhen);
  useEffect(() => { if (openWhen) setOpen(true); }, [openWhen]);
  return (
    <section className="ap-fold">
      <button type="button" className="ap-fold-head" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span aria-hidden="true" className="text-lg">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm sm:text-base">{title}</span>
          {subtitle && <span className="block text-xs font-normal" style={{ color: 'var(--ap-muted)' }}>{subtitle}</span>}
        </span>
        {badge && <span className="ap-added">{badge}</span>}
        <FiChevronDown className={`h-5 w-5 flex-none transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <div className="ap-fold-body" hidden={!open}>{children}</div>
    </section>
  );
};

const AddProductPage = ({
  storeName,
  product,
  setProduct,
  errors,
  clearError,
  nameRef,
  stock,
  setStock,
  categories,
  products,
  photoPreview,
  onPickPhoto,
  barcodeLocked,
  registering,
  onScan,
  onGenerateBarcode,
  flavorRows,
  setFlavorRows,
  flavorSharedName,
  setFlavorSharedName,
  generateBarcode,
  offersWholesale,
  addedThisVisit,
  saving,
  onSave,
  onQuickSave,
  onClose
}) => {
  const [mode, setMode] = useState('single'); // 'single' | 'quick'
  const [categoryFromName, setCategoryFromName] = useState(false);
  const busy = saving || registering;

  // Nothing behind the page should scroll while it covers the dashboard
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const dirty = Boolean(product.name.trim()) || Number(product.selling_price) > 0;
  const requestClose = () => {
    if (mode === 'single' && dirty && !window.confirm('Leave without saving this product?')) return;
    onClose();
  };

  // ---------- smart helpers (single product) ----------
  const matches = useMemo(() => findSimilarProducts(product.name, products), [product.name, products]);
  const sameProduct = matches.find((match) => match.kind === 'same');
  const suggestedCategoryId = useMemo(
    () => suggestCategoryId(product.name, products, categories),
    [product.name, products, categories]
  );
  const suggestedCategory = categories.find((category) => category.id === suggestedCategoryId);
  const chosenCategory = categories.find((category) => category.id === product.category_id);

  const applyNameBlur = () => {
    if (!product.category_id && suggestedCategoryId) {
      setProduct((previous) => (previous.category_id ? previous : { ...previous, category_id: suggestedCategoryId }));
      setCategoryFromName(true);
    }
  };

  const cost = Number(product.cost_price) || 0;
  const selling = Number(product.selling_price) || 0;
  const margin = marginPercent(cost, selling);
  const stockNumber = Math.max(0, Math.floor(Number(stock) || 0));

  const setStockNumber = (value) => setStock(String(Math.max(0, Math.floor(value))));

  // Enter works down the shelf: save and start the next one. Not from the barcode box (a hand
  // scanner ends every code with Enter) and not from buttons or file pickers.
  const handleEnter = (event) => {
    if (event.key !== 'Enter' || event.defaultPrevented || event.shiftKey) return;
    const target = event.target;
    if (target.tagName !== 'INPUT' || ['file', 'checkbox', 'radio', 'button', 'submit'].includes(target.type)) return;
    if (target.closest('[data-no-enter-save]')) return;
    event.preventDefault();
    if (!busy) onSave(true);
  };

  // ---------- quick list ----------
  const [rows, setRows] = useState(() => Array.from({ length: 6 }, newQuickRow));
  const [quickCategory, setQuickCategory] = useState('');
  const [quickIssues, setQuickIssues] = useState({});
  const [quickSaving, setQuickSaving] = useState(false);
  const [showQuickErrors, setShowQuickErrors] = useState(false);
  const gridRef = useRef(null);

  const checked = useMemo(() => checkQuickRows(rows, products), [rows, products]);
  const allIssues = { ...checked.issues, ...quickIssues };

  // A cell already on the page takes focus at once (typing straight after Enter must not be lost);
  // a line that was only just added is on the page a moment later.
  const focusCell = (id, column) => {
    const find = () => gridRef.current?.querySelector(`[data-cell="${id}-${column}"]`);
    const cell = find();
    if (cell) cell.focus();
    else setTimeout(() => find()?.focus(), 0);
  };

  const updateRow = (id, patch) => {
    setRows((previous) => previous.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setQuickIssues((previous) => {
      if (!previous[id]) return previous;
      const { [id]: _gone, ...rest } = previous;
      return rest;
    });
  };

  const addRows = (count) => {
    const fresh = Array.from({ length: count }, newQuickRow);
    setRows((previous) => [...previous, ...fresh]);
    return fresh;
  };

  const removeRow = (id) => setRows((previous) => (previous.length > 1 ? previous.filter((row) => row.id !== id) : previous));

  const handleCellKey = (event, row, column) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const next = { name: 'price', price: 'cost', cost: 'stock', stock: null }[column];
    if (next) { focusCell(row.id, next); return; }
    const index = rows.findIndex((r) => r.id === row.id);
    if (index < rows.length - 1) { focusCell(rows[index + 1].id, 'name'); return; }
    const [fresh] = addRows(1);
    focusCell(fresh.id, 'name');
  };

  const saveQuick = async () => {
    if (quickSaving) return;
    setShowQuickErrors(true);
    if (Object.keys(checked.issues).length > 0) return;
    if (checked.ready.length === 0) return;

    setQuickSaving(true);
    try {
      const { savedIds, failedIds } = await onQuickSave(checked.ready, quickCategory || null);
      const saved = new Set(savedIds);
      const failed = new Set(failedIds);
      setRows((previous) => {
        const left = previous.filter((row) => !saved.has(row.id));
        const blanks = Math.max(0, 3 - left.length);
        return [...left, ...Array.from({ length: blanks }, newQuickRow)];
      });
      setQuickIssues(Object.fromEntries([...failed].map((id) => [id, 'Could not save, try again'])));
      if (failed.size === 0) setShowQuickErrors(false);
    } finally {
      setQuickSaving(false);
    }
  };

  const quickCount = checked.ready.length;
  const quickProblemCount = Object.keys(allIssues).length;

  // ---------- render ----------
  const avatarLetter = (product.name.trim()[0] || '?').toUpperCase();

  return (
    <div className="ap-root fixed inset-0 z-[1000] flex h-[100dvh] flex-col" role="dialog" aria-modal="true" aria-label="Add products">
      <style>{AP_STYLES}</style>

      <header className="ap-bar flex flex-none items-center gap-2 px-3 py-2.5 sm:px-5">
        <button type="button" className="ap-bar-btn" onClick={requestClose} aria-label="Back to inventory">
          <FiArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back</span>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-extrabold sm:text-xl">Add products</h1>
          <p className="truncate text-[11px] text-white/75 sm:text-xs">
            {storeName ? `🏪 ${storeName} · ` : ''}No scanner needed<span className="hidden sm:inline">: a name and a price is enough</span>
          </p>
        </div>
        {addedThisVisit.length > 0 && (
          <span className="ap-added" aria-live="polite"><FiCheck className="mr-1 inline h-3.5 w-3.5" />{addedThisVisit.length} added</span>
        )}
      </header>

      <div className="ap-modes flex flex-none px-2 sm:px-4" role="tablist" aria-label="How do you want to add products?">
        <button type="button" role="tab" className="ap-mode" aria-selected={mode === 'single'} onClick={() => setMode('single')}>
          <FiPackage className="h-4 w-4" /> One product
        </button>
        <button type="button" role="tab" className="ap-mode" aria-selected={mode === 'quick'} onClick={() => setMode('quick')}>
          <FiList className="h-4 w-4" /> Quick list <span className="hidden text-xs font-normal sm:inline">(many at once)</span>
        </button>
      </div>

      {mode === 'single' ? (
        <>
          <main className="min-h-0 flex-1 overflow-y-auto" onKeyDown={handleEnter}>
            <div className="mx-auto grid max-w-5xl gap-4 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
              <div className="space-y-4">
                {/* 1. What is it */}
                <section className="ap-card">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <button type="button" className="ap-photo" onClick={onPickPhoto} aria-label={photoPreview ? 'Change photo' : 'Add photo'}>
                      {photoPreview ? (
                        <img src={photoPreview} alt="Product" className="h-full w-full object-cover" />
                      ) : (
                        <>
                          <FiImage className="h-5 w-5" />
                          <span>Photo</span>
                        </>
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <label htmlFor="ap-name" className="ap-label">What are you selling? *</label>
                      <input
                        id="ap-name"
                        ref={nameRef}
                        type="text"
                        className="ap-input"
                        autoFocus={typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: fine)').matches)}
                        autoComplete="off"
                        placeholder="e.g. Rice - 1kg"
                        value={product.name}
                        onChange={(e) => { setProduct((previous) => ({ ...previous, name: e.target.value })); clearError('name'); }}
                        onBlur={applyNameBlur}
                        aria-required="true"
                        aria-invalid={errors.name ? 'true' : undefined}
                      />
                      {errors.name && <p role="alert" className="ap-error">{errors.name}</p>}
                    </div>
                  </div>

                  {sameProduct && (
                    <div className="ap-notice ap-notice-warn" role="status">
                      <FiAlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                      <span>
                        <b>{sameProduct.product.name}</b> is already in your shop ({money(sameProduct.product.selling_price)}
                        {sameProduct.product.current_stock != null ? `, ${sameProduct.product.current_stock} in stock` : ''}).
                        Saving will add a second copy. To change the stock or price, edit the existing one instead.
                      </span>
                    </div>
                  )}
                  {!sameProduct && matches.length > 0 && (
                    <div className="ap-notice ap-notice-info" role="status">
                      <FiPackage className="mt-0.5 h-4 w-4 flex-none" />
                      <span>Already listed: {matches.map((match) => match.product.name).join(', ')}</span>
                    </div>
                  )}

                  <div className="mt-4">
                    <label htmlFor="ap-category" className="ap-label">Category <span className="font-normal" style={{ color: 'var(--ap-muted)' }}>(optional)</span></label>
                    <select
                      id="ap-category"
                      className="ap-input"
                      value={product.category_id || ''}
                      onChange={(e) => { setProduct((previous) => ({ ...previous, category_id: e.target.value || null })); setCategoryFromName(false); }}
                    >
                      <option value="">No category</option>
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                    {categoryFromName && chosenCategory && suggestedCategoryId === product.category_id && (
                      <p className="ap-hint">💡 Picked <b>{chosenCategory.name}</b> from the name. Change it if that is wrong.</p>
                    )}
                    {!product.category_id && suggestedCategory && (
                      <button
                        type="button"
                        className="ap-chip mt-2"
                        onClick={() => { setProduct((previous) => ({ ...previous, category_id: suggestedCategory.id })); setCategoryFromName(true); }}
                      >
                        💡 Use {suggestedCategory.name}?
                      </button>
                    )}
                  </div>
                </section>

                {/* 2. Price */}
                <section className="ap-card">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="ap-price" className="ap-label">Selling price *</label>
                      <div className="relative">
                        <span className="ap-prefix">UGX</span>
                        <input
                          id="ap-price"
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="100"
                          className="ap-input ap-big"
                          placeholder="0"
                          value={product.selling_price || ''}
                          onChange={(e) => { setProduct((previous) => ({ ...previous, ...withSellingPrice(previous, e.target.value) })); clearError('selling_price'); }}
                          aria-required="true"
                          aria-invalid={errors.selling_price ? 'true' : undefined}
                        />
                      </div>
                      {errors.selling_price
                        ? <p role="alert" className="ap-error">{errors.selling_price}</p>
                        : <p className="ap-hint">What your customer pays</p>}
                    </div>
                    <div>
                      <label htmlFor="ap-cost" className="ap-label">Cost price <span className="font-normal" style={{ color: 'var(--ap-muted)' }}>(optional)</span></label>
                      <div className="relative">
                        <span className="ap-prefix">UGX</span>
                        <input
                          id="ap-cost"
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="100"
                          className="ap-input ap-big"
                          placeholder="0"
                          value={product.cost_price || ''}
                          onChange={(e) => setProduct((previous) => ({ ...previous, cost_price: Math.max(0, parseFloat(e.target.value) || 0) }))}
                        />
                      </div>
                      <p className="ap-hint">What you paid. Lets us show your profit</p>
                    </div>
                  </div>

                  {cost > 0 && (
                    <div className="mt-3">
                      <p className="ap-label">Set the price from your profit</p>
                      <div className="flex flex-wrap gap-2">
                        {MARGIN_CHIPS.map((percent) => (
                          <button
                            key={percent}
                            type="button"
                            className="ap-chip"
                            onClick={() => { setProduct((previous) => ({ ...previous, ...withSellingPrice(previous, priceFromMargin(previous.cost_price, percent)) })); clearError('selling_price'); }}
                          >
                            +{percent}% → {money(priceFromMargin(cost, percent))}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {cost > 0 && selling > 0 && (
                    <div className={`ap-notice ${selling > cost ? 'ap-notice-good' : 'ap-notice-warn'}`} role="status">
                      <span>
                        {selling > cost
                          ? <>You make <b>{money(selling - cost)}</b> on each one (<b>{margin.toFixed(1)}%</b> profit).</>
                          : <>You would {selling === cost ? 'make nothing' : `lose ${money(cost - selling)}`} on each one. Check the prices.</>}
                      </span>
                    </div>
                  )}
                </section>

                {/* 3. Stock */}
                <section className="ap-card">
                  <label htmlFor="ap-stock" className="ap-label">How many do you have right now?</label>
                  <div className="flex items-stretch gap-2">
                    <button type="button" className="ap-step" onClick={() => setStockNumber(stockNumber - 1)} aria-label="One less"><FiMinus className="h-4 w-4" /></button>
                    <input
                      id="ap-stock"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      className="ap-input text-center"
                      style={{ maxWidth: '8rem', fontWeight: 800, fontSize: '1.2rem' }}
                      placeholder="0"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                    />
                    <button type="button" className="ap-step" onClick={() => setStockNumber(stockNumber + 1)} aria-label="One more"><FiPlus className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {STOCK_CHIPS.map((count) => (
                      <button key={count} type="button" className="ap-chip" onClick={() => setStockNumber(count)}>{count}</button>
                    ))}
                  </div>
                  <p className="ap-hint">Not sure yet? Leave it empty and add stock later from the product list.</p>
                </section>

                {/* Everything else, folded away */}
                <Fold
                  icon="🏷️"
                  title="Barcode (optional)"
                  subtitle="No scanner? Leave it empty and we make a barcode for you"
                  badge={product.barcode ? 'Set' : null}
                  openWhen={Boolean(product.barcode) && (barcodeLocked || registering)}
                >
                  <div className="mt-3" data-no-enter-save>
                    <label htmlFor="ap-barcode" className="ap-label"><FiHash className="mr-1 inline" />Barcode {barcodeLocked ? '(locked from scan)' : ''}</label>
                    <div className="flex gap-2">
                      <input
                        id="ap-barcode"
                        type="text"
                        className="ap-input min-w-0 flex-1"
                        placeholder="e.g. 1234567890123"
                        value={product.barcode}
                        disabled={barcodeLocked}
                        onChange={(e) => setProduct((previous) => ({ ...previous, barcode: e.target.value }))}
                      />
                      <button type="button" className="ap-chip" onClick={onScan} disabled={barcodeLocked} title="Scan with the camera or a barcode gun">
                        <FiCamera className="h-4 w-4" /> Scan
                      </button>
                      <button type="button" className="ap-chip" onClick={onGenerateBarcode} disabled={barcodeLocked || registering} title="Make a barcode, then print it from Barcodes">
                        <FiZap className="h-4 w-4" /> Make one
                      </button>
                    </div>
                  </div>
                </Fold>

                <Fold icon="🧾" title="Tax and product code" subtitle={`Tax ${product.tax_rate}% · code made for you if empty`}>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="ap-tax" className="ap-label">Tax rate (%)</label>
                      <input
                        id="ap-tax"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        step="1"
                        className="ap-input"
                        value={product.tax_rate}
                        onChange={(e) => setProduct((previous) => ({ ...previous, tax_rate: Math.max(0, parseFloat(e.target.value) || 0) }))}
                      />
                    </div>
                    <div>
                      <label htmlFor="ap-sku" className="ap-label">SKU / product code</label>
                      <input
                        id="ap-sku"
                        type="text"
                        className="ap-input"
                        placeholder="e.g. RICE-1KG"
                        value={product.sku}
                        onChange={(e) => setProduct((previous) => ({ ...previous, sku: e.target.value }))}
                      />
                    </div>
                  </div>
                </Fold>

                <Fold
                  icon="📦"
                  title="Wholesale or bulk price"
                  subtitle="A lower price for people who buy a lot"
                  badge={Number(product.wholesale_price) > 0 ? money(product.wholesale_price) : null}
                  openWhen={offersWholesale}
                >
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="ap-wholesale" className="ap-label">Wholesale price</label>
                      <input
                        id="ap-wholesale"
                        type="number"
                        inputMode="numeric"
                        min="0"
                        step="100"
                        className="ap-input"
                        placeholder="Optional"
                        value={product.wholesale_price || ''}
                        onChange={(e) => setProduct((previous) => ({ ...previous, ...withWholesalePrice(previous, e.target.value) }))}
                      />
                    </div>
                    <div>
                      <label htmlFor="ap-wholesale-percent" className="ap-label">Discount (%)</label>
                      <input
                        id="ap-wholesale-percent"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        step="1"
                        className="ap-input"
                        placeholder="e.g. 10"
                        value={product.wholesale_discount_percent || ''}
                        onChange={(e) => setProduct((previous) => ({ ...previous, ...withDiscountPercent(previous, e.target.value) }))}
                      />
                    </div>
                  </div>
                  <p className="ap-hint">Type the price and the discount fills in, or type the discount and the price fills in.</p>
                </Fold>

                <Fold
                  icon="🍓"
                  title="Flavors or sizes"
                  subtitle="Same product in different flavors, each sold on its own"
                  badge={flavorRows.length > 0 ? `${flavorRows.length}` : null}
                  openWhen={flavorRows.length > 0}
                >
                  <div className="mt-3">
                    <ProductFlavorsEditor
                      rows={flavorRows}
                      onRowsChange={setFlavorRows}
                      sharedName={flavorSharedName ?? product.name}
                      onSharedNameChange={setFlavorSharedName}
                      mainBarcode={product.barcode}
                      products={products}
                      basePrice={product.selling_price}
                      generateBarcode={generateBarcode}
                      startOpen
                    />
                  </div>
                </Fold>
              </div>

              {/* Side: how it will look + what was added */}
              <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
                <div className="ap-prev hidden lg:block" aria-label="Preview">
                  <div className="ap-prev-img">
                    {photoPreview ? <img src={photoPreview} alt="" className="h-full w-full object-cover" /> : avatarLetter}
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--ap-muted)' }}>How it shows at the till</p>
                    <p className="truncate font-bold">{product.name.trim() || 'Product name'}</p>
                    <p className="text-lg font-extrabold" style={{ color: 'var(--ap-green)' }}>{selling > 0 ? money(selling) : 'UGX 0'}</p>
                    <p className="text-xs" style={{ color: 'var(--ap-muted)' }}>
                      {stockNumber > 0 ? `${stockNumber} in stock` : 'Stock not set'}
                      {chosenCategory ? ` · ${chosenCategory.name}` : ''}
                    </p>
                  </div>
                </div>

                {addedThisVisit.length > 0 && (
                  <div className="ap-card">
                    <p className="ap-label">Added this visit</p>
                    <ul className="space-y-1.5 text-sm">
                      {addedThisVisit.slice(-6).reverse().map((added) => (
                        <li key={added.key} className="flex items-center gap-2">
                          <FiCheck className="h-4 w-4 flex-none" style={{ color: 'var(--ap-green)' }} />
                          <span className="min-w-0 flex-1 truncate">{added.name}</span>
                          <span className="flex-none text-xs" style={{ color: 'var(--ap-muted)' }}>{money(added.price)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </aside>
            </div>
          </main>

          <footer className="ap-foot flex flex-none items-center justify-end gap-2">
            <p className="mr-auto hidden text-xs md:block" style={{ color: 'var(--ap-muted)' }}>Tip: press Enter to save and start the next one</p>
            <button type="button" className="ap-btn ap-btn-ghost" onClick={requestClose}>
              {addedThisVisit.length > 0 ? 'Done' : 'Cancel'}
            </button>
            <button type="button" className="ap-btn ap-btn-second" onClick={() => onSave(true)} disabled={busy}>
              <FiPlus className="h-4 w-4" /> <span className="sm:hidden">Add another</span><span className="hidden sm:inline">Save &amp; add another</span>
            </button>
            <button type="button" className="ap-btn ap-btn-primary flex-1 sm:flex-none" onClick={() => onSave(false)} disabled={busy}>
              <FiCheck className="h-4 w-4" /> <span>{registering ? 'Registering…' : saving ? 'Saving…' : <>Save<span className="hidden sm:inline"> product</span></>}</span>
            </button>
          </footer>
        </>
      ) : (
        <>
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-5">
              <section className="ap-card">
                <p className="text-sm font-bold">Type your products, one per line</p>
                <p className="ap-hint">Name and price are all you need; cost lets us show your profit. Press Enter to move along; a new line appears at the end. Barcodes are made for you.</p>
                <div className="mt-3">
                  <label htmlFor="ap-quick-category" className="ap-label">Category for all of these <span className="font-normal" style={{ color: 'var(--ap-muted)' }}>(optional)</span></label>
                  <select id="ap-quick-category" className="ap-input" value={quickCategory} onChange={(e) => setQuickCategory(e.target.value)}>
                    <option value="">No category</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </div>
              </section>

              <section className="ap-card" ref={gridRef}>
                <div className="ap-row ap-row-head mb-2" aria-hidden="true">
                  <span>Product name</span><span>Price (UGX)</span><span>Cost (UGX)</span><span>In stock</span><span />
                </div>
                <div className="space-y-2">
                  {rows.map((row) => {
                    const issue = allIssues[row.id];
                    const showIssue = issue && (showQuickErrors || quickIssues[row.id] || issue === 'Already in your shop' || issue === 'Listed twice here');
                    return (
                      <div key={row.id} className="ap-row-card">
                        <div className="ap-row">
                          <input
                            data-cell={`${row.id}-name`}
                            className="ap-input ap-cellinput"
                            placeholder="e.g. Sugar - 1kg"
                            value={row.name}
                            autoComplete="off"
                            aria-label="Product name"
                            aria-invalid={showIssue ? 'true' : undefined}
                            onChange={(e) => updateRow(row.id, { name: e.target.value })}
                            onKeyDown={(e) => handleCellKey(e, row, 'name')}
                          />
                          <input
                            data-cell={`${row.id}-price`}
                            className="ap-input ap-cellinput"
                            type="number"
                            inputMode="numeric"
                            min="0"
                            step="100"
                            placeholder="Price"
                            value={row.price}
                            aria-label="Selling price"
                            onChange={(e) => updateRow(row.id, { price: e.target.value })}
                            onKeyDown={(e) => handleCellKey(e, row, 'price')}
                          />
                          <input
                            data-cell={`${row.id}-cost`}
                            className="ap-input ap-cellinput"
                            type="number"
                            inputMode="numeric"
                            min="0"
                            step="100"
                            placeholder="Cost"
                            value={row.cost}
                            aria-label="Cost price (optional)"
                            onChange={(e) => updateRow(row.id, { cost: e.target.value })}
                            onKeyDown={(e) => handleCellKey(e, row, 'cost')}
                          />
                          <input
                            data-cell={`${row.id}-stock`}
                            className="ap-input ap-cellinput"
                            type="number"
                            inputMode="numeric"
                            min="0"
                            step="1"
                            placeholder="Stock"
                            value={row.stock}
                            aria-label="Number in stock"
                            onChange={(e) => updateRow(row.id, { stock: e.target.value })}
                            onKeyDown={(e) => handleCellKey(e, row, 'stock')}
                          />
                          <button type="button" className="ap-del" onClick={() => removeRow(row.id)} aria-label="Remove this line" disabled={rows.length === 1}>
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {showIssue && <p role="alert" className="ap-error">{issue}</p>}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="ap-chip" onClick={() => { const [fresh] = addRows(1); focusCell(fresh.id, 'name'); }}>
                    <FiPlus className="h-4 w-4" /> Add a line
                  </button>
                  <button type="button" className="ap-chip" onClick={() => addRows(5)}>
                    <FiPlus className="h-4 w-4" /> Add 5 lines
                  </button>
                </div>
              </section>
            </div>
          </main>

          <footer className="ap-foot flex flex-none flex-wrap items-center justify-end gap-2">
            <p className="w-full text-xs sm:mr-auto sm:w-auto" style={{ color: quickProblemCount > 0 && showQuickErrors ? 'var(--ap-red)' : 'var(--ap-muted)' }} aria-live="polite">
              {quickProblemCount > 0 && showQuickErrors
                ? `Fix ${quickProblemCount} line${quickProblemCount === 1 ? '' : 's'} marked in red`
                : quickCount > 0 ? `${quickCount} product${quickCount === 1 ? '' : 's'} ready` : 'Fill in a name and price to begin'}
            </p>
            <button type="button" className="ap-btn ap-btn-ghost" onClick={requestClose}>
              {addedThisVisit.length > 0 ? 'Done' : 'Cancel'}
            </button>
            <button type="button" className="ap-btn ap-btn-primary flex-1 sm:flex-none" onClick={saveQuick} disabled={quickSaving || (quickCount === 0 && quickProblemCount === 0)}>
              <FiCheck className="h-4 w-4" />
              <span>{quickSaving ? 'Saving…' : quickCount > 0 ? `Save ${quickCount} product${quickCount === 1 ? '' : 's'}` : 'Save products'}</span>
            </button>
          </footer>
        </>
      )}
    </div>
  );
};

export default AddProductPage;
