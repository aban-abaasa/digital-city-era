import React, { useEffect, useMemo, useState } from 'react';
import { FiSearch, FiMapPin, FiCalendar, FiX, FiClock, FiMessageCircle, FiChevronDown, FiInbox, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import {
  searchBookableServices,
  getMyBookings,
  updateBookingStatus,
} from '../../services/bookingService';
import BookServiceModal from './BookServiceModal';
import BookingChatCallPanel from './BookingChatCallPanel';
import { BOOKING_TYPES, BookingTypeBadge } from './BookingTypePicker';

const STATUS_STYLES = {
  requested: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
  no_show: 'bg-red-100 text-red-600',
};

// Admin sets is_bookable per product and offers_services per business, so
// any kind of business can show up here — label/emoji known types nicely,
// fall back to a readable label (and generic emoji) for anything else.
const BUSINESS_TYPE_META = {
  supermarket: { label: 'Supermarkets', emoji: '🏪' },
  pharmacy: { label: 'Pharmacies', emoji: '💊' },
  hotel: { label: 'Hotels', emoji: '🏨' },
  boutique: { label: 'Boutiques', emoji: '👗' },
  restaurant_cafe: { label: 'Restaurants', emoji: '🍽️' },
  salon: { label: 'Salons', emoji: '💇' },
  clinic: { label: 'Clinics', emoji: '🩺' },
  gym: { label: 'Gyms', emoji: '🏋️' },
};
const businessTypeMeta = (type) =>
  BUSINESS_TYPE_META[type] || {
    label: type ? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Other',
    emoji: '🏬',
  };

const STATUS_LABELS = {
  requested: 'Waiting for approval',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'Missed',
};
const ACTIVE = ['requested', 'confirmed'];
const pad = (n) => String(n).padStart(2, '0');
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const friendlyDate = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  const diff = Math.round((d - new Date(`${todayISO()}T00:00:00`)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};
const hhmm = (t) => (t ? String(t).slice(0, 5) : '');

const norm = (s) => (s || '').toString().toLowerCase();

// Customer "Book" tab: search/filter every bookable service across every
// business that offers them (not just one store at a time), then
// BookServiceModal, plus a list of this customer's own bookings.
const BrowseServicesAndBook = ({ identity }) => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [businessType, setBusinessType] = useState('all');
  const [businessId, setBusinessId] = useState(null);
  const [bookingKind, setBookingKind] = useState('all');
  const [bookingService, setBookingService] = useState(null);
  const [myBookings, setMyBookings] = useState([]);
  const [bookingsTab, setBookingsTab] = useState('upcoming');
  const [openChatId, setOpenChatId] = useState(null);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [notice, setNotice] = useState(null);

  const loadMyBookings = () => getMyBookings().then(setMyBookings).catch(() => {});

  useEffect(() => {
    // Surface a real error instead of quietly showing "no businesses" — a
    // fetch failure here (e.g. an RLS/permissions issue) looks identical to
    // an empty result unless it's told apart explicitly.
    searchBookableServices()
      .then(setServices)
      .catch((err) => setLoadError(err.message || 'Could not load services'))
      .finally(() => setLoading(false));
    loadMyBookings();
  }, []);

  const businessTypes = useMemo(
    () => Array.from(new Set(services.map((s) => s.business?.business_type).filter(Boolean))),
    [services]
  );

  const businesses = useMemo(() => {
    const seen = new Map();
    services.forEach((s) => {
      if (s.business?.id && !seen.has(s.business.id)) seen.set(s.business.id, s.business);
    });
    return Array.from(seen.values());
  }, [services]);

  // Marks *why* a result matched free-text search, purely so the card can
  // show a small "business" badge — the underlying filter already treats a
  // business-name/type/location hit the same as a service-name hit, it's
  // just not visible at a glance which one fired.
  const matchReason = (svc, q) => {
    if (!q) return null;
    const biz = svc.business || {};
    if (norm(svc.name).includes(q) || norm(svc.description).includes(q)) return 'service';
    if (
      norm(biz.name).includes(q) ||
      norm(biz.city).includes(q) ||
      norm(biz.address).includes(q) ||
      norm(businessTypeMeta(biz.business_type).label).includes(q)
    ) {
      return 'business';
    }
    return null;
  };

  const filtered = useMemo(() => {
    const q = norm(search);
    return services
      .filter((svc) => {
        const biz = svc.business || {};
        if (businessType !== 'all' && biz.business_type !== businessType) return false;
        if (businessId && biz.id !== businessId) return false;
        if (bookingKind !== 'all' && (svc.booking_type || 'slot') !== bookingKind) return false;
        if (!q) return true;
        return Boolean(matchReason(svc, q));
      })
      .map((svc) => ({ ...svc, __matchedBy: matchReason(svc, q) }));
  }, [services, search, businessType, businessId, bookingKind]);

  const handleCancel = async (bookingId) => {
    // First tap arms the button, second tap cancels (auto-disarms after 5s).
    if (confirmCancelId !== bookingId) {
      setConfirmCancelId(bookingId);
      setTimeout(() => setConfirmCancelId((cur) => (cur === bookingId ? null : cur)), 5000);
      return;
    }
    setConfirmCancelId(null);
    setCancellingId(bookingId);
    try {
      await updateBookingStatus(bookingId, 'cancelled');
      setNotice({ type: 'ok', message: 'Booking cancelled' });
      await loadMyBookings();
    } catch (err) {
      setNotice({ type: 'error', message: err.message || 'Could not cancel that booking' });
    } finally {
      setCancellingId(null);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  const today = todayISO();
  const { upcomingBookings, pastBookings } = useMemo(() => {
    const isUpcoming = (b) => ACTIVE.includes(b.status) && (b.checkout_date || b.booking_date) >= today;
    const up = myBookings
      .filter(isUpcoming)
      .sort((a, b) => `${a.booking_date} ${a.slot_start || ''}`.localeCompare(`${b.booking_date} ${b.slot_start || ''}`));
    const past = myBookings.filter((b) => !isUpcoming(b));
    return { upcomingBookings: up, pastBookings: past };
  }, [myBookings, today]);
  const shownBookings = bookingsTab === 'upcoming' ? upcomingBookings : pastBookings;

  if (loading) {
    return (
      <div className="p-4 space-y-3" aria-busy="true">
        <div className="h-10 animate-pulse rounded-xl bg-gray-100" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 rounded-xl border border-gray-100 p-3">
              <div className="h-12 w-12 animate-pulse rounded-full bg-gray-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const selectedBusiness = businessId ? businesses.find((b) => b.id === businessId) : null;

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="font-semibold text-gray-800 mb-3">Book a service</h3>

        <div className="relative mb-3">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services or businesses (e.g. haircut, consultation, Acme Salon)…"
            className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <FiX className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="How do you want to book?">
          {BOOKING_TYPES.map((t) => {
            const count = services.filter((s) => (s.booking_type || 'slot') === t.id).length;
            const active = bookingKind === t.id;
            if (count === 0) return null;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setBookingKind(active ? 'all' : t.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center transition-all ${
                  active ? `bg-gradient-to-br ${t.accent.grad} border-transparent text-white shadow-md` : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <t.Icon className="h-5 w-5" />
                <span className="text-xs font-bold leading-none">{t.label}</span>
                <span className={`text-[10px] leading-none ${active ? 'text-white/80' : 'text-gray-400'}`}>{t.short} · {count}</span>
              </button>
            );
          })}
        </div>

        {businessTypes.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-2 -mx-1 px-1">
            <button
              type="button"
              onClick={() => setBusinessType('all')}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                businessType === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              🏬 All
            </button>
            {businessTypes.map((t) => {
              const meta = businessTypeMeta(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBusinessType(businessType === t ? 'all' : t)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                    businessType === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {meta.emoji} {meta.label}
                </button>
              );
            })}
          </div>
        )}

        {selectedBusiness && (
          <div className="flex items-center gap-2 mb-3 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-1.5 w-fit">
            <span>Showing only {selectedBusiness.name}</span>
            <button type="button" onClick={() => setBusinessId(null)} className="hover:text-blue-900">
              <FiX className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {loadError ? (
          <p className="text-sm text-red-500">Couldn't load services: {loadError}</p>
        ) : services.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center">
            <FiInbox className="h-7 w-7 text-gray-300" />
            <p className="text-sm text-gray-500">No businesses are taking bookings right now. Check back soon.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center">
            <FiSearch className="h-7 w-7 text-gray-300" />
            <p className="text-sm text-gray-600">{search ? `No services match "${search}"` : 'No services in this category'}</p>
            <button type="button" onClick={() => { setSearch(''); setBusinessType('all'); setBusinessId(null); setBookingKind('all'); }} className="text-xs font-medium text-blue-600 hover:underline">
              Clear search and filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((svc) => {
              const biz = svc.business || {};
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => setBookingService(svc)}
                  className="group flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                >
                  {biz.logo_url ? (
                    <img src={biz.logo_url} alt={biz.name} className="h-10 w-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                      <FiCalendar />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate flex items-center gap-1">
                      {svc.name}
                    </p>
                    <BookingTypeBadge type={svc.booking_type || 'slot'} className="mb-0.5" />
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBusinessId(biz.id);
                        }}
                        className="text-xs text-gray-500 hover:text-blue-600 hover:underline truncate"
                      >
                        {biz.name}
                      </button>
                      {svc.__matchedBy === 'business' && (
                        <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-600" title={`Matched "${search}" by business, not service name`}>
                          matched business
                        </span>
                      )}
                    </div>
                    {biz.city && (
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <FiMapPin className="h-3 w-3 shrink-0" /> {biz.city}
                      </p>
                    )}
                    {svc.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{svc.description}</p>}
                    {(svc.selling_price || svc.price) && (
                      <p className="text-sm font-semibold text-blue-600 mt-1">UGX {Number(svc.selling_price || svc.price).toLocaleString()}</p>
                    )}
                  </div>
                  <span className="mt-1 shrink-0 self-center rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white opacity-90 transition group-hover:opacity-100">
                    Book
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-800">My bookings</h3>
          <div className="flex rounded-full bg-gray-100 p-0.5 text-xs font-semibold" role="tablist">
            {[['upcoming', 'Upcoming', upcomingBookings.length], ['past', 'History', pastBookings.length]].map(([id, label, n]) => (
              <button
                key={id}
                role="tab"
                aria-selected={bookingsTab === id}
                type="button"
                onClick={() => setBookingsTab(id)}
                className={`rounded-full px-3 py-1 transition-colors ${bookingsTab === id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
              >
                {label} {n > 0 && <span className="ml-0.5 text-[10px] opacity-70">{n}</span>}
              </button>
            ))}
          </div>
        </div>

        {notice && (
          <div role="status" className={`mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${notice.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {notice.type === 'error' ? <FiAlertCircle className="h-4 w-4" /> : <FiCheckCircle className="h-4 w-4" />}
            {notice.message}
          </div>
        )}

        {shownBookings.length === 0 && (
          <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center">
            <FiCalendar className="h-6 w-6 text-gray-300" />
            <p className="text-sm text-gray-500">
              {bookingsTab === 'upcoming' ? 'No upcoming bookings. Pick a service above to book one.' : 'Nothing in your history yet.'}
            </p>
          </div>
        )}
        <div className="space-y-2">
          {shownBookings.map((b) => {
            const type = b.products?.booking_type;
            const active = ACTIVE.includes(b.status);
            const armed = confirmCancelId === b.id;
            return (
              <div key={b.id} className={`rounded-xl border bg-white p-3 transition-shadow hover:shadow-sm ${b.status === 'requested' ? 'border-amber-200' : 'border-gray-100'} ${cancellingId === b.id ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-800">
                      {b.products?.name}
                      {b.quantity > 1 && <span className="ml-1 font-normal text-gray-500">×{b.quantity}</span>}
                    </p>
                    <p className="truncate text-xs text-gray-500">{b.supermarkets?.name}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <FiCalendar className="h-3 w-3" />
                        {type === 'room' ? `${friendlyDate(b.booking_date)} → ${friendlyDate(b.checkout_date)}` : friendlyDate(b.booking_date)}
                      </span>
                      {type !== 'room' && type !== 'ticket' && b.slot_start && (
                        <span className="flex items-center gap-1"><FiClock className="h-3 w-3" />{hhmm(b.slot_start)}</span>
                      )}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[b.status] || 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LABELS[b.status] || b.status.replace('_', ' ')}
                  </span>
                </div>
                {b.status === 'requested' && (
                  <p className="mt-2 text-[11px] text-amber-700">The store will confirm shortly. The status updates here.</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  {b.chat_conversation_id && (
                    <button
                      type="button"
                      onClick={() => setOpenChatId(openChatId === b.id ? null : b.id)}
                      className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-blue-300 hover:text-blue-600"
                    >
                      <FiMessageCircle className="h-3.5 w-3.5" /> Message / call
                      <FiChevronDown className={`h-3 w-3 transition-transform ${openChatId === b.id ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                  {active && (
                    <button
                      type="button"
                      onClick={() => handleCancel(b.id)}
                      disabled={cancellingId === b.id}
                      className={`ml-auto rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${armed ? 'bg-red-500 text-white' : 'text-red-500 hover:bg-red-50'}`}
                    >
                      {armed ? 'Tap again to cancel' : 'Cancel booking'}
                    </button>
                  )}
                </div>
                {openChatId === b.id && b.chat_conversation_id && (
                  <div className="mt-3">
                    <BookingChatCallPanel bookingId={b.id} conversationId={b.chat_conversation_id} selfId={identity?.userId} selfName={identity?.name} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {bookingService && (
        <BookServiceModal
          service={bookingService}
          businessName={bookingService.business?.name}
          identity={identity}
          onClose={() => {
            setBookingService(null);
            loadMyBookings();
          }}
        />
      )}
    </div>
  );
};

export default BrowseServicesAndBook;
