import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, CameraOff, ScanLine, X, Plus, Minus, Trash2,
  ShoppingCart, CheckCircle, Loader, AlertCircle, Coins,
  ReceiptText, QrCode, Store,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../services/supabaseClient';
import {
  getBalance,
  ugxToICAN,
  formatICAN,
  ICAN_TO_UGX,
  sendICAN,
  type ICANBalance,
} from '../services/icanWalletService';
import ProductPicker, { CartLine } from './ProductPicker';
import { verifyPin } from '../../../services/pinService';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Product {
  product_id: string;
  name: string;
  sku: string;
  barcode: string;
  selling_price: number;
  tax_rate: number;
  category_name: string;
  brand: string;
  images: { url: string }[] | null;
  available_stock: number;
  in_stock: boolean;
}

interface CartItem {
  product: Product;
  quantity: number;
  line_total: number;
}

interface CheckoutReceipt {
  transaction_id: string;
  receipt_number: string;
  total_ugx: number;
  tax_ugx: number;
  items_count: number;
  items: Array<{
    product_id: string;
    product_name: string;
    product_sku?: string | null;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    line_total: number;
  }>;
  ican_cashback: {
    success: boolean;
    net_credited?: number;
  } | null;
}

type ScannerState = 'idle' | 'scanning' | 'product_found' | 'cart' | 'checkout' | 'complete';
type PaymentMethod = 'cash' | 'card' | 'mobile_money' | 'ican';
type ShopMode = 'scan' | 'browse';

interface SupermarketRow {
  id: string;
  name: string;
  location: string | null;
  business_type: string;
  owner_user_id: string | null;
}

// Store type filter — supermarkets, hotels, boutiques, and restaurants/cafés
// all live in the same `supermarkets` table (business_type column), so this
// is purely a client-side filter over the one list already loaded.
type BusinessTypeFilter = 'all' | 'supermarket' | 'hotel' | 'boutique' | 'restaurant_cafe';

const BUSINESS_TYPE_FILTERS: { value: BusinessTypeFilter; label: string; emoji: string }[] = [
  { value: 'all', label: 'All', emoji: '🏬' },
  { value: 'supermarket', label: 'Supermarkets', emoji: '🏪' },
  { value: 'hotel', label: 'Hotels', emoji: '🏨' },
  { value: 'boutique', label: 'Boutiques', emoji: '👗' },
  { value: 'restaurant_cafe', label: 'Restaurants', emoji: '🍽️' },
];

const typeEmoji = (t: string) => BUSINESS_TYPE_FILTERS.find(f => f.value === t)?.emoji || '🏪';

// Extend Window for BarcodeDetector (not in standard TS lib yet)
declare global {
  interface Window {
    BarcodeDetector: any;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatUGX(n: number) {
  return `UGX ${n.toLocaleString('en-UG', { maximumFractionDigits: 0 })}`;
}

function cartTotals(cart: CartItem[]) {
  const subtotal = cart.reduce((s, i) => s + i.product.selling_price * i.quantity, 0);
  const includedTax = cart.reduce((s, i) => {
    const rate = Number(i.product.tax_rate ?? 18);
    const gross = i.product.selling_price * i.quantity;
    return s + (rate > 0 ? gross - (gross / (1 + rate / 100)) : 0);
  }, 0);
  // Selling prices already include tax. Tax is shown for transparency only.
  return { subtotal: Math.round(subtotal), tax: Math.round(includedTax), total: Math.round(subtotal) };
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CustomerSelfCheckout({ user }: { user: any }) {
  const [state, setState] = useState<ScannerState>('idle');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);
  const [scanError, setScanError] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [looking, setLooking] = useState(false);
  const [payment, setPayment] = useState<PaymentMethod>('ican');
  const [paymentPurpose, setPaymentPurpose] = useState<'personal' | 'business'>('personal');
  const [businessProfiles, setBusinessProfiles] = useState<Array<{ id: string; business_name: string }>>([]);
  const [businessProfileId, setBusinessProfileId] = useState('');
  const [loadingBusinesses, setLoadingBusinesses] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState('');
  const [receipt, setReceipt] = useState<CheckoutReceipt | null>(null);
  const [icanBalance, setIcanBalance] = useState<ICANBalance | null>(null);
  const [detectorSupported, setDetectorSupported] = useState(false);

  useEffect(() => {
    if (paymentPurpose !== 'business' || !user?.id) return undefined;
    let cancelled = false;
    setLoadingBusinesses(true);
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const [owned, memberships, coOwned] = await Promise.all([
          supabase.from('business_profiles').select('id, business_name').eq('user_id', user.id),
          supabase.from('business_team_members').select('business_profile_id').eq('user_id', user.id).eq('status', 'active'),
          supabase.from('business_co_owners').select('business_profile_id').or(`user_id.eq.${user.id},owner_email.eq.${auth.user?.email || ''}`),
        ]);
        const ids = [...new Set([
          ...(owned.data || []).map(profile => profile.id),
          ...(memberships.data || []).map(member => member.business_profile_id),
          ...(coOwned.data || []).map(member => member.business_profile_id),
        ])];
        const profiles = ids.length ? (await supabase.from('business_profiles').select('id, business_name').in('id', ids)).data || [] : [];
        if (!cancelled) {
          setBusinessProfiles(profiles);
          setBusinessProfileId(prev => prev || (profiles.length === 1 ? profiles[0].id : ''));
        }
      } catch (error) {
        console.error('Unable to load businesses for checkout payment:', error);
      } finally {
        if (!cancelled) setLoadingBusinesses(false);
      }
    })();
    return () => { cancelled = true; };
  }, [paymentPurpose, user?.id]);

  // Browse-a-store mode — real inventory picker as an alternative to scanning
  const [shopMode, setShopMode] = useState<ShopMode>('scan');
  const [supermarkets, setSupermarkets] = useState<SupermarketRow[]>([]);
  const [selectedSupermarketId, setSelectedSupermarketId] = useState('');
  const [typeFilter, setTypeFilter] = useState<BusinessTypeFilter>('all');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const lastBarcodeRef = useRef('');
  const lastScanTimeRef = useRef(0);
  // Tracks which cart product_ids came from the browse picker, so its
  // onCartChange can resync just those lines without touching scanned items.
  const browsedIdsRef = useRef<Set<string>>(new Set());

  // ── ICAN balance ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (user?.id) {
      getBalance(user.id).then(setIcanBalance).catch(() => {});
    }
  }, [user?.id]);

  // ── BarcodeDetector support check ─────────────────────────────────────────

  useEffect(() => {
    setDetectorSupported('BarcodeDetector' in window);
  }, []);

  // ── Supermarket list — the customer must pick one before scanning or
  // browsing, so lookups/checkout are scoped to a real store, not left
  // pre-selected to whichever store happened to load first ────────────────

  useEffect(() => {
    supabase
      .from('supermarkets')
       .select('id, name, location, business_type, owner_user_id')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setSupermarkets(data || []));
  }, []);

  // Store list filtered by the chosen business type — reset the current
  // selection if it no longer belongs to the active filter.
  const filteredSupermarkets = typeFilter === 'all'
    ? supermarkets
    : supermarkets.filter(sm => sm.business_type === typeFilter);

  useEffect(() => {
    if (!selectedSupermarketId) return;
    if (!filteredSupermarkets.some(sm => sm.id === selectedSupermarketId)) {
      setSelectedSupermarketId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  // ── Camera start / stop ───────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    if (!selectedSupermarketId) {
      toast.error('Choose a store first');
      return;
    }
    setScanError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      // Switch to the scanning view first so the <video> element mounts —
      // it only renders when state === 'scanning', so assigning srcObject
      // beforehand hit a null ref and the feed never appeared even though
      // permission had already been granted. The effect below attaches the
      // already-acquired stream the instant the element exists.
      setState('scanning');
    } catch (err: any) {
      setScanError(err.name === 'NotAllowedError'
        ? 'Camera permission denied. Use manual entry below.'
        : 'Camera unavailable. Use manual barcode entry.');
      setState('idle');
    }
  }, [selectedSupermarketId]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // ── Scan loop ─────────────────────────────────────────────────────────────

  const handleBarcode = useCallback(async (code: string) => {
    const now = Date.now();
    if (code === lastBarcodeRef.current && now - lastScanTimeRef.current < 2500) return;
    lastBarcodeRef.current = code;
    lastScanTimeRef.current = now;
    stopCamera();
    setState('idle');
    await lookupProduct(code);
  }, [stopCamera]);

  const scanLoop = useCallback(() => {
    const detect = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }
      try {
        const barcodes = await detectorRef.current.detect(videoRef.current);
        if (barcodes.length > 0) {
          await handleBarcode(barcodes[0].rawValue);
          return;
        }
      } catch {}
      rafRef.current = requestAnimationFrame(detect);
    };
    rafRef.current = requestAnimationFrame(detect);
  }, [handleBarcode]);

  // Attach the already-acquired stream as soon as the video element mounts.
  useEffect(() => {
    if (state !== 'scanning' || !streamRef.current || !videoRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play()
      .then(() => {
        if (detectorSupported) {
          detectorRef.current = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code', 'data_matrix'],
          });
          scanLoop();
        }
      })
      .catch(() => {});
  }, [state, detectorSupported, scanLoop]);

  useEffect(() => {
    return () => {
      stopCamera();
      cancelAnimationFrame(rafRef.current);
    };
  }, [stopCamera]);

  // ── Product lookup ────────────────────────────────────────────────────────

  async function lookupProduct(scan: string) {
    if (!scan.trim()) return;
    if (!selectedSupermarketId) {
      toast.error('Choose a store first');
      return;
    }
    setLooking(true);
    setScanError('');
    setFoundProduct(null);

    const { data, error } = await supabase.rpc('lookup_product_by_barcode', {
      p_scan: scan.trim(),
      p_supermarket_id: selectedSupermarketId,
    });

    setLooking(false);

    if (error || !data || data.length === 0) {
      setScanError(`No product found for "${scan}"`);
      setState('idle');
      return;
    }

    const product = data[0] as Product;

    if (!product.in_stock) {
      setScanError(`${product.name} is out of stock`);
      setState('idle');
      return;
    }

    setFoundProduct(product);
    setManualBarcode('');
    setState('product_found');
  }

  // ── Cart management ───────────────────────────────────────────────────────

  function addToCart(product: Product, qty = 1) {
    setCart(prev => {
      const existing = prev.find(i => i.product.product_id === product.product_id);
      if (existing) {
        const newQty = existing.quantity + qty;
        if (newQty > product.available_stock) {
          toast.error(`Only ${product.available_stock} in stock`);
          return prev;
        }
        return prev.map(i =>
          i.product.product_id === product.product_id
            ? { ...i, quantity: newQty, line_total: product.selling_price * newQty }
            : i,
        );
      }
      return [...prev, { product, quantity: qty, line_total: product.selling_price * qty }];
    });
    setFoundProduct(null);
    setState('cart');
    toast.success(`${product.name} added to cart`);
  }

  // Browse mode's ProductPicker manages its own quantities and reports the
  // full line list on every change — merge those lines into the same cart
  // used for scanning, without touching any scanned-in items. Same
  // public.products.id underlies both paths, so no id translation needed.
  const handleBrowseCartChange = useCallback((lines: CartLine[]) => {
    setCart(prev => {
      const nonBrowsed = prev.filter(i => !browsedIdsRef.current.has(i.product.product_id));
      const browsedItems: CartItem[] = lines.map(l => ({
        product: {
          product_id: l.product.id,
          name: l.product.name,
          sku: l.product.sku || l.product.id,
          barcode: '',
          selling_price: Number(l.product.price_ugx),
          tax_rate: l.product.tax_rate,
          category_name: l.product.category || '',
          brand: '',
          images: l.product.image_url ? [{ url: l.product.image_url }] : null,
          available_stock: l.product.stock_qty,
          in_stock: l.product.stock_qty > 0,
        },
        quantity: l.qty,
        line_total: Number(l.product.price_ugx) * l.qty,
      }));
      browsedIdsRef.current = new Set(lines.map(l => l.product.id));
      return [...nonBrowsed, ...browsedItems];
    });
    if (lines.length > 0) setState(s => (s === 'idle' ? 'cart' : s));
  }, []);

  function updateQty(productId: string, delta: number) {
    setCart(prev =>
      prev
        .map(i => {
          if (i.product.product_id !== productId) return i;
          const newQty = i.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > i.product.available_stock) {
            toast.error(`Only ${i.product.available_stock} in stock`);
            return i;
          }
          return { ...i, quantity: newQty, line_total: i.product.selling_price * newQty };
        })
        .filter(Boolean) as CartItem[],
    );
  }

  // ── Checkout ──────────────────────────────────────────────────────────────

  async function submitCheckout() {
    if (cart.length === 0) return;
    if (!user?.id) {
      toast.error('Please sign in to pay with IcanEra Wallet.');
      return;
    }

    setPinValue('');
    setPinError('');
    setPinDialogOpen(true);
  }

  async function confirmPinPayment() {
    if (paymentPurpose === 'business' && businessProfiles.length > 1 && !businessProfileId) {
      setPinError('Select which business this payment belongs to.');
      return;
    }
    if (!/^\d{4,6}$/.test(pinValue)) {
      setPinError('Enter your 4–6 digit IcanEra Wallet PIN.');
      return;
    }

    setSubmitting(true);
    setPinError('');
    let completedTransfer: any = null;
    let saleFinalized = false;

    try {
      const pinCheck = await verifyPin(user.id, pinValue);
      if (!pinCheck.success) {
        setPinError(pinCheck.error || 'PIN verification failed. Payment was not sent.');
        return;
      }

      const cartPayload = cart.map(i => ({
        product_id: i.product.product_id,
        quantity: i.quantity,
        // The RPC expects a pre-tax unit price and adds the store/product tax.
        // Convert the tax-inclusive shelf price back to its net price so the
        // final charged amount remains exactly the displayed price.
        unit_price: i.product.selling_price / (1 + Number(i.product.tax_rate ?? 18) / 100),
        tax_rate: Number(i.product.tax_rate ?? 18),
      }));

      const storeUserId = selectedSupermarket?.owner_user_id;
      if (!storeUserId) {
        setPinError('This store has no active wallet recipient configured. Please choose another store.');
        return;
      }

      // The customer wallet is the payer and the selected store owner is the
      // recipient. This is the same real wallet send operation used by IcanEra.
      completedTransfer = await sendICAN({
        fromUserId: user.id,
        toUserId: storeUserId,
        amount: ugxToICAN(totals.total),
        note: `Store purchase at ${selectedSupermarket?.name || 'store'}`,
        referenceId: `SHOP-${Date.now()}`,
        localAmount: totals.total,
        localCurrency: 'UGX',
        merchantName: selectedSupermarket?.name || 'SupermartKera',
        counterpartyType: 'business',
        expenseClassification: paymentPurpose === 'business' ? 'business_expense' : 'personal_expense',
        businessProfileId: businessProfileId || null,
      });

      // The wallet transfer above is already complete. The checkout RPC now
      // records the sale and updates inventory without debiting the wallet a
      // second time.
      const { data, error } = await supabase.rpc('customer_self_checkout', {
        p_cart: cartPayload,
        p_payment_method: 'ican',
        p_pay_with_ican: false,
      });

      if (error || !data?.success) {
        throw new Error(error?.message ?? data?.error ?? 'Checkout failed');
      }
      saleFinalized = true;

      setReceipt({
        transaction_id: data.transaction_id || completedTransfer?.transaction_id,
        receipt_number: data.receipt_number,
        total_ugx: data.total_ugx,
        tax_ugx: data.tax_ugx,
        items_count: data.items_count,
        items: data.items?.length ? data.items : cart.map(i => ({
          product_id: i.product.product_id,
          product_name: i.product.name,
          product_sku: i.product.sku,
          quantity: i.quantity,
          unit_price: i.product.selling_price,
          tax_rate: i.product.tax_rate,
          line_total: i.line_total,
        })),
        ican_cashback: data.ican_cashback,
      });

      // Refresh ICAN balance after the real wallet debit.
      getBalance(user.id).then(setIcanBalance).catch(() => {});

      setPinDialogOpen(false);
      setPinValue('');
      setCart([]);
      setState('complete');
    } catch (error: any) {
      // If the real wallet transfer succeeded but sale/inventory finalization
      // failed, return the funds to the customer so payment and stock cannot
      // become inconsistent.
      if (completedTransfer && !saleFinalized && selectedSupermarket?.owner_user_id) {
        try {
          await sendICAN({
            fromUserId: selectedSupermarket.owner_user_id,
            toUserId: user.id,
            amount: ugxToICAN(totals.total),
            note: 'Automatic refund for failed store checkout',
            referenceId: `REFUND-${Date.now()}`,
          });
        } catch (refundError: any) {
          console.error('Automatic ICAN refund failed:', refundError);
          setPinError(`${error?.message || 'Checkout failed'} Funds were sent, but automatic refund failed. Contact support.`);
          return;
        }
      }
      setPinError(error?.message || 'Payment failed. No inventory was deducted.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  function reset() {
    stopCamera();
    setCart([]);
    setFoundProduct(null);
    setScanError('');
    setManualBarcode('');
    setReceipt(null);
    setPayment('ican');
    setPaymentPurpose('personal');
    setBusinessProfiles([]);
    setBusinessProfileId('');
    setState('idle');
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const totals = cartTotals(cart);
  const icanNeeded = ugxToICAN(totals.total);
  const canPayICAN = (icanBalance?.ican ?? 0) >= icanNeeded;
  const selectedSupermarket = supermarkets.find(sm => sm.id === selectedSupermarketId) || null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── ICAN Balance strip ─────────────────────────────────────────── */}
      {icanBalance && (
        <div className="flex items-center justify-between bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-xl px-5 py-3">
          <div className="flex items-center gap-2">
            <Coins size={18} />
            <span className="font-semibold text-sm">ICAN Wallet</span>
          </div>
          <div className="text-right">
            <p className="font-bold">₡ {formatICAN(icanBalance.ican)} ICAN</p>
            <p className="text-xs opacity-80">{formatUGX(icanBalance.ugx)}</p>
          </div>
        </div>
      )}

      {/* ── Receipt ────────────────────────────────────────────────────── */}
      {state === 'complete' && receipt && (
        <div className="bg-white rounded-2xl shadow-xl p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-500" size={32} />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-1">Order Complete!</h3>
          <p className="text-slate-500 text-sm mb-6">Your items are ready</p>

          <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Transaction #</span>
              <span className="font-mono font-semibold text-xs text-slate-900">{receipt.transaction_id?.slice(-12)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Receipt #</span>
              <span className="font-mono font-semibold text-slate-900">{receipt.receipt_number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Items</span>
              <span className="font-semibold text-slate-900">{receipt.items_count}</span>
            </div>
            {receipt.items?.map((item, index) => (
              <div key={`${item.product_id}-${index}`} className="flex justify-between gap-3 text-sm border-t border-slate-200 pt-2">
                <span className="text-slate-900">
                  {item.product_name || 'Product'} × {item.quantity}
                </span>
                <span className="font-semibold text-slate-900 whitespace-nowrap">
                  {formatUGX(item.line_total)}
                </span>
              </div>
            ))}
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Tax</span>
              <span className="text-slate-900">{formatUGX(receipt.tax_ugx)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t pt-2">
              <span>Total Paid</span>
              <span className="text-orange-600">{formatUGX(receipt.total_ugx)}</span>
            </div>
          </div>

          {receipt.ican_cashback?.success && receipt.ican_cashback.net_credited && (
            <div className="flex items-center gap-2 justify-center bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 mb-4">
              <Coins className="text-orange-500" size={16} />
              <span className="text-sm font-semibold text-orange-700">
                +₡ {formatICAN(receipt.ican_cashback.net_credited)} ICAN cashback earned!
              </span>
            </div>
          )}

          <button
            onClick={reset}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-yellow-600 transition-all"
          >
            Start New Shop
          </button>
        </div>
      )}

      {/* ── Idle / Scan entry ──────────────────────────────────────────── */}
      {(state === 'idle' || state === 'product_found' || state === 'cart' || state === 'checkout') && (
        <>
          {/* Store picker — required before scanning OR browsing, so lookups
              and checkout are always scoped to a real, chosen supermarket */}
          {state !== 'scanning' && (
            <div className="bg-white rounded-2xl shadow-md p-4 space-y-3">
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {BUSINESS_TYPE_FILTERS.map(f => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setTypeFilter(f.value)}
                    className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                      typeFilter === f.value ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <span>{f.emoji}</span> {f.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5">
                  <Store size={13} /> Shopping at
                </label>
                <select
                  value={selectedSupermarketId}
                  onChange={e => setSelectedSupermarketId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-300"
                >
                  <option value="">Choose your store…</option>
                  {filteredSupermarkets.map(sm => (
                    <option key={sm.id} value={sm.id}>
                      {typeEmoji(sm.business_type)} {sm.name}{sm.location ? ` — ${sm.location}` : ''}
                    </option>
                  ))}
                </select>
                {filteredSupermarkets.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1.5">No stores of this type yet.</p>
                )}
              </div>
            </div>
          )}

          {/* Scan vs Browse mode toggle */}
          {state !== 'scanning' && (
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => setShopMode('scan')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  shopMode === 'scan' ? 'bg-white shadow text-slate-800' : 'text-slate-500'
                }`}
              >
                <ScanLine size={15} /> Scan
              </button>
              <button
                onClick={() => setShopMode('browse')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  shopMode === 'browse' ? 'bg-white shadow text-slate-800' : 'text-slate-500'
                }`}
              >
                <Store size={15} /> View
              </button>
            </div>
          )}

          {/* Browse-a-store panel — real inventory, no scanning needed */}
          {shopMode === 'browse' && state !== 'scanning' && (
            <div className="bg-white rounded-2xl shadow-md p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Store className="text-orange-500" size={20} />
                    View Store
                  </h3>
                  {selectedSupermarket && (
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Store size={11} /> Viewing {selectedSupermarket.name}
                    </p>
                  )}
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={() => setState('cart')}
                    className="flex items-center gap-1 text-sm text-orange-600 font-semibold"
                  >
                    <ShoppingCart size={16} />
                    Cart ({cart.length})
                  </button>
                )}
              </div>
              {selectedSupermarketId ? (
                <ProductPicker supermarketId={selectedSupermarketId} onCartChange={handleBrowseCartChange} />
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">Choose a store above to see its products.</p>
              )}
            </div>
          )}

          {/* Camera scanning panel */}
          {shopMode === 'scan' && (state === 'scanning' || (
            <div className="bg-white rounded-2xl shadow-md p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <ScanLine className="text-orange-500" size={20} />
                    Scan a Product
                  </h3>
                  {selectedSupermarket && (
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Store size={11} /> Scanning at {selectedSupermarket.name}
                    </p>
                  )}
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={() => setState('cart')}
                    className="flex items-center gap-1 text-sm text-orange-600 font-semibold"
                  >
                    <ShoppingCart size={16} />
                    Cart ({cart.length})
                  </button>
                )}
              </div>

              {!selectedSupermarketId && (
                <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                  Choose a store above before scanning.
                </p>
              )}

              {/* Camera button */}
              <button
                onClick={startCamera}
                disabled={looking || !selectedSupermarketId}
                className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-yellow-600 transition-all mb-3 disabled:opacity-50"
              >
                <Camera size={22} />
                {detectorSupported ? 'Scan Barcode with Camera' : 'Open Camera (manual entry)'}
              </button>

              {/* Manual barcode entry */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type or paste barcode / SKU"
                  value={manualBarcode}
                  onChange={e => setManualBarcode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && selectedSupermarketId && lookupProduct(manualBarcode)}
                  disabled={!selectedSupermarketId}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:bg-slate-50 disabled:text-slate-400"
                />
                <button
                  onClick={() => lookupProduct(manualBarcode)}
                  disabled={!manualBarcode.trim() || looking || !selectedSupermarketId}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-40"
                >
                  {looking ? <Loader size={16} className="animate-spin" /> : <QrCode size={16} />}
                </button>
              </div>

              {scanError && (
                <div className="flex items-center gap-2 mt-3 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
                  <AlertCircle size={15} />
                  {scanError}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* ── Camera live view ────────────────────────────────────────────── */}
      {state === 'scanning' && (
        <div className="bg-black rounded-2xl overflow-hidden relative">
          <video
            ref={videoRef}
            className="w-full object-cover"
            style={{ maxHeight: '60vh' }}
            playsInline
            muted
          />
          {/* Store badge — makes it explicit which supermarket the scan is scoped to */}
          {selectedSupermarket && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full">
              <Store size={12} className="text-orange-400" />
              {selectedSupermarket.name}
            </div>
          )}
          {/* Crosshair overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-2 border-orange-400 rounded-lg opacity-80">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-orange-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-orange-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-orange-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-orange-400 rounded-br-lg" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 p-4">
            <p className="text-white text-center text-sm mb-3">
              {detectorSupported
                ? 'Point camera at product barcode'
                : 'Camera open — type barcode below'}
            </p>
            {/* Manual entry while camera is open */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type barcode / SKU"
                value={manualBarcode}
                onChange={e => setManualBarcode(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    stopCamera();
                    setState('idle');
                    lookupProduct(manualBarcode);
                  }
                }}
                className="flex-1 bg-white/20 text-white placeholder-white/60 border border-white/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:bg-white/30"
              />
              <button
                onClick={() => {
                  stopCamera();
                  setState('idle');
                  lookupProduct(manualBarcode);
                }}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold"
              >
                Go
              </button>
            </div>
            <button
              onClick={() => { stopCamera(); setState('idle'); }}
              className="mt-3 w-full flex items-center justify-center gap-2 text-white/80 hover:text-white text-sm"
            >
              <CameraOff size={16} /> Cancel Scan
            </button>
          </div>
        </div>
      )}

      {/* ── Product found card ──────────────────────────────────────────── */}
      {state === 'product_found' && foundProduct && (
        <div className="bg-white rounded-2xl shadow-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">Product Found</h3>
            <button
              onClick={() => { setFoundProduct(null); setState('idle'); }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex gap-4 mb-5">
            {foundProduct.images?.[0]?.url ? (
              <img
                src={foundProduct.images[0].url}
                alt={foundProduct.name}
                className="w-20 h-20 object-cover rounded-xl border border-slate-100"
              />
            ) : (
              <div className="w-20 h-20 bg-orange-50 rounded-xl flex items-center justify-center border border-orange-100">
                <ShoppingCart className="text-orange-300" size={32} />
              </div>
            )}
            <div className="flex-1">
              <p className="font-bold text-slate-800 text-lg leading-tight">{foundProduct.name}</p>
              {foundProduct.brand && (
                <p className="text-slate-500 text-sm">{foundProduct.brand}</p>
              )}
              <p className="text-xs text-slate-400 mt-1">{foundProduct.category_name} · SKU: {foundProduct.sku}</p>
              <p className="text-orange-600 font-bold text-xl mt-2">
                {formatUGX(foundProduct.selling_price)}
              </p>
              <p className="text-xs text-slate-400">
                {foundProduct.available_stock} in stock · {foundProduct.tax_rate}% tax included
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => addToCart(foundProduct)}
              className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-yellow-600 transition-all"
            >
              Add to Cart
            </button>
            <button
              onClick={() => { setFoundProduct(null); setState('idle'); startCamera(); }}
              className="px-4 py-3 bg-slate-100 text-slate-600 font-semibold rounded-xl hover:bg-slate-200 transition-all"
            >
              <ScanLine size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── Cart ───────────────────────────────────────────────────────── */}
      {(state === 'cart' || state === 'checkout') && cart.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Cart header */}
          <div className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} />
              <span className="font-semibold">Your Cart ({cart.length} items)</span>
            </div>
            <button
              onClick={() => setState('idle')}
              className="text-white/80 hover:text-white"
            >
              <ScanLine size={18} />
            </button>
          </div>

          {/* Cart items */}
          <div className="divide-y divide-slate-100">
            {cart.map(item => (
              <div key={item.product.product_id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{item.product.name}</p>
                  <p className="text-xs text-slate-400">{formatUGX(item.product.selling_price)} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQty(item.product.product_id, -1)}
                    className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors"
                  >
                    {item.quantity === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                  </button>
                  <span className="w-6 text-center font-bold text-slate-700 text-sm">{item.quantity}</span>
                  <button
                    onClick={() => updateQty(item.product.product_id, 1)}
                    className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center hover:bg-green-100 hover:text-green-600 transition-colors"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <span className="w-24 text-right font-bold text-slate-800 text-sm">
                  {formatUGX(item.line_total)}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 space-y-1">
            <div className="flex justify-between text-sm text-slate-500">
              <span>Subtotal</span><span>{formatUGX(totals.subtotal)}</span>
            </div>
              <div className="flex justify-between text-sm text-slate-500">
                <span>Tax included</span><span>{formatUGX(totals.tax)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-800 text-base border-t border-slate-200 pt-2">
              <span>Total</span>
              <span className="text-orange-600">{formatUGX(totals.total)}</span>
            </div>
          </div>

          {/* Add more items — scan or keep browsing, depending on mode */}
          <div className="px-5 py-3 border-t border-slate-100">
            <button
              onClick={() => { setState('idle'); if (shopMode === 'scan') startCamera(); }}
              className="w-full py-2.5 border-2 border-dashed border-orange-300 text-orange-600 font-semibold rounded-xl hover:bg-orange-50 transition-colors text-sm flex items-center justify-center gap-2"
            >
              {shopMode === 'browse' ? <><Store size={16} /> Add More Items</> : <><ScanLine size={16} /> Scan More Items</>}
            </button>
          </div>

          {/* Payment method */}
          <div className="px-5 pb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Pay with</p>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => canPayICAN && setPayment('ican')}
                disabled={!canPayICAN}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  payment === 'ican'
                    ? 'bg-orange-500 text-white'
                    : canPayICAN
                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                }`}
              >
                <Coins size={14} />
                IcanEra Wallet
                {!canPayICAN && (
                  <span className="text-xs opacity-70 block">
                    (need ₡{formatICAN(icanNeeded)})
                  </span>
                )}
              </button>
            </div>

            {payment !== 'ican' && (
              <p className="text-xs text-green-600 mt-2 text-center">
                You'll earn ~₡{formatICAN(ugxToICAN(totals.total * 0.01))} ICAN cashback (1%)
              </p>
            )}
          </div>

          {/* Checkout button */}
          <div className="px-5 pb-5">
            <button
              onClick={submitCheckout}
              disabled={submitting}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-yellow-600 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 text-base"
            >
              {submitting ? (
                <><Loader size={20} className="animate-spin" /> Processing...</>
              ) : (
                <><ReceiptText size={20} /> Pay {formatUGX(totals.total)}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Empty state (after idle with no products scanned) ──────────── */}
      {state === 'idle' && cart.length === 0 && !foundProduct && !looking && (
        <div className="text-center py-10 bg-white rounded-2xl shadow-md">
          <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="text-orange-300" size={32} />
          </div>
          <h4 className="font-semibold text-slate-700 mb-1">Your cart is empty</h4>
          <p className="text-sm text-slate-500">
            {shopMode === 'browse' ? 'Tap a product above to add it' : 'Scan a barcode to add items'}
          </p>
        </div>
      )}

      {pinDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={e => { e.preventDefault(); if (!submitting) confirmPinPayment(); }}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 text-center">
              <h3 className="text-xl font-bold text-slate-800">Authorize IcanEra Payment</h3>
              <p className="mt-1 text-sm text-slate-500">
                Enter your wallet PIN to pay {formatUGX(totals.total)}.
              </p>
            </div>
            <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="checkout-pin">
              Wallet PIN
            </label>
            <input
              id="checkout-pin"
              autoFocus
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={pinValue}
              onChange={e => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Report this payment as</p>
              <div className="grid grid-cols-2 gap-2">
                {([{ value: 'business', label: '💼 Business' }, { value: 'personal', label: '👤 Personal' }] as const).map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPaymentPurpose(option.value)}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${paymentPurpose === option.value ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {paymentPurpose === 'business' && (
                <div className="mt-3">
                  {loadingBusinesses ? <p className="text-xs text-slate-500">Loading your businesses…</p> : businessProfiles.length > 1 ? (
                    <select value={businessProfileId} onChange={e => setBusinessProfileId(e.target.value)} className="w-full rounded-xl border border-blue-300 px-3 py-2 text-sm text-slate-700">
                      <option value="">Select which business this belongs to…</option>
                      {businessProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.business_name}</option>)}
                    </select>
                  ) : businessProfiles.length === 1 ? <p className="text-xs text-blue-700">Tagged to {businessProfiles[0].business_name}</p> : null}
                </div>
              )}
            </div>
            {pinError && <p className="mt-2 text-sm text-red-600">{pinError}</p>}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => { setPinDialogOpen(false); setPinValue(''); setPinError(''); }}
                disabled={submitting}
                className="flex-1 rounded-xl bg-slate-100 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || pinValue.length < 4}
                className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Verifying…' : 'Authorize Payment'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
