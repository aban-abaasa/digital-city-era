// Batch & expiry manager for one supplier catalog item.
// The supplier can add batches, change a batch's expiry date whenever it
// changes, and choose how the batch is discounted as it nears expiry:
//   Auto   – worked out from the days left, every day (nothing to re-publish)
//   Manual – a fixed percentage the supplier pins
//   None   – never discounted
import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../services/supabase';
import { priceAfterDiscount } from '../utils/productExpiry';
import {
  AUTO_DISCOUNT_SCHEDULE,
  describeBatch,
  formatExpiryDate,
  isMissingBatchTable,
} from '../utils/supplierBatchExpiry';
import { useBackLayer } from '../hooks/useBackLayer';
import { createOfflineUuid, getCachedIdentity, isNetworkFailure, loadPortalSnapshot, savePortalSnapshot } from '../services/posOfflineCache';
import { enqueuePortalMutation } from '../services/portalOfflineQueue';

const fmtUGX = (n) => 'UGX ' + Number(n || 0).toLocaleString();

const PILL = {
  expired: 'bg-red-100 text-red-700',
  critical: 'bg-orange-100 text-orange-700',
  soon: 'bg-amber-100 text-amber-700',
  ok: 'bg-emerald-100 text-emerald-700',
  none: 'bg-slate-100 text-slate-600',
};

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const emptyDraft = () => ({ batch_number: '', quantity: '', expiry_date: '', discount_mode: 'auto', discount_percent: '' });

export default function SupplierBatchManager({ item, batches, cacheUserId, onClose, onChanged }) {
  useBackLayer(true, onClose);
  const [draft, setDraft] = useState(emptyDraft);
  const [edits, setEdits] = useState({}); // batchId -> partial fields being edited
  const [busy, setBusy] = useState(null);

  const base = Number(item.price_per_unit) || 0;
  const rows = useMemo(
    () => [...batches]
      .map((batch) => describeBatch({ ...batch, ...(edits[batch.id] || {}) }))
      .sort((a, b) => (a.status.days ?? 1e9) - (b.status.days ?? 1e9)),
    [batches, edits]
  );

  const fail = (error, fallback) => {
    toast.error(isMissingBatchTable(error)
      ? 'Batches are not set up yet — run ADD_SUPPLIER_CATALOG_BATCH_EXPIRY.sql in Supabase.'
      : (error?.message || fallback));
  };

  const validate = (fields) => {
    if (!fields.batch_number?.trim()) return 'Enter a batch number';
    if (!fields.expiry_date) return 'Pick an expiry date';
    if (!(Number(fields.quantity) >= 0) || fields.quantity === '') return 'Enter the quantity in this batch';
    if (fields.discount_mode === 'manual') {
      const pct = Number(fields.discount_percent);
      if (!Number.isFinite(pct) || pct < 1 || pct > 90) return 'Manual discount must be between 1% and 90%';
    }
    return null;
  };

  const payloadFrom = (fields) => ({
    batch_number: fields.batch_number.trim(),
    quantity: Math.round((Number(fields.quantity) || 0) * 1000) / 1000,
    expiry_date: fields.expiry_date,
    discount_mode: fields.discount_mode,
    discount_percent: fields.discount_mode === 'manual' ? Number(fields.discount_percent) : null,
  });

  const queueBatchMutation = async (kind, batch) => {
    const identity = getCachedIdentity();
    const userId = cacheUserId || identity?.userId;
    if (!userId || identity?.userId !== userId) throw new Error('Sign in online before saving batch changes offline.');
    await enqueuePortalMutation(kind, userId, { itemId: item.id, batch });
    const cached = await loadPortalSnapshot('supplier', userId, 'supplier-catalog-batches');
    const current = cached?.value || [];
    const next = kind === 'supplier-catalog-batch-delete'
      ? current.filter((entry) => entry.id !== batch.id)
      : [batch, ...current.filter((entry) => entry.id !== batch.id)];
    await savePortalSnapshot('supplier', userId, 'supplier-catalog-batches', next);
    onChanged();
  };

  const addBatch = async (event) => {
    event.preventDefault();
    const problem = validate(draft);
    if (problem) { toast.error(problem); return; }
    setBusy('new');
    const id = createOfflineUuid();
    const batchPayload = { ...(id ? { id } : {}), catalog_item_id: item.id, ...payloadFrom(draft) };
    if (!navigator.onLine) {
      try {
        if (!id) throw new Error('This browser cannot safely create an offline batch ID.');
        await queueBatchMutation('supplier-catalog-batch-save', batchPayload);
        toast.info(`Batch ${draft.batch_number.trim()} saved offline. It will sync when connected.`);
        setDraft(emptyDraft());
      } catch (error) { fail(error, 'Could not save the batch offline'); }
      setBusy(null);
      return;
    }
    const { error } = await supabase.from('supplier_catalog_batches').insert(batchPayload);
    setBusy(null);
    if (error) {
      if (isNetworkFailure(error) && id) {
        try {
          await queueBatchMutation('supplier-catalog-batch-save', batchPayload);
          toast.info(`Connection dropped. Batch ${draft.batch_number.trim()} is saved and will sync.`);
          setDraft(emptyDraft());
          return;
        } catch (queueError) { fail(queueError, 'Could not save the batch offline'); return; }
      }
      if (error.code === '23505') toast.error('This item already has a batch with that number');
      else fail(error, 'Could not add the batch');
      return;
    }
    toast.success(`Batch ${draft.batch_number.trim()} added`);
    setDraft(emptyDraft());
    onChanged();
  };

  const edit = (id, patch) => setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));

  const saveBatch = async (batch) => {
    const merged = { ...batch, ...(edits[batch.id] || {}) };
    const problem = validate({ ...merged, quantity: String(merged.quantity ?? '') });
    if (problem) { toast.error(problem); return; }
    setBusy(batch.id);
    const batchPayload = { ...batch, ...payloadFrom({ ...merged, quantity: String(merged.quantity ?? '') }) };
    if (!navigator.onLine) {
      try {
        await queueBatchMutation('supplier-catalog-batch-save', batchPayload);
        toast.info(`Batch ${merged.batch_number} saved offline. It will sync when connected.`);
        setEdits((prev) => { const next = { ...prev }; delete next[batch.id]; return next; });
      } catch (error) { fail(error, 'Could not save the batch offline'); }
      setBusy(null);
      return;
    }
    const { error } = await supabase.from('supplier_catalog_batches')
      .update(payloadFrom({ ...merged, quantity: String(merged.quantity ?? '') }))
      .eq('id', batch.id);
    setBusy(null);
    if (error) {
      if (isNetworkFailure(error)) {
        try {
          await queueBatchMutation('supplier-catalog-batch-save', batchPayload);
          toast.info(`Connection dropped. Batch ${merged.batch_number} is saved and will sync.`);
          setEdits((prev) => { const next = { ...prev }; delete next[batch.id]; return next; });
          return;
        } catch (queueError) { fail(queueError, 'Could not save the batch offline'); return; }
      }
      fail(error, 'Could not save the batch');
      return;
    }
    toast.success(`Batch ${merged.batch_number} updated`);
    setEdits((prev) => { const next = { ...prev }; delete next[batch.id]; return next; });
    onChanged();
  };

  const removeBatch = async (batch) => {
    if (!window.confirm(`Remove batch ${batch.batch_number}?`)) return;
    setBusy(batch.id);
    if (!navigator.onLine) {
      try {
        await queueBatchMutation('supplier-catalog-batch-delete', batch);
        toast.info(`Batch ${batch.batch_number} removal saved offline. It will sync when connected.`);
      } catch (error) { fail(error, 'Could not remove the batch offline'); }
      setBusy(null);
      return;
    }
    const { error } = await supabase.from('supplier_catalog_batches').delete().eq('id', batch.id);
    setBusy(null);
    if (error) {
      if (isNetworkFailure(error)) {
        try {
          await queueBatchMutation('supplier-catalog-batch-delete', batch);
          toast.info(`Connection dropped. Batch ${batch.batch_number} removal is saved and will sync.`);
          return;
        } catch (queueError) { fail(queueError, 'Could not remove the batch offline'); return; }
      }
      fail(error, 'Could not remove the batch');
      return;
    }
    toast.success('Batch removed');
    onChanged();
  };

  const discountFields = (value, onChange) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="supplier-batch-field">
        <span>Discount rule</span>
        <select
          value={value.discount_mode}
          onChange={(e) => onChange({ discount_mode: e.target.value })}
          aria-label="Discount mode"
          className="supplier-batch-input"
        >
          <option value="auto">Automatic near expiry</option>
          <option value="manual">Fixed percentage</option>
          <option value="none">No discount</option>
        </select>
      </label>
      {value.discount_mode === 'manual' && (
        <label className="supplier-batch-field">
          <span>Fixed discount (%)</span>
          <input
            type="number" min="1" max="90" step="1" inputMode="numeric"
            value={value.discount_percent ?? ''}
            onChange={(e) => onChange({ discount_percent: e.target.value })}
            placeholder="1 to 90"
            aria-label="Discount percent"
            className="supplier-batch-input"
          />
        </label>
      )}
    </div>
  );

  return (
    <div className="supplier-batch-screen" role="dialog" aria-modal="true" aria-label={`Batches for ${item.name}`}>
      <header className="supplier-batch-header">
        <div className="supplier-batch-header-inner">
          <div className="min-w-0">
            <p className="supplier-batch-eyebrow">Supply catalog</p>
            <h2 className="supplier-batch-title">Batches for {item.name}</h2>
            <p className="supplier-batch-subtitle">Track stock by lot, update expiry dates, and manage buyer discounts.</p>
          </div>
          <button type="button" onClick={onClose} className="supplier-batch-close">
            <span aria-hidden="true">×</span><span>Close</span>
          </button>
        </div>
      </header>

      <main className="supplier-batch-scroll">
        <div className="supplier-batch-content">
          <details className="supplier-batch-help">
            <summary>How automatic discounts work</summary>
            <p>Automatic discounts change each day as a batch approaches expiry. You do not need to update the catalog price.</p>
            <ul>
              {[...AUTO_DISCOUNT_SCHEDULE].reverse().map((tier) => (
                <li key={tier.withinDays}>Within {tier.withinDays} days of expiry: <b>{tier.percent}% off</b></li>
              ))}
              <li>Expired batches are hidden from buyers.</li>
            </ul>
          </details>

          <form onSubmit={addBatch} className="supplier-batch-panel supplier-batch-add-form">
            <div className="supplier-batch-section-heading">
              <div>
                <h3>Add a batch</h3>
                <p>Enter the lot number, quantity on hand, and expiry date.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="supplier-batch-field">
                <span>Batch number <b>*</b></span>
                <input
                  required value={draft.batch_number}
                  onChange={(e) => setDraft((d) => ({ ...d, batch_number: e.target.value }))}
                  placeholder="For example, LOT-24A"
                  className="supplier-batch-input"
                />
              </label>
              <label className="supplier-batch-field">
                <span>Quantity ({item.unit || 'units'}) <b>*</b></span>
                <input
                  type="number" min="0" step="any" inputMode="decimal" required value={draft.quantity}
                  onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
                  placeholder="Enter quantity"
                  className="supplier-batch-input"
                />
              </label>
              <label className="supplier-batch-field sm:col-span-2">
                <span>Expiry date <b>*</b></span>
                <input
                  type="date" min={todayIso()} required value={draft.expiry_date}
                  onChange={(e) => setDraft((d) => ({ ...d, expiry_date: e.target.value }))}
                  className="supplier-batch-input sm:max-w-sm"
                />
              </label>
            </div>
            <div className="supplier-batch-discount-section">
              {discountFields(draft, (patch) => setDraft((d) => ({ ...d, ...patch })))}
            </div>
            <div className="supplier-batch-form-actions">
              <button type="submit" disabled={busy === 'new'} className="supplier-batch-primary-button">
                {busy === 'new' ? 'Adding batch…' : 'Add batch'}
              </button>
            </div>
          </form>

          <section className="supplier-batch-existing">
            <div className="supplier-batch-section-heading">
              <div>
                <h3>Current batches <span>{rows.length}</span></h3>
                <p>Edit a batch below to correct its quantity, expiry date, or discount rule.</p>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="supplier-batch-empty">
                <p>No batches yet</p>
                <span>Add the first batch using the form above.</span>
              </div>
            ) : (
              <ul className="supplier-batch-list">
                {rows.map(({ batch, status, expired, percent }) => {
                  const dirty = Boolean(edits[batch.id]);
                  const saving = busy === batch.id;
                  return (
                    <li key={batch.id} className={`supplier-batch-card ${expired ? 'is-expired' : ''}`}>
                      <div className="supplier-batch-card-heading">
                        <div>
                          <h4>Batch {batch.batch_number}</h4>
                          <p>{expired ? 'Expired batches are hidden from buyers.' : `Expires ${formatExpiryDate(batch.expiry_date)}`}</p>
                        </div>
                        <div className="supplier-batch-statuses">
                          <span className={`supplier-batch-status ${PILL[status.key]}`}>{status.label}</span>
                          {percent > 0 && <span className="supplier-batch-discount-badge">{percent}% off today</span>}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="supplier-batch-field">
                          <span>Batch number <b>*</b></span>
                          <input
                            value={batch.batch_number ?? ''}
                            onChange={(e) => edit(batch.id, { batch_number: e.target.value })}
                            className="supplier-batch-input"
                          />
                        </label>
                        <label className="supplier-batch-field">
                          <span>Quantity ({item.unit || 'units'}) <b>*</b></span>
                          <input
                            type="number" min="0" step="any" inputMode="decimal"
                            value={batch.quantity ?? ''}
                            onChange={(e) => edit(batch.id, { quantity: e.target.value })}
                            className="supplier-batch-input"
                          />
                        </label>
                        <label className="supplier-batch-field sm:col-span-2">
                          <span>Expiry date <b>*</b></span>
                          <input
                            type="date" value={batch.expiry_date ? String(batch.expiry_date).slice(0, 10) : ''}
                            onChange={(e) => edit(batch.id, { expiry_date: e.target.value })}
                            className="supplier-batch-input sm:max-w-sm"
                          />
                        </label>
                      </div>

                      <div className="supplier-batch-discount-section">
                        {discountFields(batch, (patch) => edit(batch.id, patch))}
                      </div>
                      {base > 0 && percent > 0 && (
                        <p className="supplier-batch-price-note">
                          Buyer price today: <b>{fmtUGX(priceAfterDiscount(base, percent))}</b> <span>{fmtUGX(base)}</span>
                        </p>
                      )}
                      <div className="supplier-batch-card-actions">
                        <button type="button" onClick={() => removeBatch(batch)} disabled={saving} className="supplier-batch-remove-button">
                          Remove batch
                        </button>
                        <button
                          type="button"
                          onClick={() => saveBatch(batches.find((b) => b.id === batch.id))}
                          disabled={!dirty || saving}
                          className="supplier-batch-primary-button"
                        >
                          {saving ? 'Saving changes…' : 'Save changes'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
