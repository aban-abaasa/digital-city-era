// Cashier: choose which batch (quality) of a product to sell. Each batch is
// listed like its own product, with its own price and expiry date.
import React from 'react';
import { FiX } from 'react-icons/fi';
import { formatExpiryDate, getExpiryStatus } from '../utils/productExpiry';
import { batchLabel } from '../utils/productBatches';

const BatchPickerModal = ({ product, batches, formatPrice, onPick, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-[70] p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={`Choose a batch of ${product.name}`}>
    <div className="bg-white rounded-t-2xl sm:rounded-xl p-5 sm:p-6 max-w-md w-full shadow-2xl max-h-[85vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="text-lg font-bold text-gray-900">Choose a batch</h3>
        <button type="button" onClick={onClose} className="-mr-1 p-2 text-gray-400 hover:text-gray-600" aria-label="Close">
          <FiX className="h-5 w-5" />
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-4">{product.name}</p>
      <div className="space-y-3">
        {batches.map((batch) => {
          const price = batch.selling_price != null && Number(batch.selling_price) > 0
            ? Number(batch.selling_price)
            : (product.selling_price || product.price || 0);
          const expiry = getExpiryStatus(batch.expiry_date);
          return (
            <button
              key={batch.id}
              type="button"
              onClick={() => onPick(batch)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-lg border border-gray-200 text-left hover:bg-yellow-50 hover:border-yellow-300 active:bg-yellow-100"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-gray-900 truncate">{batchLabel(batch)}</span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  {(batch.quality || '').trim() ? `Batch ${batch.batch_number} · ` : ''}
                  {Number(batch.remaining)} left · expires {formatExpiryDate(batch.expiry_date)}
                </span>
                {['critical', 'soon'].includes(expiry.key) && (
                  <span className="block text-xs font-semibold text-orange-600 mt-0.5">{expiry.label}</span>
                )}
              </span>
              <span className="shrink-0 font-bold text-green-600">{formatPrice(price)}</span>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

export default BatchPickerModal;
