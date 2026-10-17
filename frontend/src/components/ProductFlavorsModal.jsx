// "Add flavors" for a product that already exists: each flavor becomes a new product with
// its own barcode, copying this product's cost, tax and category (and selling price,
// unless a flavor is given its own).

import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { supabase } from '../services/supabase';
import inventoryService from '../services/inventorySupabaseService';
import ProductFlavorsEditor from './ProductFlavorsEditor';
import { familyName } from '../utils/productFamilies';
import { activeFlavorRows, checkFlavorRows, hasFlavorIssues, registerFlavorProducts } from '../utils/productFlavors';

const ProductFlavorsModal = ({ product, products, storeName, uploadPhoto, generateBarcode, onClose, onCreated }) => {
  const [rows, setRows] = useState([]);
  // The product may itself be a flavor ("Fanta - Orange"); the new ones share its family name ("Fanta")
  const [sharedName, setSharedName] = useState(familyName(product.name));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (activeFlavorRows(rows).length === 0) {
      toast.info('Add at least one flavor first');
      return;
    }
    if (hasFlavorIssues(checkFlavorRows(rows, { mainBarcode: product.barcode, products }))) {
      toast.error('❌ Fix the flavors marked in red first');
      return;
    }

    setSaving(true);
    try {
      const supermarketId = await inventoryService.getCurrentSupermarketId();
      if (!supermarketId) throw new Error('No supermarket is assigned to this admin account.');

      const { products: created, stockError, photoFailures } = await registerFlavorProducts({
        supabase,
        supermarketId,
        base: {
          name: sharedName,
          cost_price: product.cost_price,
          wholesale_price: product.wholesale_price,
          wholesale_discount_percent: 0,
          // A product on a reduced-price offer passes on its normal price, not the offer
          selling_price: product.clearance_original_price ?? product.selling_price,
          tax_rate: product.tax_rate,
          category_id: product.category_id
        },
        rows,
        uploadPhoto
      });

      if (photoFailures > 0) {
        toast.warning(`${photoFailures} flavor photo${photoFailures === 1 ? '' : 's'} could not be uploaded. Add them from Flavor families.`);
      }
      if (stockError) {
        toast.warning('Flavors were added, but their stock records could not be created. Press Refresh to retry.');
      }
      toast.success(`✅ Added ${created.length} flavor${created.length === 1 ? '' : 's'}`);
      onCreated(created.map((flavor) => ({ ...flavor, current_stock: 0, images: Array.isArray(flavor.images) ? flavor.images : [] })));
      onClose();
    } catch (error) {
      console.error('❌ Error adding flavors:', error);
      toast.error(`❌ ${error.message || 'Could not add the flavors'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="oi-modal-backdrop fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 md:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="add-flavors-title" className="oi-modal-panel bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[92dvh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-3 md:p-5 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <h2 id="add-flavors-title" className="text-lg md:text-2xl font-bold">🍹 Add flavors</h2>
            {storeName && (
              <p className="oi-store-chip mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-xs md:text-sm font-semibold text-white">
                <span aria-hidden="true">🏪</span><span className="truncate">{storeName}</span>
              </p>
            )}
            <p className="text-green-100 text-xs md:text-sm mt-1 truncate">to {product.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="text-white hover:bg-white hover:bg-opacity-20 p-1 md:p-2 rounded-lg transition flex-shrink-0"
          >
            <FiX className="h-5 w-5 md:h-6 md:w-6" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 md:p-6 space-y-3">
          <ProductFlavorsEditor
            rows={rows}
            onRowsChange={setRows}
            sharedName={sharedName}
            onSharedNameChange={setSharedName}
            mainBarcode={product.barcode}
            products={products}
            basePrice={product.clearance_original_price ?? product.selling_price}
            startOpen
            generateBarcode={generateBarcode}
          />
        </div>

        {/* Save / Cancel stay in view while the flavors scroll */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row gap-2 md:gap-3 border-t border-gray-200 bg-white p-3 md:px-6 md:py-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 bg-green-500 text-white px-3 md:px-4 py-2 md:py-3 rounded-lg hover:bg-green-600 transition-colors font-semibold text-sm md:text-base disabled:opacity-60 disabled:cursor-wait"
          >
            {saving ? 'Saving flavors…' : 'Save flavors'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 bg-gray-400 text-white px-3 md:px-4 py-2 md:py-3 rounded-lg hover:bg-gray-500 transition-colors font-semibold text-sm md:text-base"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductFlavorsModal;
