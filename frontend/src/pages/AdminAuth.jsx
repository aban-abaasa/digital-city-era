import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import '../styles/classic-auth.css';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiShield, FiBriefcase, FiUsers, FiArrowRight, FiArrowLeft,
  FiLogIn, FiMapPin, FiPhone, FiMail, FiEye, FiEyeOff,
  FiCheck, FiCopy, FiPackage, FiRefreshCw, FiSun, FiMoon
} from 'react-icons/fi';
import { supabase } from '../services/supabase';
import { useTheme } from '../contexts/ThemeContext';

// ─── helpers ────────────────────────────────────────────────────────────────
const STEPS = ['Business type', 'Store details', 'Location', 'Review'];

// Every business type reuses the exact same store/product/staff/delivery
// plumbing — this map only drives copy, placeholders, and the emoji shown in
// the UI. Keep in sync with the CHECK constraint on supermarkets.business_type
// (ADD_BUSINESS_TYPE_TO_SUPERMARKETS.sql).
export const BUSINESS_TYPES = [
  {
    value: 'supermarket', emoji: '🏪', label: 'Supermarket',
    blurb: 'Groceries, electronics, general retail',
    namePlaceholder: 'e.g. City Fresh Market',
    nameLabel: 'Supermarket name *',
    descPlaceholder: 'What do you sell? Fresh produce, electronics, groceries…',
    itemsLabel: 'products',
  },
  {
    value: 'pharmacy', emoji: '💊', label: 'Pharmacy',
    blurb: 'Medicines, health, and wellness products',
    namePlaceholder: 'e.g. Sunrise Pharmacy',
    nameLabel: 'Pharmacy name *',
    descPlaceholder: 'What do you offer? Prescription medicines, wellness products, medical supplies…',
    itemsLabel: 'medicines & products',
  },
  {
    value: 'hotel', emoji: '🏨', label: 'Hotel',
    blurb: 'Rooms and guest services',
    namePlaceholder: 'e.g. Lakeview Hotel',
    nameLabel: 'Hotel name *',
    descPlaceholder: 'What rooms or services do you offer? Standard rooms, suites, room service…',
    itemsLabel: 'rooms & services',
  },
  {
    value: 'boutique', emoji: '👗', label: 'Boutique',
    blurb: 'Fashion, accessories, retail items',
    namePlaceholder: 'e.g. Kampala Boutique',
    nameLabel: 'Boutique name *',
    descPlaceholder: 'What do you sell? Clothing, shoes, accessories…',
    itemsLabel: 'items',
  },
  {
    value: 'restaurant_cafe', emoji: '🍽️', label: 'Restaurant & Café',
    blurb: 'Food, drinks, and dine-in or takeaway menus',
    namePlaceholder: 'e.g. Sunrise Café',
    nameLabel: 'Restaurant / café name *',
    descPlaceholder: "What's on your menu? Meals, snacks, drinks…",
    itemsLabel: 'menu',
  },
  {
    value: 'wholesale', emoji: '📦', label: 'Wholesale',
    blurb: 'Bulk stock, distribution, and business-to-business supply',
    namePlaceholder: 'e.g. Kampala Wholesale Hub',
    nameLabel: 'Wholesale business name *',
    descPlaceholder: 'What do you supply? Bulk groceries, raw materials, equipment…',
    itemsLabel: 'wholesale products',
  },
  {
    value: 'hardware', emoji: '🔧', label: 'Hardware',
    blurb: 'Tools, building supplies, and equipment',
    namePlaceholder: 'e.g. Central Hardware Store',
    nameLabel: 'Hardware store name *',
    descPlaceholder: 'What do you stock? Tools, plumbing, electrical, building materials…',
    itemsLabel: 'hardware products',
  },
  {
    value: 'factory', emoji: '🏭', label: 'Factory / Manufacturing',
    blurb: 'Production, finished goods, and raw-material supply',
    namePlaceholder: 'e.g. Kampala Foods Factory',
    nameLabel: 'Factory name *',
    descPlaceholder: 'What do you manufacture or supply? Finished goods, components, raw materials…',
    itemsLabel: 'manufactured products',
  },
  {
    value: 'laundry', emoji: '🧺', label: 'Laundry',
    blurb: 'Drop-off laundry, dry cleaning, and pressing services',
    namePlaceholder: 'e.g. Kampala Laundry Hub',
    nameLabel: 'Laundry business name *',
    descPlaceholder: 'What services do you offer? Wash & fold, dry cleaning, ironing…',
    itemsLabel: 'services',
  },
];

const WHOLESALE_CATEGORIES = [
  'Products', 'Services', 'Raw materials', 'Building materials', 'Tools & equipment',
  'Agriculture & livestock', 'Food & beverages', 'Office supplies', 'Transport & logistics', 'Other'
];

const businessTypeInfo = (value) => BUSINESS_TYPES.find(t => t.value === value) || BUSINESS_TYPES[0];

// One set of colours for the white-card look and the dark-theme look, so every control reads
// the same way. Secondary text is slate-500 (not 400) on white: 400 is too faint to read.
const UI = {
  title: 'text-slate-900 dark:text-white',
  muted: 'text-slate-500 dark:text-slate-400',
  label: 'text-slate-600 dark:text-slate-300',
  control: 'bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500',
  divider: 'border-slate-100 dark:border-slate-700/60',
  ghostButton: 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
  link: 'text-emerald-700 dark:text-emerald-400',
};

const ERROR_TEXT = 'text-xs text-red-600 dark:text-red-400';

// The label is tied to its input (click it, or use a screen reader) and an error is announced
// and linked to the field it belongs to.
function Field({ label, icon: Icon, error, id, required, ...props }) {
  const autoId = useId();
  const fieldId = id || autoId;
  const errorId = `${fieldId}-error`;
  return (
    <div className="space-y-1">
      <label htmlFor={fieldId} className={`block text-xs font-semibold uppercase tracking-wide ${UI.label}`}>{label}</label>
      <div className="relative">
        {Icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
            <Icon size={15} />
          </span>
        )}
        <input
          id={fieldId}
          aria-required={required || undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`w-full ${Icon ? 'pl-9' : 'pl-4'} pr-4 py-3 rounded-xl border text-sm ${UI.control}
            outline-none transition-all
            ${error
              ? 'border-red-300 dark:border-red-400/70 focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-500/20'
              : 'border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 dark:focus:ring-emerald-400/20'
            }`}
          {...props}
        />
      </div>
      {error && <p id={errorId} role="alert" className={ERROR_TEXT}>{error}</p>}
    </div>
  );
}

// A heading for one block of the review, with a way back to the step it came from
function ReviewBlock({ title, onEdit, children }) {
  return (
    <section className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4">
      <div className="mb-1 flex items-center justify-between">
        <h3 className={`font-sans text-xs font-bold uppercase tracking-wide ${UI.muted}`}>{title}</h3>
        <button type="button" onClick={onEdit} aria-label={`Edit ${title.toLowerCase()}`} className={`text-xs font-semibold hover:underline ${UI.link}`}>Edit</button>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Row({ label, value }) {
  return (
    <div className={`flex justify-between gap-3 py-1.5 border-b ${UI.divider} last:border-0`}>
      <span className={`${UI.muted} text-sm shrink-0`}>{label}</span>
      <span className="text-slate-800 dark:text-slate-100 text-sm font-medium text-right break-words min-w-0">{value || '—'}</span>
    </div>
  );
}

const DRAFT_KEY = 'adminSetupDraft';
const readDraft = () => {
  try {
    const draft = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY));
    return draft && typeof draft === 'object' ? draft : {};
  } catch {
    return {};
  }
};
const writeDraft = (form) => {
  try { window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch { /* private mode: nothing to keep */ }
};
const clearDraft = () => {
  try { window.sessionStorage.removeItem(DRAFT_KEY); } catch { /* nothing to clear */ }
};

// ─── main component ──────────────────────────────────────────────────────────
export default function AdminAuth() {
  const navigate = useNavigate();

  // view: 'loading' | 'create' | 'signin' | 'success'
  const [view, setView] = useState('loading');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState(null);
  const [session, setSession] = useState(null);
  const [businessProfiles, setBusinessProfiles] = useState([]);
  const [selectedBusinessProfileId, setSelectedBusinessProfileId] = useState('');
  const [profilesLoading, setProfilesLoading] = useState(false);

  const { theme, toggleTheme } = useTheme();

  // What has been typed is kept for this browser tab, so leaving to check something (or an accidental
  // refresh) doesn't mean starting again. It is cleared once the store is created.
  const [form, setForm] = useState(() => ({
    businessType: 'supermarket',
    storeName: '', description: '', storePhone: '', storeEmail: '',
    address: '', city: '', country: 'Uganda',
    wholesaleCategories: ['Products'], wholesalePricingMode: 'supplier_price',
    ...readDraft(),
  }));
  const formRef = useRef(null);
  const headingRef = useRef(null);
  const [signin, setSignin] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };
  const typeInfo = businessTypeInfo(form.businessType);

  const selectBusinessProfile = (profileId) => {
    setSelectedBusinessProfileId(profileId);
    const profile = businessProfiles.find((item) => item.id === profileId);
    if (!profile) return;
    const type = String(profile.business_type || '').toLowerCase();
    const matchingType = BUSINESS_TYPES.find((item) => type.includes(item.value) || (item.value === 'restaurant_cafe' && /restaurant|cafe/.test(type)));
    setForm((current) => ({
      ...current,
      storeName: profile.business_name || current.storeName,
      businessType: matchingType?.value || current.businessType,
    }));
  };

  // This is the same authority check CMMS uses.  Showing it during setup
  // means an owner can intentionally reuse their Pichin business instead of
  // creating a second wallet and business identity for the new store.
  const loadBusinessProfiles = useCallback(async (activeSession) => {
    if (!activeSession?.user) return;
    setProfilesLoading(true);
    try {
      const user = activeSession.user;
      const { data: publicUser } = await supabase
        .from('users').select('id').or(`auth_id.eq.${user.id},id.eq.${user.id}`).limit(1).maybeSingle();
      const ids = [...new Set([user.id, publicUser?.id].filter(Boolean))];
      const { data: owned, error: ownedError } = await supabase
        .from('business_profiles').select('id, business_name, business_type, status, created_at').in('user_id', ids).eq('status', 'active');
      if (ownedError) throw ownedError;
      const checks = await Promise.all((owned || []).map(async profile => {
        const { data: canManage } = await supabase.rpc('ican_business_admin', { p_business_profile_id: profile.id });
        return canManage ? profile : null;
      }));
      setBusinessProfiles(checks.filter(Boolean).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
    } catch (error) {
      console.warn('Could not load Pichin business profiles:', error.message);
      setBusinessProfiles([]);
    } finally {
      setProfilesLoading(false);
    }
  }, []);

  // ── on mount: check session ────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!alive) return;

      if (!s) {
        setView('signin');
        return;
      }

      setSession(s);
      setForm(f => ({ ...f, storeEmail: f.storeEmail || s.user.email || '' }));
      loadBusinessProfiles(s);

      // If this session already belongs to a fully set-up admin, send them
      // straight to their own portal — never show "create a supermarket"
      // again, and never let a stray/shared session land someone in a
      // system that isn't a fresh one for them.
      const uid = s.user.id;
      const { data: userData } = await supabase
        .from('users').select('role, supermarket_id').eq('auth_id', uid).maybeSingle();
      const metaRole = s.user.user_metadata?.role || s.user.app_metadata?.role;
      let isAdmin = (userData?.role === 'admin' || metaRole === 'admin') && !!userData?.supermarket_id;

      // users.supermarket_id can outlive its store. Such an admin has nothing
      // to go back to, so let them set a store up instead of bouncing them to
      // a portal with no business account. A failed lookup keeps the redirect.
      if (isAdmin) {
        const { data: store, error: storeError } = await supabase
          .from('supermarkets').select('id')
          .or(`id.eq.${userData.supermarket_id},owner_user_id.eq.${uid}`)
          .limit(1).maybeSingle();
        if (!storeError && !store) isAdmin = false;
      }

      if (!alive) return;
      if (isAdmin) {
        navigate('/admin-portal', { replace: true });
        return;
      }

      setView('create');
    })();
    return () => { alive = false; };
  }, [navigate, loadBusinessProfiles]);

  // ── sign-in ────────────────────────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!signin.email || !signin.password) {
      toast.error('Enter your email and password');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: signin.email,
        password: signin.password,
      });
      if (error) throw error;
      setSession(data.session);
      setForm(f => ({ ...f, storeEmail: f.storeEmail || data.user.email || '' }));
      loadBusinessProfiles(data.session);

      const uid = data.user.id;

      // Check the users table (try auth_id first, fall back to id)
      let userData = null;
      const { data: ud1, error: udErr1 } = await supabase
        .from('users').select('role').eq('auth_id', uid).maybeSingle();
      if (!udErr1) { userData = ud1; }
      else {
        const { data: ud2 } = await supabase
          .from('users').select('role').eq('id', uid).maybeSingle();
        userData = ud2;
      }

      const metaRole = data.user.user_metadata?.role || data.user.app_metadata?.role;
      const isAdmin = userData?.role === 'admin' || metaRole === 'admin';

      // Repair: if they own a supermarket but role wasn't set, fix it now
      if (!isAdmin) {
        const { data: sm } = await supabase
          .from('supermarkets').select('id').eq('owner_user_id', uid).maybeSingle();
        if (sm) {
          const fix = { role: 'admin', updated_at: new Date().toISOString() };
          const { error: fe } = await supabase.from('users').update(fix).eq('auth_id', uid);
          if (fe) await supabase.from('users').update(fix).eq('id', uid);
          await supabase.auth.updateUser({ data: { role: 'admin' } });
          toast.success('Welcome back!');
          navigate('/admin-portal', { replace: true });
          return;
        }
      }

      if (isAdmin) {
        toast.success('Welcome back!');
        navigate('/admin-portal', { replace: true });
      } else {
        setView('create');
      }
    } catch (err) {
      toast.error(err.message || 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  // ── validate per step ─────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (step === 1) {
      if (!selectedBusinessProfileId && !form.storeName.trim()) e.storeName = 'Store name is required';
    }
    if (step === 2) {
      if (!selectedBusinessProfileId && !form.address.trim()) e.address = 'Street address is required';
      if (!selectedBusinessProfileId && !form.city.trim()) e.city = 'City is required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate()) setStep(s => s + 1); };
  const back = () => setStep(s => s - 1);

  // Enter moves on (or launches on the last step); a second Enter while launching does nothing
  const submitStep = (e) => {
    e.preventDefault();
    if (busy) return;
    if (step < STEPS.length - 1) next();
    else handleCreate();
  };

  useEffect(() => { if (view !== 'success') writeDraft(form); }, [form, view]);

  // A step that fails its checks puts the cursor on the first field to fix
  useEffect(() => {
    if (Object.values(errors).some(Boolean)) formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [errors]);

  // A new step starts at its heading (what a screen reader reads first), and on a computer with the
  // cursor in its first field. On a phone the keyboard stays down until a field is tapped.
  useEffect(() => {
    if (view !== 'create' || step === 0) return;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView?.({ block: 'nearest' });
    if (window.matchMedia?.('(pointer: fine)').matches) formRef.current?.querySelector('input:not([type="radio"]), textarea, select')?.focus();
  }, [step, view]);

  // ── submit / create supermarket ───────────────────────────────────────────
  const handleCreate = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      if (!session) {
        toast.error('Please sign in first');
        setView('signin');
        return;
      }

      // Current deployments accept business type. Some already-live projects
      // still expose the seven-argument RPC, so retry that compatible shape
      // instead of leaving setup blocked with a PostgREST 400.
      const onboardingPayload = {
        p_name:          form.storeName.trim(),
        p_description:   form.description.trim() || null,
        p_phone:         form.storePhone.trim() || null,
        p_email:         form.storeEmail.trim() || null,
        p_address:       form.address.trim(),
        p_city:          form.city.trim(),
        p_country:       form.country,
        p_business_type: form.businessType,
      };
      let { data, error } = await supabase.rpc('onboard_supermarket', onboardingPayload);
      const missingTypedRpc = error?.code === 'PGRST202' || /could not find the function|p_business_type/i.test(error?.message || '');
      if (error && missingTypedRpc) {
        const legacyPayload = { ...onboardingPayload };
        delete legacyPayload.p_business_type;
        ({ data, error } = await supabase.rpc('onboard_supermarket', legacyPayload));
        if (!error && form.businessType !== 'supermarket' && data?.supermarket_id) {
          // Best effort only: the old RPC created the tenant correctly but
          // defaults its type to supermarket. New migrations handle this in
          // the RPC itself.
          const { error: typeError } = await supabase.from('supermarkets')
            .update({ business_type: form.businessType })
            .eq('id', data.supermarket_id);
          if (typeError) console.warn('Store created, but its business type needs migration:', typeError.message);
        }
      }

      if (error) {
        console.error('onboard_supermarket failed:', error);
        throw error;
      }
      if (!data?.success) throw new Error(data?.error || 'Registration failed');

      // Keep the store ledger and its Pichin business wallet isolated from any
      // other business owned by this person. Merging is an explicit onboarding
      // choice in the full onboarding screen, never an implicit fallback.
      const { data: storeAccount, error: storeAccountError } = await supabase.rpc('create_store_business_account', {
        p_supermarket_id: data.supermarket_id,
        p_business_name: form.storeName.trim(),
        p_business_type: form.businessType,
        p_existing_business_profile_id: selectedBusinessProfileId || null,
        p_merge_existing: !!selectedBusinessProfileId,
      });
      if (storeAccountError) throw storeAccountError;
      if (!storeAccount?.success) throw new Error(storeAccount?.error || 'Store business account setup failed');

      // Factories are first-class CMMS businesses. Create the factory template
      // (production, BOM, warehouse, maintenance, supplier marketplace and
      // transport) while retaining this Supermarketa POS tenant.
      // Keep the default isolated store account unless the administrator made
      // the explicit choice above.
      let cmmsBusinessProfileId = storeAccount.business_profile_id || null;
      if (form.businessType === 'factory' && !cmmsBusinessProfileId) {
        const { data: factoryProfileId, error: factoryProfileError } = await supabase.rpc('create_business_profile_from_category', {
          p_business_name: form.storeName.trim(),
          p_category_key: 'factory',
          p_business_type: 'Factory / Manufacturing',
          p_source_app: 'supermarketa',
          p_metadata: { supermarket_id: data.supermarket_id, pos_enabled: true, supplier_enabled: true }
        });
        if (factoryProfileError) throw factoryProfileError;
        cmmsBusinessProfileId = factoryProfileId;
        await supabase.from('supermarkets').update({ pichin_business_profile_id: cmmsBusinessProfileId }).eq('id', data.supermarket_id);
        await supabase.rpc('publish_business_as_supplier', {
          p_business_profile_id: cmmsBusinessProfileId,
          p_supplier_type: 'factory'
        });
      }

      if (form.businessType === 'wholesale' && data.supermarket_id) {
        const { error: settingsError } = await supabase.from('supermarkets').update({
          wholesale_categories: form.wholesaleCategories,
          wholesale_pricing_mode: form.wholesalePricingMode,
        }).eq('id', data.supermarket_id);
        if (settingsError) throw settingsError;
      }

      // Update auth metadata so session reflects admin role
      await supabase.auth.updateUser({ data: { role: 'admin' } });

      // Update users table row that AdminPortal checks (try auth_id first, then id)
      const uid = session.user.id;
      const userUpdate = {
        role: 'admin',
        supermarket_id: data.supermarket_id || null,
        updated_at: new Date().toISOString()
      };
      const { error: e1 } = await supabase.from('users').update(userUpdate).eq('auth_id', uid);
      if (e1) await supabase.from('users').update(userUpdate).eq('id', uid);

      if (selectedBusinessProfileId) {
        toast.success(`${form.storeName} is ready. Complete any remaining store details from your portal.`);
        navigate('/admin-portal', { replace: true });
        return;
      }
      clearDraft();
      setResult(data);
      setView('success');
      toast.success(`${form.storeName} is now live! 🎉`);
    } catch (err) {
      toast.error(err.message || 'Failed to register supermarket');
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = () => {
    const link = `${window.location.origin}/join/${result?.onboarding_token}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Invite link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  // ── pieces shared by every view ───────────────────────────────────────────
  const isDark = theme === 'dark';

  // The page keeps its night-sky backdrop in both themes; the card in front of it follows the theme.
  // (Direct children of the backdrop are positioned by its stylesheet, so this sits inside a wrapper.)
  const themeToggle = (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className="fixed right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-slate-900/85 text-white shadow-lg shadow-black/30 backdrop-blur transition-colors hover:bg-slate-800"
    >
      <span key={theme} className="cl-spin-in">{isDark ? <FiSun size={16} /> : <FiMoon size={16} />}</span>
    </button>
  );

  const shellClass = 'cl-auth cl-auth-bg-night min-h-screen text-white flex items-center justify-center px-4 py-6 sm:py-10';
  const cardClass = 'cl-auth-dark-card bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-[2rem] shadow-2xl shadow-black/30';

  // The name being typed is the star of the page: it appears in a card beside the form as soon as there is
  // one (a placeholder until then), and again on the review and success screens.
  const trimmedName = form.storeName.trim();
  const hasName = trimmedName.length > 0;
  const storePreview = view === 'create' && (
    <div
      aria-live="polite"
      className={`cl-store-card hidden rounded-2xl border px-5 py-4 transition-all duration-500 lg:block ${hasName ? 'border-[#f5dfa0]/60 bg-white/10 shadow-lg shadow-black/20' : 'border-dashed border-white/20 bg-white/[0.03]'}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">Your {typeInfo.label.toLowerCase()}</p>
      <p className={`font-classic-display mt-1 flex items-center gap-2.5 break-words text-3xl font-extrabold leading-tight transition-colors duration-500 ${hasName ? 'text-white' : 'text-white/35'}`}>
        <span aria-hidden="true" className="text-3xl">{typeInfo.emoji}</span>
        <span className="min-w-0">{hasName ? trimmedName : 'Your store name'}</span>
      </p>
      <span className={`mt-3 block h-0.5 origin-left rounded bg-gradient-to-r from-[#f5dfa0] to-transparent transition-transform duration-700 ${hasName ? 'scale-x-100' : 'scale-x-0'}`} />
    </div>
  );

  // On a phone the form comes first: just the heading, not the long pitch and feature list
  const leftPanel = (
    <div className="space-y-4 text-white lg:space-y-8">
      <button
        type="button"
        onClick={() => navigate('/customer-dashboard')}
        className="inline-flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"
      >
        <FiArrowLeft size={14} /> Back to dashboard
      </button>

      <div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-emerald-300 lg:mb-4">
          <FiShield size={12} /> Admin setup
        </div>
        <h1 className="mb-2 text-3xl font-black leading-[1.1] sm:text-4xl lg:mb-4 lg:text-5xl">
          Your store.<br className="hidden lg:block" /> Your rules.
        </h1>
        <p className="max-w-sm text-sm leading-relaxed text-slate-300 lg:hidden">
          Set up your business in a few quick steps.
        </p>
        <p className="hidden max-w-sm text-base leading-relaxed text-slate-300 lg:block">
          Set up a supermarket, pharmacy, hotel, boutique, restaurant/café, hardware store, wholesale business, or factory with POS and CMMS operations in one connected workspace.
        </p>
      </div>

      {storePreview}

      <div className="hidden space-y-3 lg:block">
        {[
          { icon: FiBriefcase, title: 'Launch your store', body: 'Go live in minutes. No technical setup needed.' },
          { icon: FiUsers, title: 'Invite managers & cashiers', body: 'Share an invite link — they join instantly.' },
          { icon: FiPackage, title: 'Earn ICAN on every sale', body: '10 ICAN for joining + rewards on every order.' },
        ].map(({ icon, title, body }) => (
          <div key={title} className="flex items-start gap-4 rounded-2xl border border-white/8 bg-white/4 p-4 backdrop-blur">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
              {React.createElement(icon, { size: 16, className: 'text-emerald-300' })}
            </div>
            <div>
              <p className="mb-0.5 text-sm font-semibold">{title}</p>
              <p className="text-xs text-slate-300">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── loading ────────────────────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div role="status" aria-label="Loading" className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── success screen ─────────────────────────────────────────────────────────
  if (view === 'success') {
    return (
      <div className={shellClass}>
        <div className="w-full max-w-md text-center">
          {themeToggle}
          <div className="cl-stagger space-y-6">
            <div style={{ '--i': 0 }}>
              <div className="cl-emblem mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-cyan-400 shadow-xl shadow-emerald-900/40">
                <span className="text-4xl">{typeInfo.emoji}</span>
              </div>
            </div>

            <div style={{ '--i': 1 }} className="text-white">
              <h1 ref={headingRef} tabIndex={-1} className="mb-3 text-3xl font-black outline-none">You're live!</h1>
              <p className="font-classic-display cl-store-hero mx-auto inline-block max-w-full break-words text-3xl font-extrabold leading-tight sm:text-4xl">{form.storeName}</p>
              <p className="mt-3 text-slate-300">
                Your {typeInfo.label.toLowerCase()} is now on the platform. You earned{' '}
                <span className="text-emerald-400 font-bold">10 icaneracoins</span> for joining.
              </p>
            </div>

            {result?.onboarding_token && (
              <div style={{ '--i': 2 }} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">Staff invite link</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-emerald-300 bg-black/30 rounded-lg px-3 py-2 flex-1 truncate">
                    {window.location.origin}/join/{result.onboarding_token}
                  </code>
                  <button
                    type="button"
                    onClick={copyInvite}
                    aria-label={copied ? 'Invite link copied' : 'Copy invite link'}
                    className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    {copied ? <FiCheck size={15} className="cl-pop text-emerald-400" /> : <FiCopy size={15} />}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-400">Share with managers and cashiers to let them join instantly.</p>
              </div>
            )}

            <div style={{ '--i': 3 }} className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => navigate('/admin-portal', { replace: true })}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold text-base shadow-lg shadow-emerald-900/30 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                Open Admin Portal <FiArrowRight />
              </button>
              <button
                type="button"
                onClick={() => navigate('/ican-wallet')}
                className="w-full py-3 rounded-2xl border border-white/15 text-white/80 text-sm font-semibold hover:bg-white/5 transition-colors"
              >
                View IcanEra Wallet
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── sign-in view ───────────────────────────────────────────────────────────
  if (view === 'signin') {
    return (
      <div className={shellClass}>
        <div className="grid w-full max-w-5xl items-center gap-6 lg:grid-cols-2 lg:gap-10">
          {themeToggle}
          {leftPanel}

          <div className={`${cardClass} p-6 sm:p-7 md:p-9`}>
            <div className="mb-7">
              <div className="mb-1 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 dark:bg-emerald-500/15 dark:ring-1 dark:ring-emerald-400/30">
                  <FiLogIn size={18} className="text-white dark:text-emerald-300" />
                </div>
                <h2 className={`text-2xl font-black ${UI.title}`}>Sign in</h2>
              </div>
              <p className={`ml-[52px] text-sm ${UI.muted}`}>Access your existing business account.</p>
            </div>

            <form onSubmit={handleSignIn} className="space-y-4" noValidate>
              <Field label="Email" icon={FiMail} type="email" placeholder="you@business.com"
                autoComplete="email" inputMode="email" required
                value={signin.email} onChange={e => setSignin(s => ({ ...s, email: e.target.value }))} />

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="admin-signin-password" className={`text-xs font-semibold uppercase tracking-wide ${UI.label}`}>Password</label>
                  <button type="button" onClick={() => navigate('/forgot-password')} className={`text-xs font-semibold hover:underline ${UI.link}`}>
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="admin-signin-password"
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    aria-required="true"
                    value={signin.password}
                    onChange={e => setSignin(s => ({ ...s, password: e.target.value }))}
                    className={`w-full rounded-xl border border-slate-200 py-3 pl-4 pr-11 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 dark:focus:ring-emerald-400/20 ${UI.control}`}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    aria-pressed={showPw}
                    className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                    {showPw ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-slate-900 to-emerald-700 dark:from-emerald-600 dark:to-teal-600 text-white font-bold text-sm shadow-lg hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {busy ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : null}
                {busy ? 'Signing in…' : 'Sign in to portal'}
                {!busy && <FiArrowRight size={15} />}
              </button>
            </form>

            <div className={`mt-5 border-t pt-5 text-center ${UI.divider}`}>
              <p className={`text-sm ${UI.muted}`}>
                Don't have a business account yet?{' '}
                <button type="button" onClick={() => setView('create')} className={`font-semibold hover:underline ${UI.link}`}>
                  Create one now
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── create view (multi-step) ───────────────────────────────────────────────
  const stepHeading = [
    'What are you setting up?',
    `Create your ${typeInfo.label.toLowerCase()}`,
    'Where is your store?',
    'Review & launch',
  ][step];

  // Pichin profiles only matter to people who have one: nothing to show (or choose) otherwise
  const showProfilePanel = profilesLoading || businessProfiles.length > 0;

  const typeKeys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  const moveTypeSelection = (e) => {
    const delta = typeKeys[e.key];
    if (!delta) return;
    e.preventDefault();
    const group = e.currentTarget;
    const at = BUSINESS_TYPES.findIndex(t => t.value === form.businessType);
    set('businessType', BUSINESS_TYPES[(at + delta + BUSINESS_TYPES.length) % BUSINESS_TYPES.length].value);
    requestAnimationFrame(() => group.querySelector('[aria-checked="true"]')?.focus());
  };

  return (
    <div className={shellClass}>
      <div className="grid w-full max-w-5xl items-start gap-6 lg:grid-cols-2 lg:gap-10">
        {themeToggle}
        {leftPanel}

        <div className={cardClass}>
          {/* progress bar */}
          <div className="h-1 overflow-hidden rounded-t-[2rem] bg-slate-100 dark:bg-slate-800" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          <div className="p-5 sm:p-7 md:p-9">
            {hasName && step < STEPS.length - 1 && (
              <div className="cl-step-in mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 dark:bg-emerald-500/10 lg:hidden">
                <span aria-hidden="true">{typeInfo.emoji}</span>
                <span className="font-classic-display min-w-0 truncate text-base font-extrabold text-emerald-900 dark:text-emerald-200">{trimmedName}</span>
              </div>
            )}
            {/* step indicator: finished steps are buttons back to them */}
            <nav aria-label="Setup steps" className="mb-6">
              <ol className="flex items-center gap-2">
                {STEPS.map((label, i) => {
                  const done = i < step;
                  const current = i === step;
                  return (
                    <React.Fragment key={label}>
                      <li className="flex items-center">
                        <button
                          type="button"
                          disabled={!done}
                          onClick={() => setStep(i)}
                          aria-current={current ? 'step' : undefined}
                          aria-label={done ? `${label}, completed. Go back to this step` : label}
                          className={`flex items-center gap-1.5 rounded-full text-xs font-semibold transition-colors disabled:cursor-default
                            ${current ? 'text-emerald-700 dark:text-emerald-300' : done ? 'text-slate-600 hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-300' : 'text-slate-400 dark:text-slate-500'}`}
                        >
                          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold
                            ${done ? 'bg-emerald-500 text-white' : current ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500'}`}>
                            {done ? <FiCheck size={11} /> : i + 1}
                          </span>
                          <span className="hidden sm:block">{label}</span>
                        </button>
                      </li>
                      {i < STEPS.length - 1 && (
                        <li aria-hidden="true" className={`h-px flex-1 ${i < step ? 'bg-emerald-300 dark:bg-emerald-500/50' : 'bg-slate-200 dark:bg-slate-700'}`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </ol>
              <p className={`mt-2 text-xs sm:hidden ${UI.muted}`}>Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>
            </nav>

            <form ref={formRef} onSubmit={submitStep} noValidate>
              {/* ── step 0: business type ── */}
              {step === 0 && (
                <div className="cl-step-in space-y-4">
                  <div className="mb-2">
                    <h2 ref={headingRef} tabIndex={-1} className={`text-xl font-black outline-none ${UI.title}`}>{stepHeading}</h2>
                    <p className={`mt-0.5 text-sm ${UI.muted}`}>Pick the kind of business you're launching.</p>
                  </div>

                  <div role="radiogroup" aria-label="Business type" onKeyDown={moveTypeSelection} className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    {BUSINESS_TYPES.map(t => {
                      const on = form.businessType === t.value;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          tabIndex={on ? 0 : -1}
                          onClick={() => set('businessType', t.value)}
                          className={`relative rounded-2xl border-2 p-3 text-left transition-all sm:p-4 ${
                            on
                              ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-400/80 dark:bg-emerald-500/10'
                              : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-slate-500'
                          }`}
                        >
                          {on && (
                            <span className="cl-pop absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                              <FiCheck size={11} />
                            </span>
                          )}
                          <div className="mb-1 text-2xl">{t.emoji}</div>
                          <p className={`text-sm font-bold ${UI.title}`}>{t.label}</p>
                          <p className={`mt-0.5 text-xs ${UI.muted}`}>{t.blurb}</p>
                        </button>
                      );
                    })}
                  </div>

                  {showProfilePanel && (
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 dark:border-indigo-400/20 dark:bg-indigo-500/10">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`flex items-center gap-2 text-sm font-bold ${UI.title}`}><FiBriefcase className="text-indigo-600 dark:text-indigo-300" /> Use your business profile</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">Optional: connect a Pichin business profile now and use the same administrator authority, wallet and CMMS workspace for this store.</p>
                        </div>
                        <button type="button" onClick={() => loadBusinessProfiles(session)} disabled={profilesLoading} className="rounded-lg p-2 text-indigo-700 hover:bg-white disabled:opacity-50 dark:text-indigo-300 dark:hover:bg-white/10" aria-label="Refresh business profiles"><FiRefreshCw className={profilesLoading ? 'animate-spin' : ''} size={16} /></button>
                      </div>

                      <label className={`mt-3 flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${!selectedBusinessProfileId ? 'border-indigo-400 bg-white dark:bg-slate-800' : 'border-transparent bg-white/60 dark:bg-slate-800/50'}`}>
                        <input type="radio" name="setup-business-profile" checked={!selectedBusinessProfileId} onChange={() => setSelectedBusinessProfileId('')} />
                        <span><span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Create a separate store profile</span><span className={`block text-xs ${UI.muted}`}>Recommended when this store needs its own wallet and records.</span></span>
                      </label>

                      {businessProfiles.map(profile => (
                        <label key={profile.id} className={`mt-2 flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${selectedBusinessProfileId === profile.id ? 'border-indigo-400 bg-white dark:bg-slate-800' : 'border-transparent bg-white/60 hover:border-indigo-200 dark:bg-slate-800/50 dark:hover:border-indigo-400/40'}`}>
                          <input type="radio" name="setup-business-profile" value={profile.id} checked={selectedBusinessProfileId === profile.id} onChange={() => selectBusinessProfile(profile.id)} />
                          <span><span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{profile.business_name}</span><span className={`block text-xs ${UI.muted}`}>{profile.business_type || 'Business profile'} · Use this profile in Supermarketa, Supplier and CMMS</span></span>
                        </label>
                      ))}

                      {selectedBusinessProfileId && <p className="mt-3 rounded-lg bg-white p-3 text-xs leading-relaxed text-indigo-800 dark:bg-slate-800 dark:text-indigo-200">Your business profile is connected. Store contact and location details are optional and can be completed later in the Admin Portal.</p>}
                    </div>
                  )}
                </div>
              )}

              {/* ── step 1: store details ── */}
              {step === 1 && (
                <div className="cl-step-in space-y-4">
                  <div className="mb-2">
                    <h2 ref={headingRef} tabIndex={-1} className={`text-xl font-black outline-none ${UI.title}`}>{stepHeading}</h2>
                    <p className={`mt-0.5 text-sm ${UI.muted}`}>Tell us about your {typeInfo.label.toLowerCase()}.</p>
                  </div>

                  <Field label={typeInfo.nameLabel} icon={FiBriefcase} required
                    placeholder={typeInfo.namePlaceholder} autoComplete="organization"
                    value={form.storeName} onChange={e => set('storeName', e.target.value)}
                    error={errors.storeName} />

                  <div className="space-y-1">
                    <label htmlFor="admin-store-description" className={`block text-xs font-semibold uppercase tracking-wide ${UI.label}`}>Description</label>
                    <textarea
                      id="admin-store-description"
                      placeholder={typeInfo.descPlaceholder}
                      value={form.description}
                      onChange={e => set('description', e.target.value)}
                      rows={3}
                      className={`w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 dark:focus:ring-emerald-400/20 ${UI.control}`}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Store phone" icon={FiPhone} type="tel" inputMode="tel" autoComplete="tel"
                      placeholder="+256 700 000 000"
                      value={form.storePhone} onChange={e => set('storePhone', e.target.value)} />
                    <Field label="Store email" icon={FiMail} type="email" inputMode="email" autoComplete="email"
                      placeholder="store@business.com"
                      value={form.storeEmail} onChange={e => set('storeEmail', e.target.value)} />
                  </div>

                  {form.businessType === 'wholesale' && (
                    <div className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-400/20 dark:bg-indigo-500/10">
                      <p className={`text-sm font-bold ${UI.title}`}>Wholesale ordering setup</p>
                      <div className="space-y-1">
                        <label htmlFor="admin-wholesale-categories" className={`block text-xs font-semibold uppercase tracking-wide ${UI.label}`}>Product, service, or material categories</label>
                        <select id="admin-wholesale-categories" multiple value={form.wholesaleCategories} onChange={e => set('wholesaleCategories', Array.from(e.target.selectedOptions, option => option.value))} className={`min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm ${UI.control}`}>
                          {WHOLESALE_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
                        </select>
                        <p className={`text-xs ${UI.muted}`}>Hold Ctrl/Cmd to select more than one.</p>
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="admin-wholesale-pricing" className={`block text-xs font-semibold uppercase tracking-wide ${UI.label}`}>Default order price</label>
                        <select id="admin-wholesale-pricing" value={form.wholesalePricingMode} onChange={e => set('wholesalePricingMode', e.target.value)} className={`w-full rounded-xl border border-slate-200 px-3 py-3 text-sm ${UI.control}`}>
                          <option value="supplier_price">Supplier price (recommended for purchasing)</option>
                          <option value="admin_price">Admin-set price</option>
                        </select>
                        <p className={`text-xs ${UI.muted}`}>Managers can change this choice when creating an order.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── step 2: location ── */}
              {step === 2 && (
                <div className="cl-step-in space-y-4">
                  <div className="mb-2">
                    <h2 ref={headingRef} tabIndex={-1} className={`text-xl font-black outline-none ${UI.title}`}>{stepHeading}</h2>
                    <p className={`mt-0.5 text-sm ${UI.muted}`}>Customers and riders use this for deliveries.</p>
                  </div>

                  <Field label="Street address *" icon={FiMapPin} required autoComplete="street-address"
                    placeholder="Plot 14, Nakivubo Road"
                    value={form.address} onChange={e => set('address', e.target.value)}
                    error={errors.address} />

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="City *" required autoComplete="address-level2" placeholder="Kampala"
                      value={form.city} onChange={e => set('city', e.target.value)}
                      error={errors.city} />

                    <div className="space-y-1">
                      <label htmlFor="admin-store-country" className={`block text-xs font-semibold uppercase tracking-wide ${UI.label}`}>Country</label>
                      <select
                        id="admin-store-country"
                        autoComplete="country-name"
                        value={form.country} onChange={e => set('country', e.target.value)}
                        className={`w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 dark:focus:ring-emerald-400/20 ${UI.control}`}
                      >
                        {['Uganda','Kenya','Tanzania','Rwanda','Other'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ── step 3: review ── */}
              {step === 3 && (
                <div className="cl-step-in space-y-4">
                  <div className="mb-2">
                    <h2 ref={headingRef} tabIndex={-1} className={`text-xl font-black outline-none ${UI.title}`}>{stepHeading}</h2>
                    <p className={`mt-0.5 text-sm ${UI.muted}`}>Confirm your details before going live.</p>
                  </div>

                  <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 p-4 text-center ring-1 ring-emerald-400/30">
                    <div className="text-4xl" aria-hidden="true">{typeInfo.emoji}</div>
                    <p className={`font-classic-display mt-1 break-words text-2xl font-extrabold leading-tight ${UI.title}`}>{trimmedName}</p>
                    <p className={`mt-0.5 text-xs font-semibold uppercase tracking-wide ${UI.muted}`}>{typeInfo.label}</p>
                  </div>

                  <div className="space-y-3">
                    <ReviewBlock title="Business type" onEdit={() => setStep(0)}>
                      <Row label="Type" value={`${typeInfo.emoji} ${typeInfo.label}`} />
                    </ReviewBlock>
                    <ReviewBlock title="Store details" onEdit={() => setStep(1)}>
                      <Row label="Store name"   value={form.storeName} />
                      <Row label="Description"  value={form.description} />
                      <Row label="Phone"        value={form.storePhone} />
                      <Row label="Email"        value={form.storeEmail} />
                      {form.businessType === 'wholesale' && <>
                        <Row label="Wholesale categories" value={form.wholesaleCategories.join(', ')} />
                        <Row label="Default order price" value={form.wholesalePricingMode === 'admin_price' ? 'Admin-set price' : 'Supplier price'} />
                      </>}
                    </ReviewBlock>
                    <ReviewBlock title="Location" onEdit={() => setStep(2)}>
                      <Row label="Address" value={[form.address, form.city, form.country].filter(Boolean).join(', ')} />
                    </ReviewBlock>
                  </div>

                  {selectedBusinessProfileId && <p className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-800 dark:border-indigo-400/20 dark:bg-indigo-500/10 dark:text-indigo-200">Your Pichin business profile will be used. You can complete store contact and location details from the Admin Portal after launch.</p>}

                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-cyan-50 p-4 dark:border-emerald-400/20 dark:from-emerald-500/10 dark:to-cyan-500/10">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-200">₡</div>
                    <div>
                      <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Earn 10 icaneracoins on launch</p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300/80">Plus ongoing rewards for every order processed through your store.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* navigation: pinned to the bottom of a phone screen so Continue is never scrolled away */}
              <div className="sticky bottom-0 z-10 -mx-5 mt-6 flex gap-3 rounded-b-[2rem] border-t border-slate-100 bg-white/95 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/95 sm:static sm:mx-0 sm:mt-7 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none sm:dark:bg-transparent">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={back}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-semibold transition-colors ${UI.ghostButton}`}
                  >
                    <FiArrowLeft size={14} /> Back
                  </button>
                )}

                {step < STEPS.length - 1 ? (
                  <button
                    type="submit"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 py-3 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90"
                  >
                    Continue <FiArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-slate-900 to-emerald-700 py-3 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 disabled:opacity-50 dark:from-emerald-600 dark:to-teal-600"
                  >
                    {busy
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Launching…</>
                      : <>{selectedBusinessProfileId ? 'Continue to Admin Portal' : 'Launch my store'} <FiArrowRight size={14} /></>
                    }
                  </button>
                )}
              </div>
            </form>

            {/* switch to sign-in */}
            <p className={`mt-5 text-center text-xs ${UI.muted}`}>
              Already have a business account?{' '}
              <button type="button" onClick={() => setView('signin')} className={`font-semibold hover:underline ${UI.link}`}>
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
