// "Add flavors" for a product that already exists: each flavor becomes a new product with
// its own barcode, copying this product's cost, tax and category (and selling price,
// unless a flavor is given its own).

import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { supabase } from '../services/supabase';
import inventoryService from '../services/inventorySupabaseService';
import ProductFlavorsEditor from './ProductFlavorsEditor';
import { activeFlavorRows, checkFlavorRows, hasFlavorIssues, registerFlavorProducts } from '../utils/productFlavors';

const ProductFlavorsModal = ({ product, products, onClose, onCreated }) => {
  const [rows, setRows] = useState([]);
  const [sharedName, setSharedName] = useState(product.name || '');
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

      const { products: created, stockError } = await registerFlavorProducts({
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
        rows
      });

      if (stockError) {
        toast.warning('Flavors were added, but their stock records could not be created. Press Refresh to retry.');
      }
      toast.success(`✅ Added ${created.length} flavor${created.length === 1 ? '' : 's'}`);
      onCreated(created.map((flavor) => ({ ...flavor, current_stock: 0, images: [] })));
      onClose();
    } catch (error) {
      console.error('❌ Error adding flavors:', error);
      toast.error(`❌ ${error.message || 'Could not add the flavors'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 md:p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-3 md:p-6 flex items-center justify-between sticky top-0">
          <div className="min-w-0">
            <h2 className="text-lg md:text-2xl font-bold">🍹 Add flavors</h2>
            <p className="text-green-100 text-xs md:text-sm mt-1 truncate">to {product.name}</p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-white hover:bg-white hover:bg-opacity-20 p-1 md:p-2 rounded-lg transition"
          >
            <FiX className="h-5 w-5 md:h-6 md:w-6" />
          </button>
        </div>

        <div className="p-3 md:p-6 space-y-3">
          <ProductFlavorsEditor
            rows={rows}
            onRowsChange={setRows}
            sharedName={sharedName}
            onSharedNameChange={setSharedName}
            mainBarcode={product.barcode}
            products={products}
            basePrice={product.clearance_original_price ?? product.selling_price}
            startOpen
          />
          <div className="flex flex-col sm:flex-row gap-2 md:gap-3 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 bg-green-500 text-white px-3 md:px-4 py-2 md:py-3 rounded-lg hover:bg-green-600 transition-colors font-semibold text-sm md:text-base disabled:opacity-60 disabled:cursor-wait"
            >
              {saving ? 'Saving flavors…' : 'Save flavors'}
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 bg-gray-400 text-white px-3 md:px-4 py-2 md:py-3 rounded-lg hover:bg-gray-500 transition-colors font-semibold text-sm md:text-base"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductFlavorsModal;
