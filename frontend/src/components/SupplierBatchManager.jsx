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

export default function SupplierBatchManager({ item, batches, onClose, onChanged }) {
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
    quantity: parseInt(fields.quantity, 10) || 0,
    expiry_date: fields.expiry_date,
    discount_mode: fields.discount_mode,
    discount_percent: fields.discount_mode === 'manual' ? Number(fields.discount_percent) : null,
  });

  const addBatch = async (event) => {
    event.preventDefault();
    const problem = validate(draft);
    if (problem) { toast.error(problem); return; }
    setBusy('new');
    const { error } = await supabase.from('supplier_catalog_batches')
      .insert({ catalog_item_id: item.id, ...payloadFrom(draft) });
    setBusy(null);
    if (error) {
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
    const { error } = await supabase.from('supplier_catalog_batches')
      .update(payloadFrom({ ...merged, quantity: String(merged.quantity ?? '') }))
      .eq('id', batch.id);
    setBusy(null);
    if (error) { fail(error, 'Could not save the batch'); return; }
    toast.success(`Batch ${merged.batch_number} updated`);
    setEdits((prev) => { const next = { ...prev }; delete next[batch.id]; return next; });
    onChanged();
  };

  const removeBatch = async (batch) => {
    if (!window.confirm(`Remove batch ${batch.batch_number}?`)) return;
    setBusy(batch.id);
    const { error } = await supabase.from('supplier_catalog_batches').delete().eq('id', batch.id);
    setBusy(null);
    if (error) { fail(error, 'Could not remove the batch'); return; }
    toast.success('Batch removed');
    onChanged();
  };

  const discountFields = (value, onChange) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        value={value.discount_mode}
        onChange={(e) => onChange({ discount_mode: e.target.value })}
        className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs"
        aria-label="Discount mode"
      >
        <option value="auto">Auto discount</option>
        <option value="manual">Fixed %</option>
        <option value="none">No discount</option>
      </select>
      {value.discount_mode === 'manual' && (
        <input
          type="number" min="1" max="90" step="1" inputMode="numeric"
          value={value.discount_percent ?? ''}
          onChange={(e) => onChange({ discount_percent: e.target.value })}
          placeholder="% off"
          aria-label="Discount percent"
          className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-xs"
        />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={`Batches for ${item.name}`}>
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-800 truncate">Batches · {item.name}</h3>
            <p className="text-xs text-gray-500">
              Update a batch's expiry date any time. Near-expiry batches are flagged and discounted automatically for supermarkets.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1" aria-label="Close">×</button>
        </div>

        <div className="p-4 space-y-4">
          <details className="rounded-xl bg-purple-50 px-3 py-2 text-xs text-purple-900">
            <summary className="cursor-pointer font-semibold">How auto discount works</summary>
            <ul className="mt-1.5 space-y-0.5">
              {[...AUTO_DISCOUNT_SCHEDULE].reverse().map((tier) => (
                <li key={tier.withinDays}>Within {tier.withinDays} days of expiry → <b>{tier.percent}% off</b></li>
              ))}
              <li>Expired batches are never offered to buyers.</li>
            </ul>
            <p className="mt-1">It recalculates every day, so you never have to re-publish a price.</p>
          </details>

          {rows.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-4">No batches yet — add the first one below.</p>
          ) : (
            <ul className="space-y-3">
              {rows.map(({ batch, status, expired, percent }) => {
                const dirty = Boolean(edits[batch.id]);
                const saving = busy === batch.id;
                return (
                  <li key={batch.id} className={`rounded-xl border p-3 ${expired ? 'border-red-200 bg-red-50/40' : 'border-gray-100'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-gray-800">Batch {batch.batch_number}</p>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${PILL[status.key]}`}>{status.label}</span>
                        {percent > 0 && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700">−{percent}% today</span>}
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <label className="text-[11px] text-gray-500">Expiry date
                        <input
                          type="date"
                          value={batch.expiry_date ? String(batch.expiry_date).slice(0, 10) : ''}
                          onChange={(e) => edit(batch.id, { expiry_date: e.target.value })}
                          className="mt-0.5 w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-800"
                        />
                      </label>
                      <label className="text-[11px] text-gray-500">Quantity
                        <input
                          type="number" min="0" step="1" inputMode="numeric"
                          value={batch.quantity ?? ''}
                          onChange={(e) => edit(batch.id, { quantity: e.target.value })}
                          className="mt-0.5 w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-800"
                        />
                      </label>
                      <div className="col-span-2 sm:col-span-1 text-[11px] text-gray-500">Discount
                        <div className="mt-0.5">{discountFields(batch, (patch) => edit(batch.id, patch))}</div>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-gray-500">
                        {expired
                          ? 'Expired — hidden from buyers. Change the date if it was entered wrong.'
                          : base > 0 && percent > 0
                            ? <>Buyers pay <b className="text-purple-700">{fmtUGX(priceAfterDiscount(base, percent))}</b> <span className="line-through">{fmtUGX(base)}</span></>
                            : `Expires ${formatExpiryDate(batch.expiry_date)}`}
                      </span>
                      <span className="flex items-center gap-2">
                        {dirty && (
                          <button onClick={() => saveBatch(batches.find((b) => b.id === batch.id))} disabled={saving}
                            className="px-3 py-1.5 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 disabled:opacity-50">
                            {saving ? 'Saving…' : 'Save changes'}
                          </button>
                        )}
                        <button onClick={() => removeBatch(batch)} disabled={saving} className="text-gray-400 hover:text-red-500 disabled:opacity-50">Remove</button>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <form onSubmit={addBatch} className="rounded-xl border border-dashed border-gray-300 p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Add a batch</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <input
                placeholder="Batch no. *" value={draft.batch_number}
                onChange={(e) => setDraft((d) => ({ ...d, batch_number: e.target.value }))}
                className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
              />
              <input
                type="number" min="0" step="1" inputMode="numeric" placeholder={`Quantity (${item.unit || 'units'}) *`} value={draft.quantity}
                onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
                className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
              />
              <input
                type="date" min={todayIso()} value={draft.expiry_date} aria-label="Expiry date"
                onChange={(e) => setDraft((d) => ({ ...d, expiry_date: e.target.value }))}
                className="col-span-2 sm:col-span-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {discountFields(draft, (patch) => setDraft((d) => ({ ...d, ...patch })))}
              <button type="submit" disabled={busy === 'new'}
                className="px-4 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50">
                {busy === 'new' ? 'Adding…' : 'Add batch'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
