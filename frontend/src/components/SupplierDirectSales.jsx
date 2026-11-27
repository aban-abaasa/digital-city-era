import React, { useEffect, useMemo, useState } from 'react';
import { FiPlus, FiPrinter, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { supabase } from '../services/supabase';
import ReceiptModal from './ReceiptModal';

const currency = (amount) => `UGX ${Number(amount || 0).toLocaleString('en-UG', { maximumFractionDigits: 0 })}`;

const SupplierDirectSales = ({ supplierAuthId, supplierProfile, products = [], isOnline = true, onSaleSaved }) => {
  const [cart, setCart] = useState([]);
  const [buyerType, setBuyerType] = useState('individual');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeContact, setStoreContact] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const sellableProducts = useMemo(() => (products || [])
    .filter((item) => item.supplier_catalog_item_id && item.is_available && Number(item.stock) > 0)
    .map((item) => ({ ...item, salePrice: Number(item.base_price ?? item.price) || 0 })), [products]);
  const total = cart.reduce((sum, line) => sum + line.quantity * line.product.salePrice, 0);
  const companyInfo = {
    name: supplierProfile?.name || 'Supplier',
    address: supplierProfile?.address || '',
    phone: supplierProfile?.phone || '',
    email: supplierProfile?.email || '',
    website: '',
    logoUrl: supplierProfile?.profile_image_url || null,
  };

  const loadHistory = async () => {
    if (!supplierAuthId) return;
    setLoadingHistory(true);
    const { data, error } = await supabase.from('supplier_direct_sales')
      .select('*')
      .eq('supplier_user_id', supplierAuthId)
      .order('created_at', { ascending: false })
      .limit(25);
    if (error) {
      setHistoryError(/supplier_direct_sales|schema cache|does not exist/i.test(error.message || '')
        ? 'Supplier receipts are not enabled yet. Apply backend/database/migrations/ADD_SUPPLIER_DIRECT_SALES_RECEIPTS.sql.'
        : (error.message || 'Could not load direct sales'));
    } else {
      setHistoryError('');
      setHistory(data || []);
    }
    setLoadingHistory(false);
  };

  useEffect(() => { loadHistory(); }, [supplierAuthId]);

  const addProduct = (product) => {
    setCart((current) => {
      const found = current.find((line) => line.product.supplier_catalog_item_id === product.supplier_catalog_item_id);
      if (found) {
        if (found.quantity + 1 > Number(product.stock)) return current;
        return current.map((line) => line === found ? { ...line, quantity: line.quantity + 1 } : line);
      }
      return [...current, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId, value) => {
    const quantity = Number(value);
    setCart((current) => current.map((line) => line.product.supplier_catalog_item_id !== productId
      ? line
      : { ...line, quantity: Math.min(Number(line.product.stock), Math.max(0, quantity || 0)) }));
  };

  const makeReceiptData = (sale) => {
    const isStoreSale = sale.customer_type === 'store';
    const customer = String((isStoreSale ? sale.business_name : sale.customer_name) || sale.customer_name || customerName || '').trim();
    return {
      id: sale.id,
      saleNumber: sale.receipt_number,
      transactionId: sale.id,
      createdAt: sale.created_at,
      items: (sale.items || []).map((item) => ({
        name: item.name,
        quantity: Number(item.quantity) || 0,
        price: Number(item.price) || 0,
        line_total: Number(item.line_total) || 0,
      })),
      subtotal: Number(sale.subtotal) || 0,
      tax: 0,
      total: Number(sale.total_amount) || 0,
      paymentMethod: sale.payment_method || 'cash',
      paymentStatus: sale.payment_status || 'paid',
      amountPaid: Number(sale.amount_paid) || 0,
      balanceDue: Number(sale.balance_due) || 0,
      customer: customer ? {
        firstName: customer,
        lastName: '',
        label: isStoreSale ? 'Supply to' : 'Customer',
        contactPerson: sale.contact_person || '',
        address: sale.delivery_address || '',
      } : null,
      documentLabel: isStoreSale ? 'Store supply' : null,
      cashier: supplierProfile?.contactPerson || supplierProfile?.name || 'Supplier',
      includeQr: false,
      websiteUrl: supplierProfile?.supplier_business_profile_id
        ? `https://icanera.space/store/${encodeURIComponent(supplierProfile.supplier_business_profile_id)}`
        : 'https://icanera.space',
      companyInfo,
    };
  };

  const saveSale = async (event) => {
    event.preventDefault();
    if (!cart.length) { toast.error('Add products to this sale first'); return; }
    if (buyerType === 'store' && !storeName.trim()) { toast.error('Enter the store or business name'); return; }
    const paid = amountPaid === '' ? (paymentMethod === 'credit' ? 0 : total) : Number(amountPaid || 0);
    if (!Number.isFinite(paid) || paid < 0 || paid > total) {
      toast.error('Amount paid must be between zero and the sale total');
      return;
    }
    setSaving(true);
    const { data, error } = buyerType === 'store'
      ? await supabase.rpc('create_supplier_store_supply_sale_v1', {
        p_items: cart.map(({ product, quantity }) => ({ productId: product.supplier_catalog_item_id, quantity })),
        p_business_name: storeName.trim(),
        p_contact_person: storeContact.trim() || null,
        p_phone: customerPhone.trim() || null,
        p_delivery_address: deliveryAddress.trim() || null,
        p_amount_paid: paid,
        p_payment_method: paymentMethod,
      })
      : await supabase.rpc('create_supplier_direct_sale_v1', {
        p_items: cart.map(({ product, quantity }) => ({ productId: product.supplier_catalog_item_id, quantity })),
        p_customer_name: customerName.trim() || null,
        p_customer_phone: customerPhone.trim() || null,
        p_amount_paid: paid,
        p_payment_method: paymentMethod,
      });
    setSaving(false);
    if (error || !data?.success || !data?.sale) {
      const message = error?.message || data?.error || 'Could not save the sale';
      toast.error(/create_supplier_(direct_sale|store_supply_sale)_v1|schema cache|function .*not found/i.test(message)
        ? `Supplier sales are not enabled yet. Apply backend/database/migrations/${buyerType === 'store' ? 'ADD_SUPPLIER_STORE_SUPPLY_POS.sql' : 'ADD_SUPPLIER_DIRECT_SALES_RECEIPTS.sql'}.`
        : message);
      return;
    }
    toast.success(`${buyerType === 'store' ? 'Store supply' : 'Sale'} ${data.sale.receipt_number} saved`);
    setReceipt(makeReceiptData(data.sale));
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setStoreName('');
    setStoreContact('');
    setDeliveryAddress('');
    setBuyerType('individual');
    setPaymentMethod('cash');
    setAmountPaid('');
    loadHistory();
    if (onSaleSaved) await onSaleSaved();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-3 py-4 sm:px-6">
      <header className="rounded-2xl bg-gradient-to-r from-indigo-800 to-blue-700 p-5 text-white sm:p-6">
        <h2 className="text-xl font-bold sm:text-2xl">Supplier sales POS</h2>
        <p className="mt-1 max-w-3xl text-sm text-indigo-100">Sell to walk-in customers or supply stores that are not on this system. The buyer does not need an account; the sale is recorded, a receipt or invoice is issued, and available stock is deducted.</p>
      </header>

      <form onSubmit={saveSale} className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold text-slate-900">Your available products</h3>
            <span className="text-xs text-slate-500">Stock checked when saved</span>
          </div>
          {!sellableProducts.length ? (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Add listed products and stock to your supplier catalog before recording a direct sale.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {sellableProducts.map((product) => (
                <button
                  type="button"
                  key={product.supplier_catalog_item_id}
                  onClick={() => addProduct(product)}
                  className="flex min-h-20 items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-indigo-300 hover:bg-indigo-50"
                >
                  <span className="min-w-0"><b className="block truncate text-sm text-slate-900">{product.name}</b><small className="text-slate-500">{currency(product.salePrice)} · stock {product.stock} {product.unit || 'units'}</small></span>
                  <FiPlus className="shrink-0 text-indigo-700" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div>
            <h3 className="font-bold text-slate-900">Buyer and payment</h3>
            <p className="mt-1 text-xs text-slate-500">Choose a walk-in customer or an unconnected store. No buyer account is required.</p>
          </div>
          <label className="block text-sm font-semibold text-slate-700">Sale type
            <select value={buyerType} onChange={(event) => setBuyerType(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal">
              <option value="individual">Walk-in / individual customer</option>
              <option value="store">Supply to an unconnected store</option>
            </select>
          </label>
          {buyerType === 'store' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Store or business name <span className="text-rose-600">required</span>
                <input value={storeName} onChange={(event) => setStoreName(event.target.value)} maxLength={160} required placeholder="Store name" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" />
              </label>
              <label className="text-sm font-semibold text-slate-700">Contact person <span className="font-normal text-slate-400">optional</span>
                <input value={storeContact} onChange={(event) => setStoreContact(event.target.value)} maxLength={120} placeholder="Buyer or receiving contact" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" />
              </label>
              <label className="text-sm font-semibold text-slate-700">Phone <span className="font-normal text-slate-400">optional</span>
                <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} maxLength={40} type="tel" placeholder="Store phone" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" />
              </label>
              <label className="text-sm font-semibold text-slate-700">Delivery address <span className="font-normal text-slate-400">optional</span>
                <input value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} maxLength={240} placeholder="Town, area, or delivery point" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" />
              </label>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Customer name <span className="font-normal text-slate-400">optional</span>
                <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} maxLength={120} placeholder="Walk-in customer" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" />
              </label>
              <label className="text-sm font-semibold text-slate-700">Phone <span className="font-normal text-slate-400">optional</span>
                <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} maxLength={40} type="tel" placeholder="Customer phone" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" />
              </label>
            </div>
          )}
          <div className="space-y-2">
            {cart.map(({ product, quantity }) => (
              <div key={product.supplier_catalog_item_id} className="grid grid-cols-[minmax(0,1fr)_5.5rem_auto_auto] items-center gap-2 rounded-lg bg-slate-50 p-2 text-sm">
                <span className="min-w-0 truncate font-semibold text-slate-800">{product.name}<small className="block font-normal text-slate-500">{currency(product.salePrice)} each</small></span>
                <input aria-label={`${product.name} quantity`} type="number" min="0.001" max={product.stock} step="0.001" value={quantity} onChange={(event) => updateQuantity(product.supplier_catalog_item_id, event.target.value)} className="min-h-10 w-full rounded-md border border-slate-300 px-2 text-right" />
                <b className="whitespace-nowrap">{currency(quantity * product.salePrice)}</b>
                <button type="button" aria-label={`Remove ${product.name}`} onClick={() => setCart((current) => current.filter((line) => line.product.supplier_catalog_item_id !== product.supplier_catalog_item_id))} className="rounded-md p-2 text-rose-600 hover:bg-rose-50"><FiTrash2 /></button>
              </div>
            ))}
            {!cart.length && <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">Choose products to start a sale.</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">Payment method
              <select value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); setAmountPaid(event.target.value === 'credit' ? '0' : ''); }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal">
                <option value="cash">Cash</option><option value="mobile money">Mobile money</option><option value="bank transfer">Bank transfer</option><option value="credit">Credit / pay later</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">Amount paid
              <input type="number" min="0" max={total} step="1" value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} placeholder={currency(total)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" />
            </label>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-lg font-bold text-slate-900"><span>Total</span><span>{currency(total)}</span></div>
          {!isOnline && <p className="text-xs font-medium text-amber-800">Reconnect to save a sale and issue its receipt.</p>}
          <button type="submit" disabled={saving || !cart.length || !supplierAuthId || !isOnline} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 font-bold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-55">
            <FiPrinter />{saving ? 'Saving sale…' : buyerType === 'store' ? 'Complete supply and issue invoice' : 'Save sale and issue receipt'}
          </button>
        </section>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div><h3 className="font-bold text-slate-900">Recent POS sales</h3><p className="text-xs text-slate-500">Receipts and store supply invoices for buyers outside the connected order flow.</p></div>
          <button type="button" onClick={loadHistory} disabled={loadingHistory} className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50" aria-label="Refresh direct sales"><FiRefreshCw className={loadingHistory ? 'animate-spin' : ''} /></button>
        </div>
        {historyError ? <p className="p-5 text-sm text-rose-700">{historyError}</p> : history.length ? (
          <div className="divide-y divide-slate-100">
            {history.map((sale) => (
              <div key={sale.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div><b className="text-sm text-slate-900">{sale.receipt_number}</b><p className="text-xs text-slate-500">{sale.customer_type === 'store' ? sale.business_name || sale.customer_name : sale.customer_name} · {sale.customer_type === 'store' ? 'Store supply' : 'Direct sale'} · {new Date(sale.created_at).toLocaleString('en-UG')}</p></div>
                <div className="flex items-center gap-3"><span className="text-right text-sm"><b>{currency(sale.total_amount)}</b><small className="block capitalize text-slate-500">{sale.payment_status}{Number(sale.balance_due) > 0 ? ` · due ${currency(sale.balance_due)}` : ''}</small></span><button type="button" onClick={() => setReceipt(makeReceiptData(sale))} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-indigo-200 px-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-50"><FiPrinter />Receipt</button></div>
              </div>
            ))}
          </div>
        ) : <p className="p-5 text-sm text-slate-500">No direct supplier sales recorded yet.</p>}
      </section>

      <ReceiptModal isOpen={Boolean(receipt)} saleData={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
};

export default SupplierDirectSales;
