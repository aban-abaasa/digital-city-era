// BARCODES — gives every product that has no barcode a scannable one, and prints them as a sheet
// of labels. The cashier points the scanner at the printed label instead of searching for the item.
//   "No barcode" means blank, or one of the placeholders earlier versions saved (AUTO-…, BC-…),
//   which no scanner can read. Products with a real barcode are never changed here.

import React, { useMemo, useState } from 'react';
import { FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { supabase } from '../services/supabase';
import { printableBarcode } from '../utils/barcodeSymbols';
import { downloadBarcodeSheet, openBarcodeSheet } from '../utils/barcodePdf';
import { generateStoreBarcode, generateStoreBarcodes, isPlaceholderBarcode, isStoreBarcode } from '../utils/storeBarcodes';
import { useBackLayer } from '../hooks/useBackLayer';

const BarcodeLabelsModal = ({ products, categories, supermarketId, storeName, isAdmin, formatCurrency, onClose, onBarcodesAssigned }) => {
  useBackLayer(true, onClose);
  const [scope, setScope] = useState('store'); // 'store' = the barcodes made here, 'all' = every product
  const [categoryId, setCategoryId] = useState('');
  const [includePrice, setIncludePrice] = useState(true);
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [generating, setGenerating] = useState(false);

  const needing = useMemo(() => products.filter((p) => isPlaceholderBarcode(p.barcode)), [products]);
  const storeMade = useMemo(() => products.filter((p) => isStoreBarcode(p.barcode)), [products]);

  const inScope = useMemo(
    () => (scope === 'store' ? storeMade : products).filter((p) => !categoryId || p.category_id === categoryId),
    [scope, storeMade, products, categoryId]
  );
  const printable = useMemo(() => inScope.filter((p) => printableBarcode(p.barcode)), [inScope]);
  const unprintable = inScope.length - printable.length;

  const generate = async () => {
    if (!isAdmin) {
      toast.error('❌ Only Admins can generate barcodes');
      return;
    }
    if (!supermarketId) {
      toast.error('No supermarket is assigned to this admin account.');
      return;
    }
    const replacing = needing.filter((p) => String(p.barcode ?? '').trim()).length;
    const message = `Give ${needing.length} product${needing.length === 1 ? '' : 's'} a new barcode?` +
      (replacing > 0 ? `\n\n${replacing} of them have an unreadable placeholder code (AUTO-… or BC-…) that will be replaced.` : '');
    if (!window.confirm(message)) return;

    setGenerating(true);
    const taken = products.map((p) => p.barcode);
    const codes = generateStoreBarcodes({ supermarketId, count: needing.length, taken });
    const assigned = {};
    let failed = 0;
    try {
      // A few at a time: one update per product, and a long list shouldn't hammer the connection
      for (let start = 0; start < needing.length; start += 6) {
        await Promise.all(needing.slice(start, start + 6).map(async (product, offset) => {
          let code = codes[start + offset];
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const { error } = await supabase.from('products').update({ barcode: code }).eq('id', product.id);
            if (!error) {
              assigned[product.id] = code;
              return;
            }
            if (error.code !== '23505') break;
            // Taken by a product this page can't see: draw another number
            code = generateStoreBarcode({ supermarketId, taken: [...taken, ...codes, ...Object.values(assigned)] });
          }
          failed += 1;
        }));
      }
    } catch (error) {
      console.error('❌ Error generating barcodes:', error);
      failed = needing.length - Object.keys(assigned).length;
    } finally {
      setGenerating(false);
    }

    const done = Object.keys(assigned).length;
    if (done > 0) {
      onBarcodesAssigned(assigned);
      setScope('store');
      setCategoryId('');
    }
    if (failed > 0) toast.error(`❌ ${failed} product${failed === 1 ? '' : 's'} could not be given a barcode. Press Generate again to retry.`);
    if (done > 0) toast.success(`✅ ${done} barcode${done === 1 ? '' : 's'} generated. Download the sheet to print them.`);
  };

  const sheetOptions = () => ({ products: printable, categories, storeName, includePrice, groupByCategory, formatPrice: formatCurrency });

  const makeSheet = (action, successText) => {
    try {
      const sheet = action(sheetOptions());
      toast.success(successText(sheet));
    } catch (error) {
      console.error('❌ Error building the barcode sheet:', error);
      toast.error('❌ Could not build the barcode sheet');
    }
  };

  const labelWord = (n) => `${n} label${n === 1 ? '' : 's'}`;

  return (
    <div className="oi-modal-backdrop fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 md:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="barcodes-title" className="oi-modal-panel bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[92dvh] overflow-y-auto">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-3 md:p-5 flex items-center justify-between sticky top-0">
          <div className="min-w-0">
            <h2 id="barcodes-title" className="text-lg md:text-xl font-bold">🏷️ Barcodes</h2>
            {storeName && (
              <p className="oi-store-chip mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-xs md:text-sm font-semibold text-white">
                <span aria-hidden="true">🏪</span><span className="truncate">{storeName}</span>
              </p>
            )}
            <p className="text-green-100 text-xs md:text-sm mt-1">Make barcodes for items that have none, and print them as a sheet</p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 p-1 md:p-2 rounded-lg transition" disabled={generating}>
            <FiX className="h-5 w-5 md:h-6 md:w-6" />
          </button>
        </div>

        <div className="p-3 md:p-5 space-y-4">
          <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/60 p-3 space-y-2 dark:border-emerald-400/25 dark:bg-emerald-500/10">
            {needing.length > 0 ? (
              <>
                <p className="text-sm font-semibold text-gray-800">
                  {needing.length} product{needing.length === 1 ? ' has' : 's have'} no barcode a scanner can read.
                </p>
                <p className="text-xs text-gray-600">
                  Each gets its own unique number (it starts with 2, the range kept for in-store barcodes), so it can never clash with a manufacturer's code. Products that already have a real barcode are left alone.
                </p>
                <button
                  onClick={generate}
                  disabled={generating || !isAdmin}
                  className="w-full sm:w-auto bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-wait"
                >
                  {generating ? 'Generating…' : `⚡ Generate ${needing.length} barcode${needing.length === 1 ? '' : 's'}`}
                </button>
              </>
            ) : (
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">✅ Every product has a barcode.</p>
            )}
            <p className="text-xs text-gray-600">
              {storeMade.length} store-made barcode{storeMade.length === 1 ? '' : 's'} ready to print.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-800">Barcode sheet (PDF)</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-gray-700">
                Which products
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-sm bg-white font-normal"
                >
                  <option value="store">Store-made barcodes ({storeMade.length})</option>
                  <option value="all">All products ({products.length})</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-gray-700">
                Category
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-sm bg-white font-normal"
                >
                  <option value="">All categories</option>
                  {(categories || []).map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={includePrice} onChange={(e) => setIncludePrice(e.target.checked)} className="h-4 w-4" />
                Show prices
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={groupByCategory} onChange={(e) => setGroupByCategory(e.target.checked)} className="h-4 w-4" />
                Group by category
              </label>
            </div>

            <p className="text-xs text-gray-600">
              {printable.length > 0
                ? `${labelWord(printable.length)}, three across, A to Z.`
                : 'Nothing to print yet with these choices.'}
              {unprintable > 0 && ` ${unprintable} product${unprintable === 1 ? ' has a code' : 's have codes'} that can't be drawn as a barcode and ${unprintable === 1 ? 'is' : 'are'} left out.`}
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => makeSheet(downloadBarcodeSheet, (s) => `✅ Barcode sheet saved: ${labelWord(s.printed)}, ${s.pages} page${s.pages === 1 ? '' : 's'}`)}
                disabled={printable.length === 0 || generating}
                className="flex-1 bg-green-500 text-white px-4 py-2.5 rounded-lg hover:bg-green-600 transition-colors font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⬇️ Download PDF
              </button>
              <button
                onClick={() => makeSheet(openBarcodeSheet, (s) => `Barcode sheet opened: ${labelWord(s.printed)}`)}
                disabled={printable.length === 0 || generating}
                className="flex-1 bg-white text-gray-800 border-2 border-gray-300 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🖨️ Open to print
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeLabelsModal;
