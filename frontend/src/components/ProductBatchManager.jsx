// Batch & expiry manager for one store product (admin portal).
// Each batch has its own expiry date, which the admin can change at any time.
// The product's expiry follows the batch that will be sold first, so that
// batch drives the flags and reduced prices in "Expiring stock · Reduced prices".
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../services/supabase';
import { getExpiryStatus, formatExpiryDate } from '../utils/productExpiry';
import { isMissingBatchSetup } from '../utils/productBatches';

const PILL = {
  expired: 'oi-pill-out',
  critical: 'oi-pill-crit',
  soon: 'oi-pill-low',
  ok: 'oi-pill-ok',
  none: 'oi-pill-ok',
};

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const STATUS_LABEL = { active: 'On sale', depleted: 'Sold out', expired: 'Pulled (expired)', recalled: 'Recalled' };

const ProductBatchManager = ({ product, batches, isAdmin, onClose, onChanged }) => {
  const [dates, setDates] = useState({}); // batchId -> edited expiry date
  const [draft, setDraft] = useState({ batch_number: '', quantity: '', expiry_date: '', add_to_stock: true });
  const [busy, setBusy] = useState(null);

  const exactStock = batches.some((b) => b.exact);

  const fail = (error, fallback) => {
    toast.error(isMissingBatchSetup(error)
      ? 'Batch tracking is not set up yet — run ADD_PRODUCT_BATCH_EXPIRY_TRACKING.sql in Supabase.'
      : (error?.message || fallback));
  };

  const saveDate = async (batch) => {
    if (!isAdmin) { toast.error('❌ Only Admins can change a batch expiry date'); return; }
    const value = dates[batch.id];
    if (!value) return;
    setBusy(batch.id);
    const { error } = await supabase.from('product_inventory_batches').update({ expiry_date: value }).eq('id', batch.id);
    setBusy(null);
    if (error) { fail(error, 'Could not change the expiry date'); return; }
    toast.success(`Batch ${batch.batch_number} now expires ${formatExpiryDate(value)}`);
    setDates((prev) => { const next = { ...prev }; delete next[batch.id]; return next; });
    onChanged(product.id);
  };

  const setStatus = async (batch, status) => {
    if (!isAdmin) { toast.error('❌ Only Admins can change a batch'); return; }
    setBusy(batch.id);
    const { error } = await supabase.from('product_inventory_batches').update({ status }).eq('id', batch.id);
    setBusy(null);
    if (error) { fail(error, 'Could not update the batch'); return; }
    toast.success(status === 'active' ? `Batch ${batch.batch_number} is back on sale` : `Batch ${batch.batch_number} taken off sale`);
    onChanged(product.id);
  };

  const addBatch = async (event) => {
    event.preventDefault();
    if (!isAdmin) { toast.error('❌ Only Admins can add a batch'); return; }
    if (!draft.batch_number.trim()) { toast.error('Enter a batch number'); return; }
    if (draft.quantity === '' || Number(draft.quantity) < 0) { toast.error('Enter the quantity received'); return; }
    if (!draft.expiry_date) { toast.error('Pick an expiry date'); return; }
    setBusy('new');
    const { error } = await supabase.rpc('add_product_batch', {
      p_product_id: product.id,
      p_batch_number: draft.batch_number.trim(),
      p_expiry_date: draft.expiry_date,
      p_quantity: Number(draft.quantity),
      p_add_to_stock: draft.add_to_stock,
    });
    setBusy(null);
    if (error) {
      if (error.code === '23505') toast.error('This product already has a batch with that number');
      else fail(error, 'Could not add the batch');
      return;
    }
    toast.success(`Batch ${draft.batch_number.trim()} added`);
    setDraft({ batch_number: '', quantity: '', expiry_date: '', add_to_stock: true });
    onChanged(product.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={`Batches for ${product.name}`}>
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-800 truncate">Batches · {product.name}</h3>
            <p className="text-xs text-gray-500">
              Track each delivery by batch. The batch sold first sets the product's expiry, which flags it and lets you publish a reduced price.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1" aria-label="Close">×</button>
        </div>

        <div className="p-4 space-y-4">
          {batches.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-4">No batches recorded yet — add the first one below.</p>
          ) : (
            <ul className="space-y-3">
              {batches.map((batch) => {
                const status = getExpiryStatus(batch.expiry_date);
                const edited = dates[batch.id];
                const onSale = batch.status === 'active';
                const saving = busy === batch.id;
                return (
                  <li key={batch.id} className={`rounded-xl border p-3 ${!onSale ? 'border-gray-200 bg-gray-50' : status.key === 'expired' ? 'border-red-200 bg-red-50/40' : 'border-gray-100'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-gray-800">Batch {batch.batch_number}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {onSale && <span className={`${PILL[status.key]} px-2 py-0.5 rounded-full text-[11px] font-bold`}>{status.label}</span>}
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">{STATUS_LABEL[batch.status] || batch.status}</span>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <label className="text-[11px] text-gray-500">Expiry date
                        <input
                          type="date"
                          value={edited ?? String(batch.expiry_date).slice(0, 10)}
                          disabled={!isAdmin}
                          onChange={(e) => setDates((prev) => ({ ...prev, [batch.id]: e.target.value }))}
                          className="mt-0.5 w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-800 disabled:bg-gray-100"
                        />
                      </label>
                      <div className="text-[11px] text-gray-500">{batch.exact ? 'In this batch' : 'Received'}
                        <p className="mt-0.5 py-1.5 text-sm text-gray-800">{Number(batch.batch_stock)}</p>
                      </div>
                      <div className="text-[11px] text-gray-500">{batch.exact ? 'Left to sell' : 'Est. left on shelf'}
                        <p className="mt-0.5 py-1.5 text-sm font-semibold text-gray-800">{Number(batch.remaining)}</p>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-gray-500">
                        {onSale && status.key === 'expired' && Number(batch.remaining) > 0
                          ? 'Expired — pull it from the shelf, then take it off sale.'
                          : `Expires ${formatExpiryDate(batch.expiry_date)}`}
                      </span>
                      <span className="flex items-center gap-2">
                        {edited && edited !== String(batch.expiry_date).slice(0, 10) && (
                          <button type="button" onClick={() => saveDate(batch)} disabled={saving}
                            className="px-3 py-1.5 rounded border font-semibold oi-btn oi-btn-primary disabled:opacity-50">
                            {saving ? 'Saving…' : 'Save date'}
                          </button>
                        )}
                        {isAdmin && (onSale
                          ? <button type="button" onClick={() => setStatus(batch, 'expired')} disabled={saving} className="text-gray-500 hover:text-red-600 underline disabled:opacity-50">Take off sale</button>
                          : <button type="button" onClick={() => setStatus(batch, 'active')} disabled={saving} className="text-gray-500 hover:text-green-700 underline disabled:opacity-50">Put back on sale</button>)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {!exactStock && batches.length > 0 && (
            <p className="text-[11px] text-gray-500">
              "Est. left on shelf" assumes the oldest expiry is sold first, using this product's live stock. Add a batch whenever you restock to keep it accurate.
            </p>
          )}

          {isAdmin ? (
            <form onSubmit={addBatch} className="rounded-xl border border-dashed border-gray-300 p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Add a batch</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <input placeholder="Batch no. *" value={draft.batch_number}
                  onChange={(e) => setDraft((d) => ({ ...d, batch_number: e.target.value }))}
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
                <input type="number" min="0" step="1" inputMode="numeric" placeholder="Quantity *" value={draft.quantity}
                  onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
                <input type="date" min={todayIso()} value={draft.expiry_date} aria-label="Expiry date"
                  onChange={(e) => setDraft((d) => ({ ...d, expiry_date: e.target.value }))}
                  className="col-span-2 sm:col-span-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {!exactStock ? (
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input type="checkbox" checked={draft.add_to_stock}
                      onChange={(e) => setDraft((d) => ({ ...d, add_to_stock: e.target.checked }))} />
                    Also add these units to stock
                  </label>
                ) : <span />}
                <button type="submit" disabled={busy === 'new'}
                  className="px-4 py-1.5 rounded border text-sm font-semibold oi-btn oi-btn-primary disabled:opacity-50">
                  {busy === 'new' ? 'Adding…' : 'Add batch'}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-gray-500 text-center">Only Admins can add batches or change expiry dates.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductBatchManager;
