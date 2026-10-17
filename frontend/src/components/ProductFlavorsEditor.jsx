// FLAVORS EDITOR — add as many flavors (each with its own barcode) as the product has.
// Each flavor is sold as its own product, so a scan at the till finds exactly the flavor
// in the customer's hand. Used by the Add Product form and by "Add flavors" on an existing
// product. `onRowsChange` is a React state setter (it is called with an updater function).

import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCamera, FiImage, FiPlus, FiTrash2, FiZap } from 'react-icons/fi';
import { toast } from 'react-toastify';
import DualScannerInterface from './DualScannerInterface';
import { barcodesMatch } from '../utils/barcodeHelper';
import {
  FLAVOR_SUGGESTIONS,
  activeFlavorRows,
  addBarcodesToRows,
  addFlavorNameToRows,
  checkFlavorRows,
  flavorProductName,
  newFlavorRow,
  splitScannedCodes
} from '../utils/productFlavors';

const fieldClass = 'px-3 py-1.5 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-sm bg-white';
const inputClass = `w-full ${fieldClass}`;

const ProductFlavorsEditor = ({
  rows,
  onRowsChange,
  sharedName,
  onSharedNameChange,
  mainBarcode = '',
  products = [],
  basePrice = 0,
  startOpen = false,
  generateBarcode
}) => {
  const [open, setOpen] = useState(startOpen || rows.length > 0);
  const [quick, setQuick] = useState('');
  // null = scanner closed, 'many' = stays open and adds a row per scan, otherwise the id of the row being filled
  const [scanTarget, setScanTarget] = useState(null);
  const quickRef = useRef(null);

  const issues = checkFlavorRows(rows, { mainBarcode, products });
  const readyCount = activeFlavorRows(rows).filter((row) => !issues[row.id]).length;
  const unusedSuggestions = FLAVOR_SUGGESTIONS.filter(
    (flavor) => !rows.some((row) => row.flavor.trim().toLowerCase() === flavor.toLowerCase())
  );

  const updateRow = (id, patch) =>
    onRowsChange((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const removeRow = (id) => {
    const gone = rows.find((row) => row.id === id);
    if (gone?.photoPreview) URL.revokeObjectURL(gone.photoPreview);
    onRowsChange((prev) => prev.filter((row) => row.id !== id));
  };

  // Each flavor can have a photo of its own; it is uploaded when the flavors are saved
  const selectPhoto = (id, file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    const previous = rows.find((row) => row.id === id)?.photoPreview;
    if (previous) URL.revokeObjectURL(previous);
    updateRow(id, { photo: file, photoPreview: URL.createObjectURL(file) });
  };

  // Items with no barcode of their own get a store-made one; `generateBarcode(taken)` is supplied by the page
  const missingBarcodes = generateBarcode ? activeFlavorRows(rows).filter((row) => !row.barcode.trim()) : [];
  const generateFor = (targets) => {
    const taken = rows.map((row) => row.barcode);
    const made = {};
    targets.forEach((row) => {
      made[row.id] = generateBarcode([...taken, ...Object.values(made)]);
    });
    onRowsChange((prev) => prev.map((row) => (made[row.id] ? { ...row, barcode: made[row.id] } : row)));
  };

  const addCodes = (codes) => {
    const alreadyListed = codes.filter((code) => rows.some((row) => barcodesMatch(row.barcode, code))).length;
    if (alreadyListed > 0) toast.info(`${alreadyListed === 1 ? 'That barcode is' : `${alreadyListed} barcodes are`} already on the list`);
    onRowsChange((prev) => addBarcodesToRows(prev, codes));
  };

  const commitQuick = () => {
    const codes = splitScannedCodes(quick);
    if (codes.length > 0) addCodes(codes);
    setQuick('');
    quickRef.current?.focus();
  };

  const handleScan = (scanned) => {
    const barcode = String(scanned ?? '').trim();
    if (!barcode) return;
    if (scanTarget === 'many') {
      addCodes([barcode]);
      return;
    }
    updateRow(scanTarget, { barcode });
    setScanTarget(null);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTimeout(() => quickRef.current?.focus(), 0);
        }}
        className="w-full rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50 px-3 py-2.5 text-left text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
      >
        🍹 Comes in flavors? Add each flavor with its own barcode
      </button>
    );
  }

  return (
    <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/50 p-3 space-y-3">
      <div>
        <h3 className="text-sm md:text-base font-bold text-emerald-900">🍹 Flavors</h3>
        <p className="text-xs text-gray-600 mt-0.5">
          Each flavor is saved as its own product with its own barcode, price and stock. Scan or type as many as you need.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Name shared by every flavor</label>
        <input
          type="text"
          value={sharedName}
          onChange={(e) => onSharedNameChange(e.target.value)}
          placeholder="e.g., Fanta 500ml"
          className={inputClass}
        />
        <p className="mt-1 text-[11px] text-gray-500">If the product's name already includes a flavor, change this so it isn't repeated.</p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Scan or paste barcodes — press Enter after each
        </label>
        <div className="flex gap-2">
          <input
            ref={quickRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitQuick();
              }
            }}
            onPaste={(e) => {
              const codes = splitScannedCodes(e.clipboardData.getData('text'));
              if (codes.length > 1) {
                e.preventDefault();
                addCodes(codes);
              }
            }}
            placeholder="Click here, then use the hand scanner"
            className={`${inputClass} font-mono`}
          />
          <button
            type="button"
            onClick={commitQuick}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 whitespace-nowrap"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setScanTarget('many')}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 flex items-center gap-1 whitespace-nowrap"
            title="Open the camera and scan one flavor after another"
          >
            <FiCamera className="h-4 w-4" />
            <span className="hidden sm:inline">Scan several</span>
          </button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row, index) => {
            const rowIssues = issues[row.id] || {};
            return (
              <div key={row.id} className="rounded-lg border border-emerald-200 bg-white p-2">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="flex-1 min-w-[8rem]">
                    <input
                      type="text"
                      list="flavor-suggestions"
                      value={row.flavor}
                      onChange={(e) => updateRow(row.id, { flavor: e.target.value })}
                      placeholder={`Flavor ${index + 1}`}
                      className={`${inputClass} ${rowIssues.flavor ? 'border-red-400' : ''}`}
                    />
                  </div>
                  <div className="flex flex-1 min-w-[11rem] gap-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={row.barcode}
                      onChange={(e) => updateRow(row.id, { barcode: e.target.value })}
                      placeholder="Barcode"
                      className={`${inputClass} font-mono ${rowIssues.barcode ? 'border-red-400' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setScanTarget(row.id)}
                      className="px-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                      title="Scan this flavor's barcode"
                    >
                      <FiCamera className="h-4 w-4" />
                    </button>
                    {generateBarcode && !row.barcode.trim() && (
                      <button
                        type="button"
                        onClick={() => generateFor([row])}
                        className="px-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                        title="This flavor has no barcode: make one, then print it from Barcodes"
                      >
                        <FiZap className="h-4 w-4" />
                      </button>
                    )}
                    <label
                      className="flex w-10 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-gray-300 bg-white text-gray-500 hover:border-emerald-400"
                      title={row.photoPreview ? "Change this flavor's photo" : 'Add a photo for this flavor'}
                    >
                      {row.photoPreview
                        ? <img src={row.photoPreview} alt="" className="h-full w-full object-cover" />
                        : <FiImage className="h-4 w-4" />}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          selectPhoto(row.id, e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={row.selling_price}
                    onChange={(e) => updateRow(row.id, { selling_price: e.target.value })}
                    placeholder={basePrice ? `Price ${basePrice}` : 'Price'}
                    title="Leave blank to use the main product's selling price"
                    className={`${fieldClass} w-32`}
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                    title="Remove this flavor"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                </div>
                {(rowIssues.flavor || rowIssues.barcode) ? (
                  <p className="mt-1 text-xs text-red-600">{[rowIssues.flavor, rowIssues.barcode].filter(Boolean).join(' · ')}</p>
                ) : row.flavor.trim() ? (
                  <p className="mt-1 text-xs text-gray-500">→ {flavorProductName(sharedName, row.flavor)}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onRowsChange((prev) => [...prev, newFlavorRow()])}
          className="px-2.5 py-1 rounded-full bg-white border border-emerald-300 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 flex items-center gap-1"
        >
          <FiPlus className="h-3 w-3" /> Another flavor
        </button>
        {missingBarcodes.length > 0 && (
          <button
            type="button"
            onClick={() => generateFor(missingBarcodes)}
            className="px-2.5 py-1 rounded-full bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 flex items-center gap-1"
            title="Make a barcode for every flavor that has none"
          >
            <FiZap className="h-3 w-3" /> Generate {missingBarcodes.length === 1 ? 'missing barcode' : `${missingBarcodes.length} missing barcodes`}
          </button>
        )}
        {unusedSuggestions.map((flavor) => (
          <button
            key={flavor}
            type="button"
            onClick={() => onRowsChange((prev) => addFlavorNameToRows(prev, flavor))}
            className="px-2.5 py-1 rounded-full bg-white border border-gray-300 text-xs text-gray-700 hover:bg-gray-50"
          >
            {flavor}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-600">
        {readyCount > 0
          ? `${readyCount} flavor${readyCount === 1 ? '' : 's'} will be created when you save.`
          : 'Tip: scan the cans first, then tap the flavor names in the same order — or tap a name, then scan its can.'}
      </p>

      <datalist id="flavor-suggestions">
        {FLAVOR_SUGGESTIONS.map((flavor) => <option key={flavor} value={flavor} />)}
      </datalist>

      {scanTarget && createPortal(
        <DualScannerInterface
          context="admin"
          keepOpen={scanTarget === 'many'}
          onBarcodeScanned={handleScan}
          onClose={() => setScanTarget(null)}
        />,
        document.body
      )}
    </div>
  );
};

export default ProductFlavorsEditor;
