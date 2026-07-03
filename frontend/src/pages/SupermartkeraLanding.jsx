import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  FiMapPin,
  FiPackage,
  FiPhone,
  FiMoon,
  FiSend,
  FiSun,
  FiShield,
  FiShoppingBag,
  FiStar,
  FiThumbsUp,
  FiTruck,
  FiUser,
  FiUsers,
  FiX,
  FiZap
} from 'react-icons/fi';
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

const contactMethods = [
  { icon: FiMail, label: 'Email', value: 'hello@supermartkera.com' },
  { icon: FiPhone, label: 'Phone', value: '+256 700 000 000' },
  { icon: FiMapPin, label: 'Location', value: 'Kampala, Uganda' }
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
    shell: 'bg-[#07111f] text-white',
    header: 'bg-white/5 border-white/10',
    panel: 'bg-slate-950/60 border-white/10',
    softPanel: 'bg-white/8 border-white/10',
    muted: 'text-slate-300',
    body: 'text-slate-300',
    accent: 'text-cyan-100',
    button: 'bg-white text-slate-950',
    outline: 'border-white/15 bg-white/8 text-white hover:bg-white/12',
    input: 'bg-slate-950/50 border-white/10 text-white placeholder:text-slate-500'
  },
  light: {
    shell: 'bg-[linear-gradient(180deg,#f8fafc_0%,#eff6ff_45%,#ffffff_100%)] text-slate-900',
    header: 'bg-white/80 border-slate-200',
    panel: 'bg-white border-slate-200 shadow-xl shadow-slate-200/40',
    softPanel: 'bg-slate-50 border-slate-200',
    muted: 'text-slate-600',
    body: 'text-slate-600',
    accent: 'text-slate-700',
    button: 'bg-slate-950 text-white',
    outline: 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50',
    input: 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  }
};

const SupermartkeraLanding = () => {
  const { theme, toggleTheme } = useTheme();
  const palette = themeStyles[theme];
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

  return (
    <div className={`min-h-screen ${palette.shell}`}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute -top-20 left-10 h-72 w-72 rounded-full blur-3xl ${theme === 'dark' ? 'bg-cyan-400/20' : 'bg-cyan-200/50'}`} />
        <div className={`absolute top-44 right-0 h-80 w-80 rounded-full blur-3xl ${theme === 'dark' ? 'bg-violet-500/20' : 'bg-violet-200/50'}`} />
        <div className={`absolute bottom-10 left-1/3 h-96 w-96 rounded-full blur-3xl ${theme === 'dark' ? 'bg-amber-400/10' : 'bg-amber-100/70'}`} />
      </div>

      <header className={`relative z-10 border-b backdrop-blur-xl ${palette.header}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-600 shadow-lg shadow-cyan-500/20">
              <FiShoppingBag className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-cyan-500/70">Supermarket operating system</p>
              <h1 className="text-xl font-semibold tracking-wide">Supermartkera</h1>
            </div>
          </div>

          <button
            onClick={toggleTheme}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition md:hidden ${palette.outline}`}
          >
            {theme === 'dark' ? <FiSun className="h-4 w-4" /> : <FiMoon className="h-4 w-4" />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>

          <div className="hidden items-center gap-3 md:flex">
            <button
              onClick={toggleTheme}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition ${palette.outline}`}
            >
              {theme === 'dark' ? <FiSun className="h-4 w-4" /> : <FiMoon className="h-4 w-4" />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <button
              onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              className={`rounded-full border px-5 py-2.5 text-sm font-medium transition ${palette.outline}`}
            >
              Contact us
            </button>
              <Link
                to="/login"
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition hover:scale-[1.02] ${palette.button}`}
              >
                Open sign in
                <FiArrowRight className="h-4 w-4" />
              </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 pb-20 pt-10 lg:px-8 lg:pt-16">
        <section className="grid gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-200">
              <FiStar className="h-4 w-4 text-amber-300" />
              Clean UX for customers, staff, and managers
            </div>

            <div className="space-y-5">
              <h2 className={`max-w-3xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl ${palette.accent}`}>
                A professional landing page for supermarkets that want to run better.
              </h2>
              <p className={`max-w-2xl text-lg leading-8 md:text-xl ${palette.body}`}>
                Supermartkera helps supermarket teams manage POS, scan-and-pay, inventory, reports,
                and supplier activity in one clean, affordable place.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-violet-600 px-6 py-4 font-semibold text-slate-950 shadow-2xl shadow-cyan-500/20 transition hover:scale-[1.02]"
              >
                Open sign in
                <FiArrowRight className="h-5 w-5" />
              </Link>
              <button
                onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
                className={`inline-flex items-center gap-3 rounded-2xl border px-6 py-4 font-semibold backdrop-blur-md transition hover:scale-[1.01] ${palette.outline}`}
              >
                Explore services
                <FiArrowRight className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { value: 'POS', label: 'Checkout ready' },
                { value: 'Scan', label: 'Barcode friendly' },
                { value: 'Stock', label: 'Inventory control' },
                { value: 'Reports', label: 'Decision support' }
              ].map((item) => (
                <div key={item.label} className={`rounded-2xl border p-4 backdrop-blur-md ${palette.softPanel}`}>
                  <p className="text-2xl font-black">{item.value}</p>
                  <p className={`mt-1 text-xs uppercase tracking-[0.25em] ${palette.muted}`}>{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-cyan-400/20 via-transparent to-fuchsia-400/20 blur-2xl" />
            <div className={`relative rounded-[2rem] border p-6 ${palette.panel}`}>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm uppercase tracking-[0.3em] ${theme === 'dark' ? 'text-cyan-200/70' : 'text-slate-500'}`}>
                      What Supermartkera does
                    </p>
                    <h3 className={`mt-2 text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      One system. Clear control. Better service.
                    </h3>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                    <FiZap className="h-6 w-6" />
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {[
                    'A smoother shopping experience for customers',
                    'Faster checkout with POS and scan-and-pay',
                    'Easy inventory management for supermarkets',
                    'Clear reports for better business decisions'
                  ].map((feature) => (
                    <div key={feature} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                      <FiCheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
                      <p className="text-sm leading-6 text-slate-200">{feature}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="services" className="mt-20">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-cyan-500/70">Services</p>
              <h3 className={`mt-3 text-3xl font-bold md:text-4xl ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Built around how supermarkets actually work.
              </h3>
            </div>
            <p className={`max-w-2xl text-sm leading-7 md:text-right ${palette.muted}`}>
              From billing to stock movement, the platform keeps the workflow simple for staff and
              clear for management.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {serviceCards.map((service) => {
              const Icon = service.icon;
              return (
                <article key={service.title} className={`rounded-[1.75rem] border p-6 transition hover:-translate-y-1 ${palette.softPanel}`}>
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20 text-cyan-200">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h4 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{service.title}</h4>
                  <p className={`mt-3 leading-7 ${palette.muted}`}>{service.copy}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-20 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className={`rounded-[2rem] border p-6 ${palette.panel}`}>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                <FiShield className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/70">Why it feels good</p>
                <h3 className={`text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Simple for daily use, professional for business.
                </h3>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {customerBenefits.map((point) => (
                <div key={point} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <FiCheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-300" />
                  <p className="text-sm leading-6 text-slate-200">{point}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className={`rounded-[1.5rem] border p-6 ${palette.softPanel}`}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200">
                <FiUsers className="h-6 w-6" />
              </div>
              <h4 className={`mt-4 text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Customer-friendly</h4>
              <p className={`mt-3 text-sm leading-7 ${palette.muted}`}>
                Designed so shoppers enjoy a smoother experience without extra friction.
              </p>
            </div>
            <div className={`rounded-[1.5rem] border p-6 ${palette.softPanel}`}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-400/15 text-violet-200">
                <FiHeadphones className="h-6 w-6" />
              </div>
              <h4 className={`mt-4 text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Affordable support</h4>
              <p className={`mt-3 text-sm leading-7 ${palette.muted}`}>
                A budget-friendly system that still feels polished, fast, and modern.
              </p>
            </div>
            <div className={`rounded-[1.5rem] border p-6 ${palette.softPanel}`}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-200">
                <FiTruck className="h-6 w-6" />
              </div>
              <h4 className={`mt-4 text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Supplier-ready</h4>
              <p className={`mt-3 text-sm leading-7 ${palette.muted}`}>
                Keep deliveries and replenishment aligned with store demand.
              </p>
            </div>
            <div className={`rounded-[1.5rem] border p-6 ${palette.softPanel}`}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-400/15 text-rose-200">
                <FiStar className="h-6 w-6" />
              </div>
              <h4 className={`mt-4 text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Reports-first</h4>
              <p className={`mt-3 text-sm leading-7 ${palette.muted}`}>
                Turn everyday data into useful store decisions.
              </p>
            </div>
          </div>
        </section>

        <section id="contact" className="mt-20 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className={`rounded-[2rem] border p-6 ${palette.panel}`}>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-500/70">Contact us</p>
            <h3 className={`mt-3 text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {identity ? `Welcome back, ${identity.name}.` : 'Talk to the Supermartkera team.'}
            </h3>
            <p className={`mt-4 text-sm leading-7 ${palette.muted}`}>
              Ask about setup, pricing, onboarding, POS, inventory, scan-and-pay, or reports.
            </p>

            <div className="mt-8 space-y-4">
              {contactMethods.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className={`flex items-center gap-4 rounded-2xl border p-4 ${palette.softPanel}`}>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-cyan-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{item.label}</p>
                      <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{item.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {identity && myMessages.length > 0 && (
              <div className="mt-8">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Your messages</p>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {myMessages.map((m) => (
                    <div key={m.id} className={`rounded-2xl border p-3 ${palette.softPanel}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          m.is_public
                            ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200'
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

          <form onSubmit={handleContactSubmit} className={`rounded-[2rem] border p-6 ${palette.panel}`}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={`mb-2 block text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>Your name</label>
                <input
                  name="name"
                  value={contactForm.name}
                  onChange={handleContactChange}
                  className={`w-full rounded-2xl border px-4 py-3 outline-none transition focus:border-cyan-300/60 ${palette.input}`}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className={`mb-2 block text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>Email address</label>
                <input
                  type="email"
                  name="email"
                  value={contactForm.email}
                  onChange={handleContactChange}
                  className={`w-full rounded-2xl border px-4 py-3 outline-none transition focus:border-cyan-300/60 ${palette.input}`}
                  placeholder="jane@store.com"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className={`mb-2 block text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>Company or store</label>
              <input
                name="company"
                value={contactForm.company}
                onChange={handleContactChange}
                className={`w-full rounded-2xl border px-4 py-3 outline-none transition focus:border-cyan-300/60 ${palette.input}`}
                placeholder="Your supermarket name"
              />
            </div>

            <div className="mt-4">
              <label className={`mb-2 block text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>Message</label>
              <textarea
                name="message"
                value={contactForm.message}
                onChange={handleContactChange}
                rows="5"
                className={`w-full rounded-2xl border px-4 py-3 outline-none transition focus:border-cyan-300/60 ${palette.input}`}
                placeholder="Tell us what you need: POS, scan and pay, inventory, reports, or full supermarket management."
              />
            </div>

            {identity && hasWallet ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                  contactForm.isPublic ? 'border-cyan-300/50 bg-cyan-300/10' : palette.softPanel
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
                <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                  !contactForm.isPublic ? 'border-amber-300/50 bg-amber-300/10' : palette.softPanel
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
              className="mt-5 inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-violet-600 px-6 py-4 font-semibold text-slate-950 shadow-xl shadow-cyan-500/15 transition hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
            >
              <FiMail className="h-5 w-5" />
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

        <section className="mt-20">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-cyan-500/70">Community board</p>
              <h3 className={`mt-3 text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Public questions from the Supermartkera community.
              </h3>
            </div>
            <p className={`max-w-2xl text-sm leading-7 md:text-right ${palette.muted}`}>
              Anyone can read these. The Supermartkera team can remove any message.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {threads.map((m) => {
              const isExpanded = expandedId === m.id;
              const canReply = !!(identity || guestIdentity?.name);
              return (
                <article
                  key={m.id}
                  className={`rounded-[1.75rem] border p-6 transition ${palette.softPanel} ${isExpanded ? 'md:col-span-2 xl:col-span-3' : ''}`}
                >
                  <div role="button" tabIndex={0} onClick={() => handleToggleThread(m.id)} className="w-full cursor-pointer text-left">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/20 to-violet-500/20 text-cyan-200">
                        <FiUser className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{m.name || 'Website visitor'}</p>
                        <p className={`text-xs ${palette.muted}`}>{fmtBoardTime(m.created_at)}</p>
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
                    className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition disabled:cursor-default ${
                      m.likedByMe ? 'border-cyan-300/50 bg-cyan-300/10 text-cyan-300' : `${palette.outline} disabled:opacity-100`
                    }`}
                  >
                    <FiThumbsUp className="h-3.5 w-3.5" /> {m.likeCount || 0}
                  </button>

                  {isExpanded && (
                    <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
                      {m.replies.map((r) => (
                        <div
                          key={r.id}
                          className={`rounded-2xl border p-3 ${
                            r.sender_role === 'dev' ? 'border-cyan-300/40 bg-cyan-300/10' : palette.softPanel
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs font-semibold ${
                              r.sender_role === 'dev' ? 'text-cyan-300' : theme === 'dark' ? 'text-white' : 'text-slate-900'
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
                            className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition disabled:cursor-default ${
                              r.likedByMe ? 'border-cyan-300/50 bg-cyan-300/10 text-cyan-300' : `${palette.outline} disabled:opacity-100`
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
                            className={`rounded-xl border px-3 py-2 text-sm outline-none focus:border-cyan-300/60 ${palette.input}`}
                          />
                          <input
                            value={guestReplyForm.email}
                            onChange={(e) => setGuestReplyForm((p) => ({ ...p, email: e.target.value }))}
                            placeholder="Your email"
                            type="email"
                            className={`rounded-xl border px-3 py-2 text-sm outline-none focus:border-cyan-300/60 ${palette.input}`}
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
                            className={`flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:border-cyan-300/60 ${palette.input}`}
                          />
                          <button
                            type="button"
                            onClick={() => handleSendReply(m.id)}
                            disabled={replyState === 'sending' || !replyDraft.trim()}
                            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-600 text-white transition disabled:opacity-40"
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
          <section className="mt-10">
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-500/70">Community members</p>
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
              <div className="mt-4 rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-3">
                <p className="text-xs uppercase tracking-wide text-cyan-300">Your ICAN balance</p>
                <p className="mt-1 text-xl font-bold text-cyan-200">
                  {balanceLoading ? '…' : `${(contributorBalance ?? 0).toFixed(2)} ICAN`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Minimal footer */}
      <footer className={`relative z-10 border-t py-6 px-6 text-center text-xs ${palette.muted} ${palette.header}`}>
        <p>© {new Date().getFullYear()} Supermartkera · Built on the ICAN ecosystem</p>
      </footer>
    </div>
  );
};

export default SupermartkeraLanding;
