// Store-wide batches list (admin portal): every product with its batch count and
// next expiry, so an admin can jump straight into one product's batches.
import React, { useMemo, useState } from 'react';
import { getExpiryStatus, formatExpiryDate } from '../utils/productExpiry';
import { nextBatch } from '../utils/productBatches';
import { useBackLayer } from '../hooks/useBackLayer';

const PILL = {
  expired: 'oi-pill-out',
  critical: 'oi-pill-crit',
  soon: 'oi-pill-low',
  ok: 'oi-pill-ok',
  none: 'oi-pill-ok',
};

const BatchOverviewModal = ({ products, batchesByProduct, onOpenProduct, onClose }) => {
  useBackLayer(true, onClose);
  const [query, setQuery] = useState('');
  const [onlyTracked, setOnlyTracked] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => !q || `${p.name} ${p.sku || ''}`.toLowerCase().includes(q))
      .map((p) => {
        const batches = batchesByProduct[p.id] || [];
        return { product: p, batches, next: nextBatch(batches) };
      })
      .filter((r) => !onlyTracked || r.batches.length > 0)
      // Tracked products first, soonest-expiring at the top.
      .sort((a, b) => {
        if (!!a.batches.length !== !!b.batches.length) return a.batches.length ? -1 : 1;
        const da = a.next ? String(a.next.expiry_date) : '9999';
        const db = b.next ? String(b.next.expiry_date) : '9999';
        return da.localeCompare(db) || a.product.name.localeCompare(b.product.name);
      });
  }, [products, batchesByProduct, query, onlyTracked]);

  const trackedCount = products.filter((p) => (batchesByProduct[p.id] || []).length > 0).length;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-6" role="dialog" aria-modal="true" aria-label="Batches">
      <div className="w-full sm:max-w-2xl max-h-[92vh] max-h-[92dvh] overflow-y-auto overscroll-contain bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-5 pt-5 pb-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-lg font-bold leading-tight text-gray-800">Batches</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                Pick a product to add batches and set an expiry date for each quality. {trackedCount} of {products.length} products have batches.
              </p>
            </div>
            <button type="button" onClick={onClose} className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close">×</button>
          </div>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products…"
            className="w-full px-3 py-2.5 text-sm oi-input rounded-lg" />
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={onlyTracked} onChange={(e) => setOnlyTracked(e.target.checked)} className="h-4 w-4" />
            Only products with batches
          </label>
        </div>

        <ul className="divide-y divide-gray-100 px-2 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-4">
          {rows.length === 0 && <li className="py-8 text-center text-sm text-gray-400">No products match.</li>}
          {rows.map(({ product, batches, next }) => {
            const status = next ? getExpiryStatus(next.expiry_date) : null;
            const qualities = [...new Set(batches.map((b) => (b.quality || '').trim()).filter(Boolean))];
            return (
              <li key={product.id}>
                <button type="button" onClick={() => onOpenProduct(product)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3.5 text-left hover:bg-gray-50 active:bg-gray-100">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-gray-800">{product.name}</span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {batches.length === 0
                        ? 'No batches yet'
                        : `${batches.length} batch${batches.length === 1 ? '' : 'es'}${qualities.length ? ` · ${qualities.join(', ')}` : ''}`}
                    </span>
                    {next && <span className="mt-0.5 block text-xs text-gray-500">Next: {formatExpiryDate(next.expiry_date)}{next.quality ? ` (${next.quality})` : ''}</span>}
                  </span>
                  {status && <span className={`${PILL[status.key]} shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold`}>{status.label}</span>}
                  <span className="shrink-0 text-gray-300" aria-hidden="true">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default BatchOverviewModal;
