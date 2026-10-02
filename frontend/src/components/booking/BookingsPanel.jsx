import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiCalendar,
  FiClock,
  FiTrash2,
  FiMessageCircle,
  FiPhone,
  FiVideo,
  FiSun,
  FiPauseCircle,
  FiXCircle,
  FiZap,
  FiInfo,
  FiCheckCircle,
  FiSearch,
  FiRefreshCw,
  FiChevronDown,
  FiUser,
  FiUsers,
  FiAlertCircle,
  FiCheck,
  FiX,
  FiInbox,
} from 'react-icons/fi';
import {
  getStoreBookings,
  subscribeToStoreBookings,
  updateBookingStatus,
  getBookableServices,
  getAvailabilityRules,
  saveAvailabilityRule,
  deleteAvailabilityRule,
  ALL_DAY_AVAILABILITY,
} from '../../services/bookingService';
import BookingChatCallPanel from './BookingChatCallPanel';
import BookingFormEditor from './BookingFormEditor';
import { BookingTypeBadge, getBookingType } from './BookingTypePicker';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_STYLES = {
  requested: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
  no_show: 'bg-red-100 text-red-600',
};
const STATUS_LABELS = {
  requested: 'Needs approval',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};
// Left accent bar on each card so status reads at a glance down the list.
const STATUS_BAR = {
  requested: 'bg-amber-400',
  confirmed: 'bg-blue-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-gray-300',
  no_show: 'bg-red-400',
};
const ACTIVE_STATUSES = ['requested', 'confirmed'];

const pad = (n) => String(n).padStart(2, '0');
const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISODate(new Date());

// "Today" / "Tomorrow" / "Yesterday" / "Fri, 3 Oct" — what a person would say.
const friendlyDate = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  const diff = Math.round((d - new Date(`${todayISO()}T00:00:00`)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  });
};
const shortDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
const initials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';
const phoneHref = (p) => `tel:${String(p || '').replace(/[^\d+]/g, '')}`;

const FILTERS = [
  { id: 'pending', label: 'Needs approval' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'all', label: 'All' },
];

const matchesFilter = (b, filter, today) => {
  const date = b.booking_date;
  switch (filter) {
    case 'pending':
      return b.status === 'requested';
    case 'today':
      return date === today && ACTIVE_STATUSES.includes(b.status);
    case 'upcoming':
      return date >= today && ACTIVE_STATUSES.includes(b.status);
    case 'past':
      return date < today || !ACTIVE_STATUSES.includes(b.status);
    default:
      return true;
  }
};

// Tiny self-dismissing toast — replaces the blocking alert() the old panel used.
const Toast = ({ toast, onClose }) => {
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(onClose, toast.type === 'error' ? 6000 : 3000);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  if (!toast) return null;
  const isError = toast.type === 'error';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-xl animate-fade-in-up ${
        isError ? 'bg-rose-600' : 'bg-gray-900'
      }`}
    >
      {isError ? <FiAlertCircle className="h-4 w-4 flex-shrink-0" /> : <FiCheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-400" />}
      <span>{toast.message}</span>
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100" aria-label="Dismiss">
        <FiX className="h-4 w-4" />
      </button>
    </div>
  );
};

const SkeletonCards = () => (
  <div className="space-y-2" aria-busy="true">
    {[0, 1, 2].map((i) => (
      <div key={i} className="flex gap-3 rounded-xl border border-gray-100 p-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-gray-100" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-1/4 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
    ))}
  </div>
);

const BookingCard = ({ b, index, busy, isOpen, expanded, onToggleExpand, onThread, onCall, onStatus, staffIdentity, autoStart, onAutoStarted }) => {
  // Destructive actions (cancel / no-show) ask once, inline — no popup.
  const [confirming, setConfirming] = useState(null);
  useEffect(() => {
    if (!confirming) return undefined;
    const t = setTimeout(() => setConfirming(null), 5000);
    return () => clearTimeout(t);
  }, [confirming]);

  const type = b.products?.booking_type;
  const isActive = ACTIVE_STATUSES.includes(b.status);
  const responses = b.form_responses && typeof b.form_responses === 'object' ? Object.entries(b.form_responses) : [];
  const hasDetails = Boolean(b.notes) || responses.length > 0;
  const unit = type === 'room' ? 'room' : 'ticket';

  const runDestructive = (status) => {
    if (confirming === status) {
      setConfirming(null);
      onStatus(b.id, status);
    } else {
      setConfirming(status);
    }
  };

  return (
    <div
      style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
      className={`animate-fade-in-up relative overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-md ${
        b.status === 'requested' ? 'border-amber-200' : 'border-gray-100'
      } ${busy ? 'opacity-60 pointer-events-none' : ''}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${STATUS_BAR[b.status] || 'bg-gray-300'}`} />
      <div className="p-3 pl-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-sm font-semibold text-white">
            {initials(b.customer_name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <p className="truncate text-sm font-semibold text-gray-900">{b.customer_name || 'Customer'}</p>
              <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[b.status] || 'bg-gray-100 text-gray-500'}`}>
                {STATUS_LABELS[b.status] || b.status?.replace('_', ' ')}
              </span>
            </div>
            <p className="truncate text-xs font-medium text-blue-700">{b.products?.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <FiCalendar className="h-3 w-3" />
                {type === 'room' ? (
                  <>
                    {shortDate(b.booking_date)} → {shortDate(b.checkout_date)}
                  </>
                ) : (
                  friendlyDate(b.booking_date)
                )}
              </span>
              {type !== 'room' && type !== 'ticket' && b.slot_start && (
                <span className="flex items-center gap-1">
                  <FiClock className="h-3 w-3" />
                  {hhmm(b.slot_start)}
                  {b.slot_end ? `–${hhmm(b.slot_end)}` : ''}
                </span>
              )}
              {b.quantity > 1 && (
                <span className="flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-gray-600">
                  <FiUsers className="h-3 w-3" />×{b.quantity} {unit}s
                </span>
              )}
              {b.customer_phone && (
                <a href={phoneHref(b.customer_phone)} className="flex items-center gap-1 hover:text-blue-600 hover:underline">
                  <FiPhone className="h-3 w-3" />
                  {b.customer_phone}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Actions: one obvious primary button, the rest tucked in a tidy row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {b.status === 'requested' && (
            <button
              onClick={() => onStatus(b.id, 'confirmed')}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95"
            >
              <FiCheck className="h-3.5 w-3.5" /> Confirm
            </button>
          )}
          {b.status === 'confirmed' && (
            <button
              onClick={() => onStatus(b.id, 'completed')}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95"
            >
              <FiCheckCircle className="h-3.5 w-3.5" /> Mark completed
            </button>
          )}
          {b.status === 'requested' && (
            <button
              onClick={() => onStatus(b.id, 'completed')}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
            >
              Complete
            </button>
          )}
          {isActive && (
            <>
              <button
                onClick={() => runDestructive('no_show')}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  confirming === 'no_show' ? 'border-red-500 bg-red-500 text-white' : 'border-gray-200 text-red-600 hover:bg-red-50'
                }`}
              >
                {confirming === 'no_show' ? 'Tap again to confirm' : 'No-show'}
              </button>
              <button
                onClick={() => runDestructive('cancelled')}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  confirming === 'cancelled' ? 'border-gray-700 bg-gray-700 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {confirming === 'cancelled' ? 'Tap again to confirm' : b.status === 'requested' ? 'Decline' : 'Cancel'}
              </button>
            </>
          )}

          <div className="ml-auto flex items-center gap-1">
            {b.chat_conversation_id && (
              <div className="flex items-center gap-0.5 rounded-full border border-gray-200 bg-gray-50 p-0.5">
                <button
                  onClick={() => onThread(b.id)}
                  aria-label="Message this customer"
                  className={`rounded-full p-1.5 transition-all hover:scale-110 active:scale-90 ${
                    isOpen ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-white hover:text-blue-600'
                  }`}
                  title="Message this customer"
                >
                  <FiMessageCircle className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onCall(b.id, 'audio')}
                  aria-label="Audio call this customer"
                  className="rounded-full p-1.5 text-gray-500 transition-all hover:scale-110 hover:bg-white hover:text-emerald-600 active:scale-90"
                  title="Audio call this customer"
                >
                  <FiPhone className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onCall(b.id, 'video')}
                  aria-label="Video call this customer"
                  className="rounded-full p-1.5 text-gray-500 transition-all hover:scale-110 hover:bg-white hover:text-purple-600 active:scale-90"
                  title="Video call this customer"
                >
                  <FiVideo className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {hasDetails && (
              <button
                onClick={() => onToggleExpand(b.id)}
                aria-expanded={expanded}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100"
              >
                Details
                <FiChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {expanded && hasDetails && (
          <div className="mt-3 space-y-1 rounded-lg bg-gray-50 p-2.5 animate-fade-in-up">
            {b.notes && <p className="text-xs italic text-gray-600">"{b.notes}"</p>}
            {responses.map(([key, value]) => (
              <p key={key} className="text-xs text-gray-600">
                <span className="capitalize text-gray-400">{key.replace(/_/g, ' ')}:</span>{' '}
                {typeof value === 'string' && /^https?:\/\//.test(value) ? (
                  <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    View attachment
                  </a>
                ) : Array.isArray(value) ? (
                  value.join(', ')
                ) : (
                  String(value)
                )}
              </p>
            ))}
          </div>
        )}

        {isOpen && b.chat_conversation_id && (
          <div className="mt-3">
            <BookingChatCallPanel
              bookingId={b.id}
              conversationId={b.chat_conversation_id}
              selfId={staffIdentity?.userId}
              selfName={staffIdentity?.name}
              senderRole="admin"
              autoStart={autoStart?.bookingId === b.id ? autoStart.type : null}
              onAutoStarted={onAutoStarted}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const BookingsTab = ({ supermarketId, staffIdentity, onPendingCount }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [openBookingId, setOpenBookingId] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [filter, setFilter] = useState(null); // null until first load picks a smart default
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [toast, setToast] = useState(null);
  // { bookingId, type: 'audio' | 'video' } — set by the Call/Video quick
  // buttons so the chat panel below rings the instant it mounts, instead of
  // making staff open the thread first and then hunt for the phone icon.
  const [autoStart, setAutoStart] = useState(null);
  const firstLoad = useRef(true);

  const openThread = (id) => setOpenBookingId((prev) => (prev === id ? null : id));
  const quickCall = (id, type) => {
    setOpenBookingId(id);
    setAutoStart({ bookingId: id, type });
  };
  const toggleExpand = (id) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!supermarketId) return;
      if (!silent) setRefreshing(true);
      try {
        const data = await getStoreBookings(supermarketId);
        setBookings(data);
        setLoadError('');
        if (firstLoad.current) {
          firstLoad.current = false;
          // Land where the work is: approvals first, otherwise what's coming up.
          setFilter(data.some((b) => b.status === 'requested') ? 'pending' : 'upcoming');
        }
      } catch (err) {
        if (!silent) setLoadError(err.message || 'Could not load bookings');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supermarketId]
  );

  useEffect(() => {
    firstLoad.current = true;
    setLoading(true);
    load();
  }, [load]);

  // New requests land the instant a customer books (Supabase realtime). A slow
  // poll stays as a safety net for a dropped websocket, so the list can never
  // go stale for long.
  useEffect(() => {
    if (!supermarketId) return undefined;
    let timer;
    const refreshSoon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => load({ silent: true }), 400); // coalesce bursts
    };
    const unsubscribe = subscribeToStoreBookings(supermarketId, (payload) => {
      if (payload.eventType === 'INSERT') {
        setToast({ type: 'ok', message: `New booking request from ${payload.new?.customer_name || 'a customer'}` });
      }
      refreshSoon();
    });
    const poll = setInterval(() => {
      if (!document.hidden) load({ silent: true });
    }, 120000);
    return () => {
      unsubscribe();
      clearTimeout(timer);
      clearInterval(poll);
    };
  }, [supermarketId, load]);

  const today = todayISO();
  const pendingCount = useMemo(() => bookings.filter((b) => b.status === 'requested').length, [bookings]);
  useEffect(() => {
    onPendingCount?.(pendingCount);
  }, [pendingCount, onPendingCount]);

  const counts = useMemo(() => {
    const c = {};
    FILTERS.forEach((f) => {
      c[f.id] = bookings.filter((b) => matchesFilter(b, f.id, today)).length;
    });
    return c;
  }, [bookings, today]);

  const services = useMemo(() => {
    const map = new Map();
    bookings.forEach((b) => b.products?.name && map.set(b.product_id || b.products.name, b.products.name));
    return [...map.entries()];
  }, [bookings]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = bookings.filter((b) => {
      if (!matchesFilter(b, filter || 'all', today)) return false;
      if (serviceFilter !== 'all' && (b.product_id || b.products?.name) !== serviceFilter) return false;
      if (!q) return true;
      return [b.customer_name, b.customer_phone, b.products?.name, b.notes].some((v) => String(v || '').toLowerCase().includes(q));
    });
    // Past reads newest-first; everything else soonest-first.
    const dir = filter === 'past' ? -1 : 1;
    return list.sort((a, b) => dir * (`${a.booking_date} ${a.slot_start || ''}`.localeCompare(`${b.booking_date} ${b.slot_start || ''}`)));
  }, [bookings, filter, search, serviceFilter, today]);

  const groups = useMemo(() => {
    const map = new Map();
    visible.forEach((b) => {
      if (!map.has(b.booking_date)) map.set(b.booking_date, []);
      map.get(b.booking_date).push(b);
    });
    return [...map.entries()];
  }, [visible]);

  const handleStatus = async (id, status) => {
    const previous = bookings;
    setBusyIds((s) => new Set(s).add(id));
    // Optimistic: the card updates instantly, and rolls back if the server refuses.
    setBookings((list) => list.map((b) => (b.id === id ? { ...b, status } : b)));
    try {
      await updateBookingStatus(id, status);
      setToast({ type: 'ok', message: `Booking ${STATUS_LABELS[status].toLowerCase()}` });
      load({ silent: true });
    } catch (err) {
      setBookings(previous);
      setToast({ type: 'error', message: err.message || 'Could not update booking' });
    } finally {
      setBusyIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  };

  if (loading) return <SkeletonCards />;

  if (loadError && bookings.length === 0) {
    return (
      <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-center">
        <p className="text-sm text-rose-700">{loadError}</p>
        <button onClick={() => load()} className="mt-2 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700">
          Try again
        </button>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center">
        <FiInbox className="h-8 w-8 text-gray-300" />
        <p className="text-sm font-medium text-gray-700">No bookings yet</p>
        <p className="max-w-xs text-xs text-gray-400">
          When a customer books one of your services it lands here for you to confirm. Make sure availability is set in the
          Availability tab.
        </p>
      </div>
    );
  }

  const emptyCopy = {
    pending: ['All caught up', 'No bookings are waiting for your approval.'],
    today: ['Nothing today', 'No active bookings are scheduled for today.'],
    upcoming: ['Nothing coming up', 'No upcoming bookings right now.'],
    past: ['No past bookings', 'Completed, cancelled and past bookings show here.'],
    all: ['No bookings', ''],
  }[filter || 'all'];

  return (
    <div className="space-y-3">
      {/* Filter chips with live counts — pending is highlighted so it can't be missed */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Filter bookings">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const urgent = f.id === 'pending' && counts.pending > 0;
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.id)}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                  : urgent
                  ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
              }`}
            >
              {f.label}
              <span
                className={`rounded-full px-1.5 text-[10px] font-bold ${
                  active ? 'bg-white/25 text-white' : urgent ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {counts[f.id]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone or service"
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        {services.length > 1 && (
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
            aria-label="Filter by service"
          >
            <option value="all">All services</option>
            {services.map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => load()}
          disabled={refreshing}
          className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 transition-colors hover:text-blue-600 disabled:opacity-50"
          title="Refresh"
          aria-label="Refresh bookings"
        >
          <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center">
          <FiUser className="h-6 w-6 text-gray-300" />
          <p className="text-sm font-medium text-gray-700">{search || serviceFilter !== 'all' ? 'No matches' : emptyCopy[0]}</p>
          <p className="text-xs text-gray-400">
            {search || serviceFilter !== 'all' ? 'Try a different search or clear the filters.' : emptyCopy[1]}
          </p>
          {(search || serviceFilter !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setServiceFilter('all');
              }}
              className="mt-1 text-xs font-medium text-blue-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        groups.map(([date, items]) => (
          <section key={date} className="space-y-2">
            <h3 className="sticky top-0 z-10 -mx-1 flex items-center gap-2 bg-white/90 px-1 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500 backdrop-blur">
              <span className={date === today ? 'text-blue-600' : ''}>{friendlyDate(date)}</span>
              <span className="font-normal normal-case text-gray-400">
                {items.length} booking{items.length > 1 ? 's' : ''}
              </span>
            </h3>
            {items.map((b, i) => (
              <BookingCard
                key={b.id}
                b={b}
                index={i}
                busy={busyIds.has(b.id)}
                isOpen={openBookingId === b.id}
                expanded={expandedIds.has(b.id)}
                onToggleExpand={toggleExpand}
                onThread={openThread}
                onCall={quickCall}
                onStatus={handleStatus}
                staffIdentity={staffIdentity}
                autoStart={autoStart}
                onAutoStarted={() => setAutoStart(null)}
              />
            ))}
          </section>
        ))
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};


// Defaults to the "always open" shape: every day, 00:00-23:59 (morning to
// morning), 30-minute bookings. An admin picking "Every day" + "Open hours"
// and just hitting Add gets a service that's bookable round the clock —
// slotMinutes is how long ONE booking takes, capacity is how many can run
// at once; neither is a hard ceiling on when customers can book (see
// ADD_SERVICE_BOOKING_ALWAYS_BOOKABLE.sql — a full slot still takes
// requests, it just badges "Full" for the customer).
const emptyRuleForm = { dayOfWeek: 'all', startTime: '00:00', endTime: '23:59', slotMinutes: 30, capacity: 1 };

// 'all' is the new default-rule sentinel (day_of_week left NULL — applies
// to every weekday that doesn't have its own explicit rule). Defaulting the
// form to it nudges a first-time setup toward "set it once for every day"
// instead of the old one-weekday-at-a-time flow.
const DAY_OPTIONS = [{ value: 'all', label: 'Every day (default)' }, ...DAY_LABELS.map((label, i) => ({ value: String(i), label }))];

// A one-off override always fully replaces that date's weekly hours, so for
// a time-slot service there are three distinct things an admin might want
// for a specific date: give it different hours, block out just a range
// within an otherwise normal day, or close it entirely.
const SLOT_OVERRIDE_MODES = [
  { value: 'hours', label: 'Special hours' },
  { value: 'block', label: 'Block a time range' },
  { value: 'closed', label: 'Close entirely' },
];
// A ticket/room service has no time-of-day — one date is just "how many
// available" — so an override only ever needs to change that number or
// zero it out (sold out).
const POOL_OVERRIDE_MODES = [
  { value: 'capacity', label: 'Set availability' },
  { value: 'closed', label: 'Sold out / close entirely' },
];

// Same three-way choice as the one-off override, but for a RECURRING
// weekday rule: normal open hours, a recurring partial block (e.g. a daily
// lunch break — needs times), or fully closing that weekday every week (no
// times needed). This is how the admin "explicitly removes a day" from an
// otherwise-open-by-default service.
const WEEKLY_SLOT_MODES = [
  { value: 'open', label: 'Open hours' },
  { value: 'block', label: 'Recurring block' },
  { value: 'closed', label: 'Close this day' },
];
const WEEKLY_POOL_MODES = [
  { value: 'capacity', label: 'Set availability' },
  { value: 'closed', label: 'Close this day' },
];

// One glyph per mode, reused for both the weekly and one-off segmented
// pickers and for the badge on each row in "Current rules" below.
const MODE_ICONS = { open: FiSun, capacity: FiSun, hours: FiSun, block: FiPauseCircle, closed: FiXCircle };

// How each saved rule renders as a small colored badge in "Current rules" —
// keeps the list scannable at a glance instead of reading every sentence.
const ruleBadge = (r) => {
  if (r.day_of_week === null && !r.specific_date) {
    return { label: 'Every day', icon: FiZap, className: 'bg-indigo-100 text-indigo-700' };
  }
  if (r.is_blackout) {
    return r.start_time
      ? { label: 'Blocked range', icon: FiPauseCircle, className: 'bg-amber-100 text-amber-700' }
      : { label: 'Closed', icon: FiXCircle, className: 'bg-rose-100 text-rose-700' };
  }
  return r.specific_date
    ? { label: 'Special date', icon: FiSun, className: 'bg-purple-100 text-purple-700' }
    : { label: 'Weekly', icon: FiCheckCircle, className: 'bg-blue-100 text-blue-700' };
};

const AvailabilityTab = ({ supermarketId, focusServiceId }) => {
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(emptyRuleForm);
  const [weeklyMode, setWeeklyMode] = useState('open');
  const [overrideDate, setOverrideDate] = useState('');
  const [overrideMode, setOverrideMode] = useState('hours');
  const [saving, setSaving] = useState(false);

  // 'ticket'/'room' products are booked against a single whole-day pseudo-
  // slot instead of time-of-day slots — everywhere below just needs "how
  // many available", never a start/end time.
  const bookingType = selectedService?.booking_type || 'slot';
  const isSlotType = bookingType === 'slot';
  const poolLabel = bookingType === 'room' ? 'rooms' : bookingType === 'ticket' ? 'tickets' : 'spots/slot';

  useEffect(() => {
    if (supermarketId) getBookableServices(supermarketId).then(setServices);
  }, [supermarketId]);

  // Jumped here from the Services tab's "Configure booking" button — land
  // straight on that exact service instead of making the admin re-pick it.
  useEffect(() => {
    if (focusServiceId && services.length) {
      const svc = services.find((s) => s.id === focusServiceId);
      if (svc) setSelectedService(svc);
    }
  }, [focusServiceId, services]);

  const loadRules = (productId) => getAvailabilityRules(productId).then(setRules);

  useEffect(() => {
    if (selectedService) loadRules(selectedService.id);
    const slot = selectedService?.booking_type === 'slot' || !selectedService;
    setOverrideMode(slot ? 'hours' : 'capacity');
    setWeeklyMode(slot ? 'open' : 'capacity');
  }, [selectedService]);

  const handleAddWeeklyRule = async () => {
    if (!selectedService) return;
    setSaving(true);
    try {
      const dayOfWeek = form.dayOfWeek === 'all' ? null : parseInt(form.dayOfWeek, 10);
      if (weeklyMode === 'closed') {
        // Fully closes this weekday (or, if "Every day" is picked, closes
        // every day with no more specific rule) — no times/capacity needed.
        await saveAvailabilityRule({ supermarketId, productId: selectedService.id, dayOfWeek, isBlackout: true });
      } else if (weeklyMode === 'block') {
        // Recurring partial block (e.g. a daily lunch break) — only
        // meaningful for slot-type services, needs a time range.
        await saveAvailabilityRule({
          supermarketId,
          productId: selectedService.id,
          dayOfWeek,
          startTime: form.startTime,
          endTime: form.endTime,
          isBlackout: true,
        });
      } else {
        await saveAvailabilityRule({
          supermarketId,
          productId: selectedService.id,
          dayOfWeek,
          startTime: isSlotType ? form.startTime : ALL_DAY_AVAILABILITY.startTime,
          endTime: isSlotType ? form.endTime : ALL_DAY_AVAILABILITY.endTime,
          slotMinutes: isSlotType ? parseInt(form.slotMinutes, 10) : ALL_DAY_AVAILABILITY.slotMinutes,
          capacity: parseInt(form.capacity, 10),
          isBlackout: false,
        });
      }
      loadRules(selectedService.id);
    } catch (err) {
      alert(err.message || 'Could not save availability rule');
    } finally {
      setSaving(false);
    }
  };

  const handleAddOverride = async () => {
    if (!selectedService || !overrideDate) return;
    setSaving(true);
    try {
      if (!isSlotType) {
        // Ticket/room: just a number for this date, or sold out.
        if (overrideMode === 'closed') {
          await saveAvailabilityRule({ supermarketId, productId: selectedService.id, specificDate: overrideDate, isBlackout: true });
        } else {
          await saveAvailabilityRule({
            supermarketId,
            productId: selectedService.id,
            specificDate: overrideDate,
            startTime: ALL_DAY_AVAILABILITY.startTime,
            endTime: ALL_DAY_AVAILABILITY.endTime,
            slotMinutes: ALL_DAY_AVAILABILITY.slotMinutes,
            capacity: parseInt(form.capacity, 10),
          });
        }
      } else if (overrideMode === 'closed') {
        await saveAvailabilityRule({
          supermarketId,
          productId: selectedService.id,
          specificDate: overrideDate,
          isBlackout: true,
        });
      } else if (overrideMode === 'block') {
        // Blocking a range on a date that has no override yet would
        // otherwise wipe out the rest of that day (an override replaces the
        // weekly schedule wholesale) — so carry today's weekly open hours
        // over as an explicit row for this date first, then block on top.
        const hasOverrideAlready = rules.some((r) => r.specific_date === overrideDate);
        if (!hasOverrideAlready) {
          const dow = new Date(`${overrideDate}T00:00:00`).getDay();
          const weeklyOpenHours = rules.filter((r) => r.day_of_week === dow && !r.is_blackout);
          for (const w of weeklyOpenHours) {
            await saveAvailabilityRule({
              supermarketId,
              productId: selectedService.id,
              specificDate: overrideDate,
              startTime: w.start_time,
              endTime: w.end_time,
              slotMinutes: w.slot_minutes,
              capacity: w.capacity,
            });
          }
        }
        await saveAvailabilityRule({
          supermarketId,
          productId: selectedService.id,
          specificDate: overrideDate,
          startTime: form.startTime,
          endTime: form.endTime,
          isBlackout: true,
        });
      } else {
        await saveAvailabilityRule({
          supermarketId,
          productId: selectedService.id,
          specificDate: overrideDate,
          startTime: form.startTime,
          endTime: form.endTime,
          slotMinutes: parseInt(form.slotMinutes, 10),
          capacity: parseInt(form.capacity, 10),
        });
      }
      setOverrideDate('');
      loadRules(selectedService.id);
    } catch (err) {
      alert(err.message || 'Could not save override');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    await deleteAvailabilityRule(id);
    loadRules(selectedService.id);
  };

  if (services.length === 0) {
    return (
      <p className="text-sm text-gray-400 p-4">
        No bookable services yet — mark a "service_item" product as bookable in Inventory first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <select
        value={selectedService?.id || ''}
        onChange={(e) => setSelectedService(services.find((s) => s.id === e.target.value) || null)}
        className="w-full sm:w-auto text-sm bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2"
      >
        <option value="">Select a service…</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} · {getBookingType(s.booking_type).label}
          </option>
        ))}
      </select>

      {selectedService && (
        <>
          <div className={`flex items-center gap-3 rounded-xl bg-gradient-to-r ${getBookingType(bookingType).accent.grad} p-3 text-white animate-fade-in-up`}>
            {React.createElement(getBookingType(bookingType).Icon, { className: 'h-6 w-6 flex-shrink-0' })}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{selectedService.name}</p>
              <p className="text-xs opacity-90">
                {getBookingType(bookingType).label} · {getBookingType(bookingType).tagline}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2.5 animate-fade-in-up">
            <FiInfo className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
            <p className="text-xs text-blue-800">
              Capacity here only drives the <span className="font-semibold">"Full" badge</span> customers see — it
              never blocks a booking. A full slot still takes requests; they land as{' '}
              <span className="font-semibold">pending approval</span> for you to confirm or decline. Only a day you
              explicitly close below stops bookings.
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 p-3 transition-shadow hover:shadow-sm animate-fade-in-up">
            <p className="text-sm font-medium text-gray-700 mb-2">{isSlotType ? 'Weekly hours' : 'Weekly availability'}</p>
            <p className="text-xs text-gray-400 mb-2">
              {isSlotType ? (
                <>
                  Defaults to open <span className="font-medium text-gray-500">all day, every day</span> — morning to
                  morning, Monday to Monday — the instant you hit Add. You're not setting when the service is
                  "open", you're setting how long one booking takes and how many can run at once; come back here
                  only to close or adjust one specific weekday.
                </>
              ) : (
                <>
                  Set "Every day" once and the service stays bookable every day automatically — come back here only
                  to close or adjust one specific weekday.
                </>
              )}
            </p>
            <div className="flex gap-1.5 mb-2">
              {(isSlotType ? WEEKLY_SLOT_MODES : WEEKLY_POOL_MODES).map((m) => {
                const Icon = MODE_ICONS[m.value];
                const active = weeklyMode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setWeeklyMode(m.value)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-all duration-200 ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600 scale-105 shadow-sm shadow-blue-200'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {Icon && <Icon className={`h-3 w-3 ${active ? 'animate-pop-in' : ''}`} />}
                    {m.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={form.dayOfWeek} onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: e.target.value }))} className="text-sm bg-white text-gray-900 border border-gray-300 rounded-lg px-2 py-1.5">
                {DAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              {isSlotType && weeklyMode !== 'closed' && (
                <>
                  <input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} className="text-sm bg-white text-gray-900 border border-gray-300 rounded-lg px-2 py-1.5" />
                  <span className="text-xs text-gray-400">to</span>
                  <input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} className="text-sm bg-white text-gray-900 border border-gray-300 rounded-lg px-2 py-1.5" />
                </>
              )}
              {isSlotType && weeklyMode === 'open' && (
                <>
                  <input type="number" min="5" value={form.slotMinutes} onChange={(e) => setForm((f) => ({ ...f, slotMinutes: e.target.value }))} className="w-20 text-sm bg-white text-gray-900 border border-gray-300 rounded-lg px-2 py-1.5" title="How long one booking takes, in minutes" />
                  <span className="text-xs text-gray-400">min / booking</span>
                </>
              )}
              {((isSlotType && weeklyMode === 'open') || (!isSlotType && weeklyMode === 'capacity')) && (
                <>
                  <input type="number" min="1" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} className="w-16 text-sm bg-white text-gray-900 border border-gray-300 rounded-lg px-2 py-1.5" title={`How many ${poolLabel} can run at once — a soft target, not a hard limit`} />
                  <span className="text-xs text-gray-400">{poolLabel}</span>
                </>
              )}
              <button
                onClick={handleAddWeeklyRule}
                disabled={saving}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-50 transition-transform active:scale-95 hover:bg-blue-700"
              >
                {saving ? '…' : weeklyMode === 'closed' ? 'Close this day' : weeklyMode === 'block' ? 'Add block' : 'Add'}
              </button>
            </div>
            {isSlotType && weeklyMode === 'open' && (
              <p className="mt-2 text-[11px] text-gray-400">
                Once that many bookings land in the same {form.slotMinutes || 30}-minute window, customers just see a
                "Full" badge — they can still book, and it queues up for your approval.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-gray-100 p-3 transition-shadow hover:shadow-sm animate-fade-in-up" style={{ animationDelay: '60ms' }}>
            <p className="text-sm font-medium text-gray-700 mb-2">One-off date override</p>
            <div className="flex gap-1.5 mb-2">
              {(isSlotType ? SLOT_OVERRIDE_MODES : POOL_OVERRIDE_MODES).map((m) => {
                const Icon = MODE_ICONS[m.value];
                const active = overrideMode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setOverrideMode(m.value)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-all duration-200 ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600 scale-105 shadow-sm shadow-blue-200'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {Icon && <Icon className={`h-3 w-3 ${active ? 'animate-pop-in' : ''}`} />}
                    {m.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={overrideDate} onChange={(e) => setOverrideDate(e.target.value)} className="text-sm bg-white text-gray-900 border border-gray-300 rounded-lg px-2 py-1.5" />
              {isSlotType && overrideMode !== 'closed' && (
                <>
                  <input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} className="text-sm bg-white text-gray-900 border border-gray-300 rounded-lg px-2 py-1.5" />
                  <span className="text-xs text-gray-400">to</span>
                  <input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} className="text-sm bg-white text-gray-900 border border-gray-300 rounded-lg px-2 py-1.5" />
                </>
              )}
              {isSlotType && overrideMode === 'hours' && (
                <>
                  <input type="number" min="5" value={form.slotMinutes} onChange={(e) => setForm((f) => ({ ...f, slotMinutes: e.target.value }))} className="w-20 text-sm bg-white text-gray-900 border border-gray-300 rounded-lg px-2 py-1.5" title="Slot length (minutes)" />
                  <span className="text-xs text-gray-400">min slots</span>
                  <input type="number" min="1" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} className="w-16 text-sm bg-white text-gray-900 border border-gray-300 rounded-lg px-2 py-1.5" title="How many bookings allowed per slot" />
                  <span className="text-xs text-gray-400">spots/slot</span>
                </>
              )}
              {!isSlotType && overrideMode === 'capacity' && (
                <>
                  <input type="number" min="1" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} className="w-20 text-sm bg-white text-gray-900 border border-gray-300 rounded-lg px-2 py-1.5" title={`How many ${poolLabel} available`} />
                  <span className="text-xs text-gray-400">{poolLabel}</span>
                </>
              )}
              <button
                onClick={handleAddOverride}
                disabled={saving || !overrideDate}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-50 transition-transform active:scale-95 hover:bg-blue-700"
              >
                {saving ? '…' : overrideMode === 'closed' ? 'Close this day' : overrideMode === 'block' ? 'Block this range' : 'Add override'}
              </button>
            </div>
            {overrideMode === 'block' && (
              <p className="text-xs text-gray-400 mt-2">The rest of the day keeps its normal weekly hours automatically.</p>
            )}
          </div>

          <div className="animate-fade-in-up" style={{ animationDelay: '120ms' }}>
            <p className="text-sm font-medium text-gray-700 mb-2">Current rules</p>
            <div className="space-y-1">
              {rules.length === 0 && (
                <p className="text-xs text-gray-400">
                  No availability set yet — this service can't be booked. Add an "Every day" rule above to open it
                  every day at once.
                </p>
              )}
              {rules.map((r, i) => {
                const badge = ruleBadge(r);
                const BadgeIcon = badge.icon;
                return (
                  <div
                    key={r.id}
                    style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
                    className="flex items-center justify-between gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2 animate-fade-in-up transition-colors hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                        <BadgeIcon className="h-2.5 w-2.5" />
                        {badge.label}
                      </span>
                      <span className="truncate text-gray-700">
                        {r.specific_date ? r.specific_date : r.day_of_week === null ? 'Every day' : DAY_LABELS[r.day_of_week]}
                        {' — '}
                        {isSlotType
                          ? (r.is_blackout
                              ? (r.start_time ? `blocked ${r.start_time.slice(0, 5)}–${r.end_time.slice(0, 5)}` : 'closed all day')
                              : `${r.start_time?.slice(0, 5)}–${r.end_time?.slice(0, 5)} (${r.slot_minutes}m, ${r.capacity}/slot)`)
                          : (r.is_blackout ? 'sold out / closed' : `${r.capacity} ${poolLabel} available`)}
                      </span>
                    </div>
                    <button onClick={() => handleDelete(r.id)} className="flex-shrink-0 text-red-400 transition-transform hover:text-red-600 hover:scale-110 active:scale-90">
                      <FiTrash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// AdminPortal's Bookings tab: upcoming bookings + per-service availability
// configuration. supermarketId comes from currentAdmin.supermarket_id;
// staffIdentity ({ userId, name }) is who the staff member appears as in a
// booking's chat/call panel. focusServiceId (optional) is set by the
// Services tab's "Configure booking" button — landing here goes straight to
// the Availability tab with that service already selected, instead of
// dropping the admin on "Upcoming bookings" with nothing pre-picked.
const PANEL_TABS = [
  { id: 'bookings', label: 'Bookings' },
  { id: 'availability', label: 'Availability' },
  { id: 'form', label: 'Booking form' },
];

const BookingsPanel = ({ supermarketId, staffIdentity, focusServiceId }) => {
  const [tab, setTab] = useState(focusServiceId ? 'availability' : 'bookings');
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (focusServiceId) setTab('availability');
  }, [focusServiceId]);

  return (
    <div className="container-glass rounded-2xl p-4 sm:p-6 shadow-lg">
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <FiCalendar /> Bookings
        {pending > 0 && (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">{pending} to approve</span>
        )}
      </h2>
      <div className="flex gap-1 mb-4 border-b border-gray-100 overflow-x-auto" role="tablist">
        {PANEL_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 px-3 py-2 text-sm font-medium border-b-2 transition-all duration-200 ${
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.id === 'bookings' && pending > 0 && tab !== 'bookings' && (
              <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" />
            )}
          </button>
        ))}
      </div>
      <div key={tab} className="animate-fade-in-up">
        {tab === 'bookings' && <BookingsTab supermarketId={supermarketId} staffIdentity={staffIdentity} onPendingCount={setPending} />}
        {tab === 'availability' && <AvailabilityTab supermarketId={supermarketId} focusServiceId={focusServiceId} />}
        {tab === 'form' && <BookingFormEditor supermarketId={supermarketId} focusServiceId={focusServiceId} />}
      </div>
    </div>
  );
};

export default BookingsPanel;
