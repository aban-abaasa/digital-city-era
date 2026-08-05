import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiArrowRight,
  FiBarChart2,
  FiCamera,
  FiCheckCircle,
  FiCreditCard,
  FiGlobe,
  FiHeadphones,
  FiLock,
  FiMail,
  FiMenu,
  FiPackage,
  FiMoon,
  FiSend,
  FiSun,
  FiShield,
  FiShoppingBag,
  FiShoppingCart,
  FiStar,
  FiThumbsUp,
  FiTruck,
  FiUser,
  FiUsers,
  FiX,
  FiZap
} from 'react-icons/fi';
import '../styles/supermartkera-landing.css';
import { Bike } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getGuestIdentity, resolveChatIdentity, setGuestIdentity } from '../services/chatService';
import {
  createLandingMessage,
  fetchPublicThreads,
  getMyIcanBalance,
  getOrCreateGuestLikeKey,
  hasIcanWallet,
  likeMessage,
  listMyLandingMessages,
  replyToLandingMessage,
  subscribeToPublicLandingMessages,
} from '../services/landingMessagesService';
import { getShowcaseProducts } from '../services/showcaseProductsService';

const SHOWCASE_VISIBLE_COUNT = 6;
const SHOWCASE_ROTATE_MS = 4500;

const serviceCards = [
  {
    icon: FiCreditCard,
    title: 'POS system',
    copy: 'Fast billing, receipts, and a clean checkout flow for busy supermarket teams.'
  },
  {
    icon: FiCamera,
    title: 'Scan and pay',
    copy: 'Barcode scanning and payment support that helps queues move faster.'
  },
  {
    icon: FiPackage,
    title: 'Inventory management',
    copy: 'Track stock, categories, and low items from one easy dashboard.'
  },
  {
    icon: FiBarChart2,
    title: 'Reports',
    copy: 'Sales and stock reports that help managers make better decisions.'
  },
  {
    icon: FiUsers,
    title: 'Team management',
    copy: 'Assign roles and keep staff workflows organized and simple.'
  },
  {
    icon: FiTruck,
    title: 'Supplier coordination',
    copy: 'Keep orders, deliveries, and stock replenishment in sync.'
  }
];

const customerBenefits = [
  'A clean and friendly shopping experience',
  'Fast sign-in for shoppers, staff, and managers',
  'Reliable inventory visibility behind the scenes',
  'Simple, affordable software for growing supermarkets'
];

const fmtBoardTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return date.toLocaleDateString();
};

const themeStyles = {
  dark: {
    shell: 'bg-[#061510] text-white',
    header: 'bg-emerald-950/50 border-emerald-800/25',
    panel: 'bg-emerald-950/55 border-emerald-800/20',
    softPanel: 'bg-emerald-900/15 border-emerald-700/20',
    muted: 'text-emerald-100/65',
    body: 'text-emerald-50/75',
    accent: 'text-white',
    button: 'bg-emerald-400 text-emerald-950',
    outline: 'border-emerald-700/25 bg-emerald-900/20 text-white hover:bg-emerald-800/25',
    input: 'bg-emerald-950/55 border-emerald-700/25 text-white placeholder:text-emerald-700',
    featureItem: 'border-emerald-800/25 bg-emerald-950/60',
    blob1: 'bg-emerald-500/12',
    blob2: 'bg-green-400/10',
    blob3: 'bg-teal-400/8',
    badge: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
    iconBg: 'from-emerald-400/20 to-green-500/15 text-emerald-300',
    price: 'text-emerald-300',
    sectionLabel: 'text-emerald-400/75',
    logo: 'from-emerald-400 via-green-500 to-teal-600 shadow-emerald-500/20',
    check: 'text-emerald-400',
    divider: 'border-emerald-800/25'
  },
  light: {
    shell: 'bg-[linear-gradient(180deg,#ffffff_0%,#f0fdf4_45%,#ecfdf5_100%)] text-slate-900',
    header: 'bg-white/92 border-emerald-100 shadow-sm shadow-emerald-100/40',
    panel: 'bg-white border-emerald-100 shadow-xl shadow-emerald-100/35',
    softPanel: 'bg-white border-emerald-100/90 hover:border-emerald-200',
    muted: 'text-slate-600',
    body: 'text-slate-600',
    accent: 'text-slate-900',
    button: 'bg-emerald-600 text-white hover:bg-emerald-700',
    outline: 'border-emerald-200 bg-white text-slate-900 hover:bg-emerald-50',
    input: 'bg-white border-emerald-200 text-slate-900 placeholder:text-slate-400',
    featureItem: 'border-emerald-100 bg-emerald-50/70',
    blob1: 'bg-emerald-200/55',
    blob2: 'bg-green-100/65',
    blob3: 'bg-teal-100/45',
    badge: 'border-emerald-300/40 bg-emerald-50 text-emerald-800',
    iconBg: 'from-emerald-100 to-green-100 text-emerald-600',
    price: 'text-emerald-600',
    sectionLabel: 'text-emerald-600',
    logo: 'from-emerald-500 via-green-600 to-teal-600 shadow-emerald-400/20',
    check: 'text-emerald-500',
    divider: 'border-emerald-100'
  }
};

const useScrollReveal = () => {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const items = node.querySelectorAll('.sk-scroll-reveal');
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('sk-visible'); }),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return ref;
};

const SupermartkeraLanding = () => {
  const { theme, toggleTheme } = useTheme();
  const palette = themeStyles[theme];
  const navigate = useNavigate();
  const [showcaseProducts, setShowcaseProducts] = useState([]);
  const [showcaseOffset, setShowcaseOffset] = useState(0);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
    isPublic: true
  });
  const [identity, setIdentity] = useState(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [threads, setThreads] = useState([]);
  const [myMessages, setMyMessages] = useState([]);
  const [submitState, setSubmitState] = useState('idle'); // idle | sending | sent | error
  const [expandedId, setExpandedId] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replyState, setReplyState] = useState('idle'); // idle | sending | error
  const [guestIdentity, setGuestIdentityState] = useState(() => getGuestIdentity());
  const [guestReplyForm, setGuestReplyForm] = useState({ name: '', email: '' });
  const [guestLikeKey] = useState(() => getOrCreateGuestLikeKey());
  const [selectedContributor, setSelectedContributor] = useState(null);
  const [contributorBalance, setContributorBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mainRef = useScrollReveal();

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') closeMobileMenu(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileMenuOpen, closeMobileMenu]);

  // Real posters shown individually (name + message count); every guest
  // post (no user_id) folds into one aggregate "Guests" entry instead of
  // showing as separate unnamed people.
  const contributors = useMemo(() => {
    const byUser = new Map();
    let guestCount = 0;
    const visit = (m) => {
      if (m.user_id) {
        const existing = byUser.get(m.user_id);
        if (existing) {
          existing.count += 1;
          existing.name = m.name || existing.name;
        } else {
          byUser.set(m.user_id, { authId: m.user_id, name: m.name || 'Community member', count: 1 });
        }
      } else {
        guestCount += 1;
      }
    };
    threads.forEach((t) => {
      visit(t);
      t.replies.forEach(visit);
    });
    const list = Array.from(byUser.values()).sort((a, b) => b.count - a.count);
    if (guestCount > 0) list.push({ authId: null, name: 'Guests', count: guestCount, isGuestGroup: true });
    return list;
  }, [threads]);

  const handleSelectContributor = (c) => {
    if (c.isGuestGroup) return;
    setSelectedContributor(c);
    setContributorBalance(null);
    // Balances are only ever fetched for the viewer's own card — see
    // getMyIcanBalance's doc comment for why this is a call-site convention,
    // not a database-enforced restriction.
    if (identity?.authId && c.authId === identity.authId) {
      setBalanceLoading(true);
      getMyIcanBalance(c.authId)
        .then((bal) => setContributorBalance(bal))
        .catch(() => setContributorBalance(null))
        .finally(() => setBalanceLoading(false));
    }
  };

  // Personalize the form for a visitor who's already signed in to a portal.
  // Private posting also requires an active ICAN wallet (cross-app identity
  // check) — a bare login isn't enough on its own.
  useEffect(() => {
    let cancelled = false;
    resolveChatIdentity().then((id) => {
      if (cancelled) return;
      setIdentity(id);
      if (id) {
        setContactForm((prev) => ({
          ...prev,
          name: prev.name || id.name || '',
          email: prev.email || id.email || ''
        }));
        hasIcanWallet(id.authId)
          .then((ok) => { if (!cancelled) setHasWallet(ok); })
          .catch(() => { if (!cancelled) setHasWallet(false); });
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Public community board — everyone can read these, live-updated.
  const loadThreads = useCallback(() => {
    return fetchPublicThreads(50, { authId: identity?.authId, guestKey: guestLikeKey })
      .then((rows) => setThreads(rows))
      .catch((err) => console.error('[SupermartkeraLanding] failed to load public threads:', err));
  }, [identity?.authId, guestLikeKey]);

  useEffect(() => {
    loadThreads();
    return subscribeToPublicLandingMessages(() => { loadThreads(); });
  }, [loadThreads]);

  const handleLike = async (messageId) => {
    // Optimistic — a double-click just no-ops server-side (unique constraint).
    setThreads((prev) => prev.map((t) => {
      const bump = (m) => (m.id === messageId && !m.likedByMe
        ? { ...m, likeCount: (m.likeCount || 0) + 1, likedByMe: true }
        : m);
      return { ...bump(t), replies: t.replies.map(bump) };
    }));
    try {
      await likeMessage({ messageId, authId: identity?.authId, guestKey: guestLikeKey });
    } catch (err) {
      console.error('[SupermartkeraLanding] failed to like message:', err);
      loadThreads();
    }
  };

  // A signed-in visitor's own message history, public and private.
  useEffect(() => {
    if (!identity?.authId) { setMyMessages([]); return; }
    let cancelled = false;
    listMyLandingMessages(identity.authId)
      .then((rows) => { if (!cancelled) setMyMessages(rows); })
      .catch((err) => console.error('[SupermartkeraLanding] failed to load your messages:', err));
    return () => { cancelled = true; };
  }, [identity?.authId]);

  const handleContactChange = (event) => {
    const { name, value } = event.target;
    setContactForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleContactSubmit = async (event) => {
    event.preventDefault();
    if (!contactForm.message.trim() || submitState === 'sending') return;

    setSubmitState('sending');
    try {
      const saved = await createLandingMessage({
        name: contactForm.name,
        email: contactForm.email,
        company: contactForm.company,
        message: contactForm.message,
        authId: identity?.authId || null,
        // Only a wallet-holding poster can go private — force public otherwise.
        isPublic: hasWallet ? contactForm.isPublic : true
      });

      setSubmitState('sent');
      setContactForm((prev) => ({ ...prev, message: '' }));
      if (saved.is_public) {
        loadThreads();
      }
      if (identity?.authId) {
        setMyMessages((prev) => [saved, ...prev]);
      }
    } catch (err) {
      console.error('[SupermartkeraLanding] failed to post message:', err);
      setSubmitState('error');
    }
  };

  const handleToggleThread = (threadId) => {
    setExpandedId((prev) => (prev === threadId ? null : threadId));
    setReplyDraft('');
    setReplyState('idle');
  };

  const handleSaveGuestReplyIdentity = () => {
    const name = guestReplyForm.name.trim();
    const email = guestReplyForm.email.trim();
    if (!name) return;
    const guest = { name, email };
    setGuestIdentity(guest);
    setGuestIdentityState(guest);
  };

  const handleSendReply = async (threadId) => {
    const body = replyDraft.trim();
    if (!body || replyState === 'sending') return;

    const who = identity
      ? { name: identity.name, email: identity.email, authId: identity.authId }
      : guestIdentity?.name
        ? { name: guestIdentity.name, email: guestIdentity.email, authId: null }
        : null;
    if (!who) return;

    setReplyState('sending');
    try {
      await replyToLandingMessage({ parentId: threadId, name: who.name, email: who.email, authId: who.authId, message: body });
      setReplyDraft('');
      setReplyState('idle');
      await loadThreads();
    } catch (err) {
      console.error('[SupermartkeraLanding] failed to reply:', err);
      setReplyState('error');
    }
  };

  // Public preview of real in-stock products across every onboarded store —
  // visible to anyone, but tapping one only opens the shop for a signed-in
  // visitor; a guest is sent to sign in first.
  useEffect(() => {
    getShowcaseProducts(24)
      .then((rows) => setShowcaseProducts(rows))
      .catch((err) => console.error('[SupermartkeraLanding] failed to load showcase products:', err));
  }, []);

  // "Different products" — rotates which slice of the fetched pool is on
  // screen every few seconds instead of showing one static set forever.
  useEffect(() => {
    if (showcaseProducts.length <= SHOWCASE_VISIBLE_COUNT) return;
    const id = setInterval(() => {
      setShowcaseOffset((prev) => (prev + SHOWCASE_VISIBLE_COUNT) % showcaseProducts.length);
    }, SHOWCASE_ROTATE_MS);
    return () => clearInterval(id);
  }, [showcaseProducts.length]);

  const visibleShowcaseProducts = useMemo(() => {
    if (showcaseProducts.length === 0) return [];
    const count = Math.min(SHOWCASE_VISIBLE_COUNT, showcaseProducts.length);
    return Array.from({ length: count }, (_, i) => showcaseProducts[(showcaseOffset + i) % showcaseProducts.length]);
  }, [showcaseProducts, showcaseOffset]);

  // Shared by the product showcase and the ride/delivery cards below — the
  // public teaser is visible to everyone, but actually doing anything with
  // it (shopping, booking a ride, requesting delivery) opens the real
  // customer dashboard tab for a signed-in visitor and sends a guest to
  // sign in first instead.
  const handleGatedNavigate = (tab, guestMessage) => {
    if (identity) {
      navigate(`/customer-dashboard?tab=${tab}`);
      return;
    }
    toast.info(guestMessage);
    navigate('/login');
  };

  return (
    <div className={`min-h-screen overflow-x-hidden ${palette.shell}`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className={`sk-blob absolute -top-24 -left-16 h-80 w-80 rounded-full blur-3xl ${palette.blob1}`} />
        <div className={`sk-blob-delay absolute top-1/3 -right-20 h-96 w-96 rounded-full blur-3xl ${palette.blob2}`} />
        <div className={`sk-blob absolute bottom-0 left-1/4 h-72 w-72 rounded-full blur-3xl ${palette.blob3}`} />
      </div>

      <header className={`sticky top-0 z-40 border-b backdrop-blur-xl ${palette.header}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br sm:h-12 sm:w-12 ${palette.logo}`}>
              <FiShoppingBag className="h-5 w-5 text-white sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <p className={`truncate text-[10px] font-semibold uppercase tracking-[0.18em] sm:text-xs sm:tracking-[0.2em] ${palette.sectionLabel}`}>
                Supermarket OS
              </p>
              <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">Supermartkera</h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 md:hidden">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className={`inline-flex items-center justify-center rounded-full border p-2.5 transition ${palette.outline}`}
            >
              {theme === 'dark' ? <FiSun className="h-4 w-4" /> : <FiMoon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className={`inline-flex items-center justify-center rounded-full border p-2.5 transition ${palette.outline}`}
            >
              <FiMenu className="h-4 w-4" />
            </button>
          </div>

          <div className="hidden items-center gap-2 md:flex lg:gap-3">
            <button
              onClick={toggleTheme}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${palette.outline}`}
            >
              {theme === 'dark' ? <FiSun className="h-4 w-4" /> : <FiMoon className="h-4 w-4" />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button
              onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition lg:px-5 ${palette.outline}`}
            >
              Contact
            </button>
            <button
              onClick={() => window.dispatchEvent(new Event('supermartkera-install-requested'))}
              className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition lg:px-5 ${palette.outline}`}
            >
              Install app
            </button>
            <Link
              to="/login"
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition hover:scale-[1.02] lg:px-5 ${palette.button}`}
            >
              Sign in
              <FiArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile nav drawer */}
      <div
        className={`sk-mobile-overlay fixed inset-0 z-50 bg-black/50 md:hidden ${mobileMenuOpen ? 'sk-open' : ''}`}
        onClick={closeMobileMenu}
        aria-hidden={!mobileMenuOpen}
      />
      <nav
        className={`sk-mobile-nav fixed right-0 top-0 z-50 flex h-full w-[min(88vw,320px)] flex-col border-l p-5 md:hidden ${palette.panel} ${mobileMenuOpen ? 'sk-open' : ''}`}
        aria-hidden={!mobileMenuOpen}
      >
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold">Menu</span>
          <button onClick={closeMobileMenu} aria-label="Close menu" className={`rounded-full p-2 ${palette.outline}`}>
            <FiX className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={() => { document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' }); closeMobileMenu(); }}
            className={`rounded-2xl border px-4 py-3.5 text-left text-sm font-semibold ${palette.outline}`}
          >
            Services
          </button>
          <button
            onClick={() => { document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }); closeMobileMenu(); }}
            className={`rounded-2xl border px-4 py-3.5 text-left text-sm font-semibold ${palette.outline}`}
          >
            Contact us
          </button>
          <button
            onClick={() => { window.dispatchEvent(new Event('supermartkera-install-requested')); closeMobileMenu(); }}
            className={`rounded-2xl border px-4 py-3.5 text-left text-sm font-semibold ${palette.outline}`}
          >
            Install SupermartKera
          </button>
          <Link
            to="/login"
            onClick={closeMobileMenu}
            className="sk-btn-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white"
          >
            Sign in <FiArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>

      <main ref={mainRef} className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-10 lg:px-8 lg:pt-16">
        <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12">
          <div className="sk-animate-fade-up space-y-6 sm:space-y-8">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold sm:px-4 sm:py-2 sm:text-sm ${palette.badge}`}>
              <FiStar className="h-3.5 w-3.5 text-amber-400 sm:h-4 sm:w-4" />
              Clean UX for customers, staff & managers
            </div>

            <div className="space-y-4 sm:space-y-5">
              <h2 className={`sk-hero-title max-w-2xl text-[1.85rem] font-black leading-[1.12] tracking-tight xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl ${palette.accent}`}>
                Automate retail, reduce shrinkage &{' '}
                <span className="sk-shimmer-text">boost supermarket profit.</span>
              </h2>
              <p className={`max-w-2xl text-base leading-7 sm:text-lg sm:leading-8 md:text-xl ${palette.body}`}>
                Supermartkera helps supermarket teams manage POS, scan-and-pay, inventory, reports,
                and supplier activity in one clean, affordable place.
              </p>
            </div>

            <div className="flex flex-col gap-3 xs:flex-row xs:flex-wrap sm:gap-4">
              <Link
                to="/login"
                className="sk-btn-primary inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold text-white sm:gap-3 sm:px-6 sm:py-4 sm:text-base"
              >
                Open sign in
                <FiArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
              <button
                onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-sm font-semibold backdrop-blur-md transition hover:scale-[1.01] sm:gap-3 sm:px-6 sm:py-4 sm:text-base ${palette.outline}`}
              >
                Explore services
                <FiArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>

            <div className="sk-stat-scroll flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 xl:grid-cols-4">
              {[
                { value: 'POS', label: 'Checkout ready' },
                { value: 'Scan', label: 'Barcode friendly' },
                { value: 'Stock', label: 'Inventory control' },
                { value: 'Reports', label: 'Decision support' }
              ].map((item, i) => (
                <div
                  key={item.label}
                  className={`sk-card-lift min-w-[7.5rem] shrink-0 rounded-2xl border p-3.5 backdrop-blur-md sm:min-w-0 sm:p-4 sk-animate-fade-up sk-delay-${i + 1} ${palette.softPanel}`}
                >
                  <p className="text-xl font-black sm:text-2xl">{item.value}</p>
                  <p className={`mt-0.5 text-[10px] uppercase tracking-[0.2em] sm:mt-1 sm:text-xs sm:tracking-[0.25em] ${palette.muted}`}>{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="sk-animate-fade-up sk-delay-2 relative">
            <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-tr from-emerald-400/15 via-transparent to-green-400/15 blur-2xl sm:-inset-4" />
            <div className={`relative overflow-hidden rounded-[1.75rem] border sm:rounded-[2rem] ${palette.panel}`}>
              <img
                src="/images/landing/hero-supermarket.png"
                alt="Modern supermarket with fresh produce and digital checkout"
                className="sk-hero-image h-44 w-full object-cover sm:h-52 lg:h-56"
                loading="eager"
              />
              <div className="p-4 sm:p-5 lg:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-xs uppercase tracking-[0.25em] sm:tracking-[0.3em] ${palette.sectionLabel}`}>
                      What Supermartkera does
                    </p>
                    <h3 className={`mt-1.5 text-xl font-semibold sm:mt-2 sm:text-2xl ${palette.accent}`}>
                      One system. Clear control. Better service.
                    </h3>
                  </div>
                  <div className="sk-animate-pulse-green flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-400 sm:h-12 sm:w-12">
                    <FiZap className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                </div>

                <div className="mt-4 space-y-2.5 sm:mt-6 sm:space-y-3">
                  {[
                    'A smoother shopping experience for customers',
                    'Faster checkout with POS and scan-and-pay',
                    'Easy inventory management for supermarkets',
                    'Clear reports for better business decisions'
                  ].map((feature) => (
                    <div key={feature} className={`flex items-start gap-2.5 rounded-xl border p-3 sm:gap-3 sm:rounded-2xl sm:p-3.5 ${palette.featureItem}`}>
                      <FiCheckCircle className={`mt-0.5 h-4 w-4 shrink-0 sm:h-5 sm:w-5 ${palette.check}`} />
                      <p className={`text-xs leading-5 sm:text-sm sm:leading-6 ${theme === 'dark' ? 'text-emerald-50/85' : 'text-slate-700'}`}>{feature}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="sk-scroll-reveal mt-14 sm:mt-20">
          <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className={`text-xs uppercase tracking-[0.3em] sm:text-sm sm:tracking-[0.35em] ${palette.sectionLabel}`}>Live from the shelves</p>
              <h3 className={`mt-2 text-2xl font-bold sm:mt-3 sm:text-3xl md:text-4xl ${palette.accent}`}>
                Real products from real Supermartkera stores.
              </h3>
            </div>
            <p className={`max-w-2xl text-xs leading-6 sm:text-sm sm:leading-7 md:text-right ${palette.muted}`}>
              A rotating look at what's in stock right now.{' '}
              {identity ? 'Tap a product to shop.' : 'Sign in to add items to your cart.'}
            </p>
          </div>

          {visibleShowcaseProducts.length === 0 ? (
            <p className={`mt-6 text-sm sm:mt-8 ${palette.muted}`}>No products in stock yet — check back soon.</p>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
              {visibleShowcaseProducts.map((p) => (
                <button
                  key={`${p.id}-${showcaseOffset}`}
                  type="button"
                  onClick={() => handleGatedNavigate('shop', 'Sign in to add items to your cart.')}
                  className={`sk-animate-showcase sk-card-lift group flex flex-col overflow-hidden rounded-2xl border text-left sm:rounded-[1.5rem] ${palette.softPanel}`}
                >
                  <div className="flex h-20 w-full items-center justify-center bg-gradient-to-br from-emerald-400/10 to-green-500/10 sm:h-28">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                    ) : (
                      <FiShoppingBag className="h-7 w-7 text-emerald-400/60 sm:h-8 sm:w-8" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5 p-2.5 sm:gap-1 sm:p-4">
                    <p className={`truncate text-[10px] uppercase tracking-wide sm:text-xs ${palette.muted}`}>{p.storeName}</p>
                    <p className={`line-clamp-2 text-xs font-semibold leading-4 sm:text-sm sm:leading-5 ${palette.accent}`}>{p.name}</p>
                    <div className="mt-auto flex items-center justify-between gap-1 pt-1.5 sm:pt-2">
                      <span className={`text-xs font-bold sm:text-sm ${palette.price}`}>UGX {p.priceUgx.toLocaleString()}</span>
                      <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-medium sm:gap-1 sm:px-2 sm:py-1 sm:text-[10px] ${palette.outline}`}>
                        {identity ? <FiShoppingCart className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> : <FiLock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
                        {identity ? 'Shop' : 'Sign in'}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="sk-scroll-reveal mt-14 sm:mt-20">
          <div className="overflow-hidden rounded-[1.75rem] border sm:rounded-[2rem]">
            <img
              src="/images/landing/delivery-ride.png"
              alt="Grocery delivery by BodaGo rider"
              className="h-36 w-full object-cover sm:h-48 lg:h-56"
              loading="lazy"
            />
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className={`text-xs uppercase tracking-[0.3em] sm:text-sm sm:tracking-[0.35em] ${palette.sectionLabel}`}>Powered by BodaGo</p>
              <h3 className={`mt-2 text-2xl font-bold sm:mt-3 sm:text-3xl md:text-4xl ${palette.accent}`}>
                Rides, delivery & self-checkout — connected.
              </h3>
            </div>
            <p className={`max-w-2xl text-xs leading-6 sm:text-sm sm:leading-7 md:text-right ${palette.muted}`}>
              Supermartkera plugs into BodaGo's rider network for real-time ride matching
              and doorstep delivery.{' '}
              {identity ? 'Tap a card to get started.' : 'Sign in to get started.'}
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:mt-8 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              onClick={() => handleGatedNavigate('book-ride', 'Sign in to book a ride.')}
              className={`sk-card-lift group flex flex-col gap-4 rounded-2xl border p-4 text-left sm:flex-row sm:items-center sm:rounded-[1.75rem] sm:p-6 ${palette.softPanel}`}
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br sm:h-14 sm:w-14 ${palette.iconBg}`}>
                <Bike className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className={`text-lg font-semibold sm:text-xl ${palette.accent}`}>Book a ride</h4>
                <p className={`mt-1 text-sm leading-6 ${palette.muted}`}>Get picked up fast with live matching to a nearby BodaGo rider.</p>
              </div>
              <span className={`inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium sm:px-3 sm:py-1.5 sm:text-xs ${palette.outline}`}>
                {identity ? <FiArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <FiLock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                {identity ? 'Book now' : 'Sign in'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleGatedNavigate('delivery', 'Sign in to request delivery.')}
              className={`sk-card-lift group flex flex-col gap-4 rounded-2xl border p-4 text-left sm:flex-row sm:items-center sm:rounded-[1.75rem] sm:p-6 ${palette.softPanel}`}
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br sm:h-14 sm:w-14 ${palette.iconBg}`}>
                <FiTruck className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className={`text-lg font-semibold sm:text-xl ${palette.accent}`}>Delivery</h4>
                <p className={`mt-1 text-sm leading-6 ${palette.muted}`}>Have your order dropped off wherever you are, by a BodaGo rider.</p>
              </div>
              <span className={`inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium sm:px-3 sm:py-1.5 sm:text-xs ${palette.outline}`}>
                {identity ? <FiArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <FiLock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                {identity ? 'Get delivery' : 'Sign in'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleGatedNavigate('shop', 'Sign in for self-checkout.')}
              className={`sk-card-lift group flex flex-col gap-4 rounded-2xl border p-4 text-left sm:col-span-2 sm:flex-row sm:items-center sm:rounded-[1.75rem] sm:p-6 lg:col-span-1 ${palette.softPanel}`}
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br sm:h-14 sm:w-14 ${palette.iconBg}`}>
                <FiShoppingCart className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className={`text-lg font-semibold sm:text-xl ${palette.accent}`}>Self-checkout</h4>
                <p className={`mt-1 text-sm leading-6 ${palette.muted}`}>Scan, pay, and skip the queue with BodaGo's self-service checkout.</p>
              </div>
              <span className={`inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium sm:px-3 sm:py-1.5 sm:text-xs ${palette.outline}`}>
                {identity ? <FiArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <FiLock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                {identity ? 'Check out' : 'Sign in'}
              </span>
            </button>
          </div>
        </section>

        <section id="services" className="sk-scroll-reveal mt-14 sm:mt-20">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-12">
            <div>
              <p className={`text-xs uppercase tracking-[0.3em] sm:text-sm sm:tracking-[0.35em] ${palette.sectionLabel}`}>Services</p>
              <h3 className={`mt-2 text-2xl font-bold sm:mt-3 sm:text-3xl md:text-4xl ${palette.accent}`}>
                Built around how supermarkets actually work.
              </h3>
              <p className={`mt-3 max-w-xl text-sm leading-7 ${palette.muted}`}>
                From billing to stock movement, the platform keeps the workflow simple for staff and
                clear for management.
              </p>
              <div className="mt-6 hidden overflow-hidden rounded-2xl border lg:block">
                <img
                  src="/images/landing/pos-dashboard.png"
                  alt="Supermartkera POS and inventory dashboard"
                  className="sk-animate-float h-56 w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              {serviceCards.map((service) => {
                const Icon = service.icon;
                return (
                  <article key={service.title} className={`sk-card-lift rounded-2xl border p-4 sm:rounded-[1.75rem] sm:p-5 ${palette.softPanel}`}>
                    <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br sm:mb-4 sm:h-12 sm:w-12 sm:rounded-2xl ${palette.iconBg}`}>
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <h4 className={`text-base font-semibold sm:text-lg ${palette.accent}`}>{service.title}</h4>
                    <p className={`mt-2 text-xs leading-6 sm:text-sm sm:leading-7 ${palette.muted}`}>{service.copy}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="sk-scroll-reveal mt-14 grid gap-4 sm:mt-20 sm:gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className={`rounded-2xl border p-4 sm:rounded-[2rem] sm:p-6 ${palette.panel}`}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-400 sm:h-12 sm:w-12 sm:rounded-2xl">
                <FiShield className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <p className={`text-xs uppercase tracking-[0.25em] sm:text-sm sm:tracking-[0.3em] ${palette.sectionLabel}`}>Why it feels good</p>
                <h3 className={`text-xl font-semibold sm:text-2xl ${palette.accent}`}>
                  Simple for daily use, professional for business.
                </h3>
              </div>
            </div>

            <div className="mt-4 space-y-2.5 sm:mt-6 sm:space-y-3">
              {customerBenefits.map((point) => (
                <div key={point} className={`flex gap-2.5 rounded-xl border p-3 sm:gap-3 sm:rounded-2xl sm:p-4 ${palette.softPanel}`}>
                  <FiCheckCircle className={`mt-0.5 h-4 w-4 shrink-0 sm:h-5 sm:w-5 ${palette.check}`} />
                  <p className={`text-xs leading-5 sm:text-sm sm:leading-6 ${theme === 'dark' ? 'text-emerald-50/85' : 'text-slate-700'}`}>{point}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {[
              { icon: FiUsers, title: 'Customer-friendly', copy: 'Designed so shoppers enjoy a smoother experience without extra friction.', color: 'emerald' },
              { icon: FiHeadphones, title: 'Affordable support', copy: 'A budget-friendly system that still feels polished, fast, and modern.', color: 'green' },
              { icon: FiTruck, title: 'Supplier-ready', copy: 'Keep deliveries and replenishment aligned with store demand.', color: 'teal' },
              { icon: FiStar, title: 'Reports-first', copy: 'Turn everyday data into useful store decisions.', color: 'lime' }
            ].map(({ icon: Icon, title, copy }) => (
              <div key={title} className={`sk-card-lift rounded-xl border p-3 sm:rounded-[1.5rem] sm:p-5 ${palette.softPanel}`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br sm:h-11 sm:w-11 sm:rounded-2xl ${palette.iconBg}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h4 className={`mt-3 text-sm font-semibold sm:mt-4 sm:text-lg ${palette.accent}`}>{title}</h4>
                <p className={`mt-1.5 text-[11px] leading-5 sm:mt-2 sm:text-xs sm:leading-6 ${palette.muted}`}>{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="sk-scroll-reveal mt-14 grid gap-4 sm:mt-20 sm:gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className={`rounded-2xl border p-4 sm:rounded-[2rem] sm:p-6 ${palette.panel}`}>
            <p className={`text-xs uppercase tracking-[0.3em] sm:text-sm sm:tracking-[0.35em] ${palette.sectionLabel}`}>Contact us</p>
            <h3 className={`mt-2 text-2xl font-bold sm:mt-3 sm:text-3xl ${palette.accent}`}>
              Talk to the Supermartkera team.
            </h3>
            <p className={`mt-3 text-sm leading-7 ${palette.muted}`}>
              Ask about setup, pricing, onboarding, POS, inventory, scan-and-pay, or reports.
            </p>

            {identity && myMessages.length > 0 && (
              <div className="mt-8">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Your messages</p>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {myMessages.map((m) => (
                    <div key={m.id} className={`rounded-2xl border p-3 ${palette.softPanel}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          m.is_public
                            ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                            : 'border-amber-300/30 bg-amber-300/10 text-amber-200'
                        }`}>
                          {m.is_public ? <FiGlobe className="h-3 w-3" /> : <FiLock className="h-3 w-3" />}
                          {m.is_public ? 'Public' : 'Private'}
                        </span>
                        <span className={`text-[10px] ${palette.muted}`}>{fmtBoardTime(m.created_at)}</span>
                      </div>
                      <p className={`mt-2 text-sm leading-6 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{m.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleContactSubmit} className={`rounded-2xl border p-4 sm:rounded-[2rem] sm:p-6 ${palette.panel}`}>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
              <div>
                <label className={`mb-1.5 block text-xs font-medium sm:mb-2 sm:text-sm ${theme === 'dark' ? 'text-emerald-100' : 'text-slate-700'}`}>Your name</label>
                <input
                  name="name"
                  value={contactForm.name}
                  onChange={handleContactChange}
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400/60 sm:rounded-2xl sm:px-4 sm:py-3 ${palette.input}`}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className={`mb-1.5 block text-xs font-medium sm:mb-2 sm:text-sm ${theme === 'dark' ? 'text-emerald-100' : 'text-slate-700'}`}>Email address</label>
                <input
                  type="email"
                  name="email"
                  value={contactForm.email}
                  onChange={handleContactChange}
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400/60 sm:rounded-2xl sm:px-4 sm:py-3 ${palette.input}`}
                  placeholder="jane@store.com"
                />
              </div>
            </div>

            <div className="mt-3 sm:mt-4">
              <label className={`mb-1.5 block text-xs font-medium sm:mb-2 sm:text-sm ${theme === 'dark' ? 'text-emerald-100' : 'text-slate-700'}`}>Company or store</label>
              <input
                name="company"
                value={contactForm.company}
                onChange={handleContactChange}
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400/60 sm:rounded-2xl sm:px-4 sm:py-3 ${palette.input}`}
                placeholder="Your supermarket name"
              />
            </div>

            <div className="mt-3 sm:mt-4">
              <label className={`mb-1.5 block text-xs font-medium sm:mb-2 sm:text-sm ${theme === 'dark' ? 'text-emerald-100' : 'text-slate-700'}`}>Message</label>
              <textarea
                name="message"
                value={contactForm.message}
                onChange={handleContactChange}
                rows="4"
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400/60 sm:rounded-2xl sm:px-4 sm:py-3 ${palette.input}`}
                placeholder="Tell us what you need: POS, scan and pay, inventory, reports, or full supermarket management."
              />
            </div>

            {identity && hasWallet ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition sm:gap-3 sm:rounded-2xl sm:p-4 ${
                  contactForm.isPublic ? 'border-emerald-400/40 bg-emerald-400/10' : palette.softPanel
                }`}>
                  <input
                    type="radio"
                    name="visibility"
                    className="mt-1"
                    checked={contactForm.isPublic}
                    onChange={() => setContactForm((prev) => ({ ...prev, isPublic: true }))}
                  />
                  <span>
                    <span className={`flex items-center gap-2 text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      <FiGlobe className="h-4 w-4" /> Public
                    </span>
                    <span className={`mt-1 block text-xs leading-5 ${palette.muted}`}>Everyone can see this on the community board.</span>
                  </span>
                </label>
                <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition sm:gap-3 sm:rounded-2xl sm:p-4 ${
                  !contactForm.isPublic ? 'border-amber-400/40 bg-amber-400/10' : palette.softPanel
                }`}>
                  <input
                    type="radio"
                    name="visibility"
                    className="mt-1"
                    checked={!contactForm.isPublic}
                    onChange={() => setContactForm((prev) => ({ ...prev, isPublic: false }))}
                  />
                  <span>
                    <span className={`flex items-center gap-2 text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      <FiLock className="h-4 w-4" /> Private
                    </span>
                    <span className={`mt-1 block text-xs leading-5 ${palette.muted}`}>Only you and the Supermartkera team can see this.</span>
                  </span>
                </label>
              </div>
            ) : identity ? (
              <p className={`mt-4 text-xs leading-5 ${palette.muted}`}>
                Messages here are public — anyone can see them, but the Supermartkera team can remove any message.{' '}
                <Link to="/ican-wallet" className="underline">Connect your ICAN wallet</Link> to unlock private messages.
              </p>
            ) : (
              <p className={`mt-4 text-xs leading-5 ${palette.muted}`}>
                Messages here are public — anyone can see them, but the Supermartkera team can remove any message.
                Sign in with an ICAN wallet to choose public or private for your own messages.
              </p>
            )}

            <button
              type="submit"
              disabled={submitState === 'sending' || !contactForm.message.trim()}
              className="sk-btn-primary mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50 sm:mt-5 sm:w-auto sm:rounded-2xl sm:px-6 sm:py-4 sm:text-base"
            >
              <FiMail className="h-4 w-4 sm:h-5 sm:w-5" />
              {submitState === 'sending' ? 'Posting…' : 'Contact us now'}
            </button>
            {submitState === 'sent' && (
              <p className="mt-3 text-sm text-emerald-400">Thanks — your message has been posted.</p>
            )}
            {submitState === 'error' && (
              <p className="mt-3 text-sm text-rose-400">Something went wrong sending that. Please try again.</p>
            )}
          </form>
        </section>

        <section className="sk-scroll-reveal mt-14 sm:mt-20">
          <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className={`text-xs uppercase tracking-[0.3em] sm:text-sm sm:tracking-[0.35em] ${palette.sectionLabel}`}>Community board</p>
              <h3 className={`mt-2 text-2xl font-bold sm:mt-3 sm:text-3xl ${palette.accent}`}>
                Public questions from the Supermartkera community.
              </h3>
            </div>
            <p className={`max-w-2xl text-xs leading-6 sm:text-sm sm:leading-7 md:text-right ${palette.muted}`}>
              Anyone can read these. The Supermartkera team can remove any message.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:mt-8 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
            {threads.map((m) => {
              const isExpanded = expandedId === m.id;
              const canReply = !!(identity || guestIdentity?.name);
              return (
                <article
                  key={m.id}
                  className={`sk-card-lift rounded-2xl border p-4 transition sm:rounded-[1.75rem] sm:p-6 ${palette.softPanel} ${isExpanded ? 'md:col-span-2 xl:col-span-3' : ''}`}
                >
                  <div role="button" tabIndex={0} onClick={() => handleToggleThread(m.id)} className="w-full cursor-pointer text-left">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br sm:h-10 sm:w-10 ${palette.iconBg}`}>
                        <FiUser className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-semibold ${palette.accent}`}>{m.name || 'Website visitor'}</p>
                        <p className={`text-[11px] sm:text-xs ${palette.muted}`}>{fmtBoardTime(m.created_at)}</p>
                      </div>
                      {m.reward_reason && (
                        <span className="flex-shrink-0 rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                          🪙 Rewarded
                        </span>
                      )}
                      {m.replies.length > 0 && (
                        <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${palette.outline}`}>
                          {m.replies.length} {m.replies.length === 1 ? 'reply' : 'replies'}
                        </span>
                      )}
                    </div>
                    <p className={`mt-4 text-sm leading-7 ${palette.muted}`}>{m.message}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLike(m.id)}
                    disabled={m.likedByMe}
                    className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:cursor-default sm:mt-3 sm:px-3 sm:text-xs ${
                      m.likedByMe ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400' : `${palette.outline} disabled:opacity-100`
                    }`}
                  >
                    <FiThumbsUp className="h-3.5 w-3.5" /> {m.likeCount || 0}
                  </button>

                  {isExpanded && (
                    <div className={`mt-4 space-y-2.5 border-t pt-3 sm:mt-5 sm:space-y-3 sm:pt-4 ${palette.divider}`}>
                      {m.replies.map((r) => (
                        <div
                          key={r.id}
                          className={`rounded-xl border p-2.5 sm:rounded-2xl sm:p-3 ${
                            r.sender_role === 'dev' ? 'border-emerald-400/30 bg-emerald-400/10' : palette.softPanel
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-[11px] font-semibold sm:text-xs ${
                              r.sender_role === 'dev' ? 'text-emerald-400' : palette.accent
                            }`}>
                              {r.sender_role === 'dev' ? 'Supermartkera Team' : (r.name || 'Website visitor')}
                            </p>
                            <div className="flex items-center gap-2">
                              {r.reward_reason && (
                                <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                                  🪙 Correct answer
                                </span>
                              )}
                              <span className={`text-[10px] ${palette.muted}`}>{fmtBoardTime(r.created_at)}</span>
                            </div>
                          </div>
                          <p className={`mt-1 text-sm leading-6 ${palette.muted}`}>{r.message}</p>
                          <button
                            type="button"
                            onClick={() => handleLike(r.id)}
                            disabled={r.likedByMe}
                            className={`mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition disabled:cursor-default sm:mt-2 sm:px-2.5 sm:text-[11px] ${
                              r.likedByMe ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400' : `${palette.outline} disabled:opacity-100`
                            }`}
                          >
                            <FiThumbsUp className="h-3 w-3" /> {r.likeCount || 0}
                          </button>
                        </div>
                      ))}
                      {m.replies.length === 0 && (
                        <p className={`text-xs ${palette.muted}`}>No replies yet.</p>
                      )}

                      {!canReply && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            value={guestReplyForm.name}
                            onChange={(e) => setGuestReplyForm((p) => ({ ...p, name: e.target.value }))}
                            placeholder="Your name"
                            className={`rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400/60 ${palette.input}`}
                          />
                          <input
                            value={guestReplyForm.email}
                            onChange={(e) => setGuestReplyForm((p) => ({ ...p, email: e.target.value }))}
                            placeholder="Your email"
                            type="email"
                            className={`rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400/60 ${palette.input}`}
                          />
                          <button
                            type="button"
                            onClick={handleSaveGuestReplyIdentity}
                            disabled={!guestReplyForm.name.trim()}
                            className={`rounded-xl border px-3 py-2 text-xs font-medium transition disabled:opacity-40 sm:col-span-2 ${palette.outline}`}
                          >
                            Continue as this name
                          </button>
                        </div>
                      )}

                      {canReply && (
                        <div className="flex items-center gap-2">
                          <input
                            value={replyDraft}
                            onChange={(e) => setReplyDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSendReply(m.id); }}
                            placeholder={`Reply as ${identity?.name || guestIdentity?.name}…`}
                            className={`flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400/60 ${palette.input}`}
                          />
                          <button
                            type="button"
                            onClick={() => handleSendReply(m.id)}
                            disabled={replyState === 'sending' || !replyDraft.trim()}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white transition disabled:opacity-40"
                          >
                            <FiSend className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      {replyState === 'error' && <p className="text-xs text-rose-400">Reply failed — please try again.</p>}
                    </div>
                  )}
                </article>
              );
            })}
            {threads.length === 0 && (
              <p className={`text-sm ${palette.muted}`}>No public messages yet — be the first to ask something.</p>
            )}
          </div>
        </section>

        {contributors.length > 0 && (
          <section className="sk-scroll-reveal mt-8 sm:mt-10">
            <p className={`text-xs uppercase tracking-[0.3em] sm:text-sm sm:tracking-[0.35em] ${palette.sectionLabel}`}>Community members</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {contributors.map((c) => (
                <button
                  key={c.authId || 'guests'}
                  type="button"
                  onClick={() => handleSelectContributor(c)}
                  disabled={c.isGuestGroup}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-default ${palette.outline}`}
                >
                  <FiUser className="h-3 w-3" /> {c.name}
                  <span className={palette.muted}>· {c.count} {c.count === 1 ? 'message' : 'messages'}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {selectedContributor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedContributor(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-xs rounded-2xl border p-6 ${palette.panel}`}
          >
            <div className="flex items-center justify-between">
              <p className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {selectedContributor.name}
              </p>
              <button onClick={() => setSelectedContributor(null)} className={palette.muted}>
                <FiX className="h-4 w-4" />
              </button>
            </div>
            <p className={`mt-2 text-sm ${palette.muted}`}>
              {selectedContributor.count} {selectedContributor.count === 1 ? 'message' : 'messages'} on the community board
            </p>
            {identity?.authId === selectedContributor.authId && (
              <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3">
                <p className="text-xs uppercase tracking-wide text-emerald-400">Your ICAN balance</p>
                <p className="mt-1 text-xl font-bold text-emerald-300">
                  {balanceLoading ? '…' : `${(contributorBalance ?? 0).toFixed(2)} ICAN`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <footer className={`relative z-10 border-t px-4 py-5 text-center text-[11px] sm:px-6 sm:py-6 sm:text-xs ${palette.muted} ${palette.header}`}>
        <p>© {new Date().getFullYear()} Supermartkera · Built on the ICAN ecosystem</p>
      </footer>
    </div>
  );
};

export default SupermartkeraLanding;
