import React, { useMemo, useState } from 'react';
import { FiPlus, FiTrash2, FiPackage } from 'react-icons/fi';

const toLine = (item = {}) => ({
  product_id: Object.prototype.hasOwnProperty.call(item, 'product_id') ? item.product_id : (item.id || null),
  store_product_id: item.store_product_id || null,
  product_name: item.product_name || item.productName || item.name || '',
  barcode: item.barcode || item.product_data?.barcode || '',
  sku: item.sku || item.product_data?.sku || '',
  batch_number: item.batch_number || '',
  expiry_date: item.expiry_date || '',
  supplier_catalog_item_id: item.supplier_catalog_item_id || null,
  quantity: Number(item.quantity ?? item.qty ?? 1),
  unit_price: Number(item.unit_price ?? item.unitPrice ?? item.price ?? 0),
});

const PurchaseOrderQuoteEditor = ({
  initialItems = [],
  catalog = [],
  mode = 'supplier',
  taxRate = 18,
  initialNotes = '',
  busy = false,
  onSubmit,
}) => {
  const [items, setItems] = useState(() => (initialItems || []).map(toLine));
  const [notes, setNotes] = useState(initialNotes || '');
  const [error, setError] = useState('');
  const catalogItems = useMemo(() => (catalog || []).filter((item) => item?.id && (item.name || item.product_name)), [catalog]);
  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0);
  const tax = subtotal * Number(taxRate || 0) / 100;
  const total = subtotal + tax;
  const isManager = mode === 'manager';

  const updateItem = (index, field, value) => {
    setItems((current) => current.map((item, itemIndex) => (
      itemIndex === index
        ? { ...item, [field]: value, ...(field === 'product_name' ? { product_id: null, store_product_id: null } : {}) }
        : item
    )));
    setError('');
  };

  const addCatalogItem = (productId) => {
    const product = catalogItems.find((item) => String(item.id) === String(productId));
    if (!product) return;
    setItems((current) => [...current, toLine({
      id: product.id,
      product_id: isManager ? product.id : null,
      store_product_id: isManager ? product.id : null,
      supplier_catalog_item_id: isManager ? null : product.supplier_catalog_item_id || null,
      name: product.name || product.product_name,
      barcode: product.barcode || '',
      sku: product.sku || '',
      batch_number: product.batch_number || '',
      expiry_date: product.expiry_date || '',
      unit_price: product.cost_price ?? product.selling_price ?? product.price ?? 0,
      quantity: 1,
    })]);
  };

  const addCustomLine = () => setItems((current) => [...current, toLine({ quantity: 1, unit_price: 0 })]);
  const removeItem = (index) => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const submit = async (decision = 'submitted') => {
    if (decision === 'changes_requested' && isManager) {
      if (!notes.trim()) {
        setError('Add a short note so the supplier knows what to change.');
        return;
      }
      setError('');
      await onSubmit?.([], notes.trim(), decision);
      return;
    }
    const normalized = items.map((item) => ({
      product_id: item.store_product_id || item.product_id || null,
      product_name: String(item.product_name || '').trim(),
      barcode: item.barcode || '',
      sku: item.sku || '',
      batch_number: item.batch_number || '',
      expiry_date: item.expiry_date || '',
      supplier_catalog_item_id: item.supplier_catalog_item_id || null,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
    }));
    if (!normalized.length) {
      setError('Add at least one product to the proposal.');
      return;
    }
    if (normalized.some((item) => !item.product_name || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unit_price) || item.unit_price < 0)) {
      setError('Each product needs a name, quantity above zero, and a valid unit price.');
      return;
    }
    setError('');
    await onSubmit?.(normalized, notes.trim(), decision);
  };

  return (
    <div className="co-quote-editor">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700"><FiPackage /></span>
        <div>
          <h3 className="font-bold text-gray-900">{isManager ? 'Review supplier proposal' : 'Prepare your supply proposal'}</h3>
          <p className="mt-1 text-sm text-gray-600">
            {isManager
              ? 'Adjust the products, quantities, and prices. Approving this list sets the order total and unlocks admin payment approval.'
              : 'Choose products you can supply, set quantities and prices, then send your proposal to the manager.'}
          </p>
        </div>
      </div>

      {items.length > 0 && <div className="space-y-3">
        {items.map((item, index) => (
          <div key={`${item.product_id || 'item'}-${index}`} className={`co-quote-line grid grid-cols-1 gap-2 sm:items-end ${isManager ? 'is-manager sm:grid-cols-[minmax(0,1fr)_minmax(170px,0.8fr)_100px_145px_40px]' : 'sm:grid-cols-[minmax(0,1fr)_110px_150px_40px]'}`}>
            <label className="text-xs font-semibold text-gray-600">
              Product
              <input value={item.product_name} readOnly={!isManager} onChange={(event) => updateItem(index, 'product_name', event.target.value)} placeholder="Product name" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 read-only:bg-gray-50" />
            </label>
            {isManager && <label className="text-xs font-semibold text-gray-600">
              Store inventory match
              <select value={item.store_product_id || (catalogItems.some((product) => String(product.id) === String(item.product_id)) ? item.product_id : '')} onChange={(event) => {
                const product = catalogItems.find((candidate) => String(candidate.id) === String(event.target.value));
                setItems((current) => current.map((line, itemIndex) => itemIndex === index
                  ? { ...line, store_product_id: product?.id || null, product_id: product?.id || line.product_id, product_name: product?.name || product?.product_name || line.product_name, barcode: line.barcode || product?.barcode || '', sku: line.sku || product?.sku || '' }
                  : line));
              }} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900">
                <option value="">Keep proposal product</option>
                {catalogItems.map((product) => <option key={product.id} value={product.id}>{product.name || product.product_name}</option>)}
              </select>
            </label>}
            {(item.barcode || item.batch_number || item.expiry_date) && <p className="text-xs text-gray-500 sm:col-span-full">
              {item.barcode ? `Barcode ${item.barcode}` : ''}
              {item.batch_number ? `${item.barcode ? ' · ' : ''}Batch ${item.batch_number}` : ''}
              {item.expiry_date ? `${item.barcode || item.batch_number ? ' · ' : ''}Expires ${item.expiry_date}` : ''}
            </p>}
            <label className="text-xs font-semibold text-gray-600">
              Quantity
              <input type="number" min="0.01" step="any" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900" />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Unit price (UGX)
              <input type="number" min="0" step="any" value={item.unit_price} onChange={(event) => updateItem(index, 'unit_price', event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900" />
            </label>
            <button type="button" onClick={() => removeItem(index)} aria-label={`Remove ${item.product_name || 'product'}`} className="flex h-10 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50"><FiTrash2 /></button>
          </div>
        ))}
      </div>}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {catalogItems.length > 0 && (
          <select defaultValue="" onChange={(event) => { addCatalogItem(event.target.value); event.target.value = ''; }} className="min-h-10 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">
            <option value="" disabled>Add a product from {isManager ? 'store inventory' : 'your catalog'}…</option>
            {catalogItems.map((product) => <option key={product.id} value={product.id}>{product.name || product.product_name}</option>)}
          </select>
        )}
        <button type="button" onClick={addCustomLine} className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"><FiPlus /> Add product manually</button>
      </div>
      {isManager && <p className="mt-2 text-xs text-gray-500">Match a line to a store product when you want delivered stock added to that product’s inventory.</p>}

      {items.length === 0 && <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">No products yet. Add items to build the supply proposal.</p>}

      <label className="mt-4 block text-xs font-semibold text-gray-600">
        {isManager ? 'Note to supplier' : 'Delivery or supply note'}
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Optional details" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900" />
      </label>

      <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm">
        <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>UGX {subtotal.toLocaleString()}</span></div>
        <div className="mt-1 flex justify-between text-gray-600"><span>Tax ({Number(taxRate || 0)}%)</span><span>UGX {tax.toLocaleString()}</span></div>
        <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-bold text-gray-900"><span>Proposed total</span><span>UGX {total.toLocaleString()}</span></div>
      </div>

      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{error}</p>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        {isManager && <button type="button" disabled={busy} onClick={() => submit('changes_requested')} className="rounded-lg border border-amber-300 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50">Request changes</button>}
        <button type="button" disabled={busy} onClick={() => submit(isManager ? 'accepted' : 'submitted')} className="rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">
          {busy ? 'Saving…' : isManager ? 'Approve final quote' : 'Send proposal to manager'}
        </button>
      </div>
    </div>
  );
};

export default PurchaseOrderQuoteEditor;
