import React, { useEffect, useMemo, useState } from 'react';
import { FiSearch, FiMapPin, FiCalendar, FiX } from 'react-icons/fi';
import {
  searchBookableServices,
  getMyBookings,
  updateBookingStatus,
} from '../../services/bookingService';
import BookServiceModal from './BookServiceModal';

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
  const [bookingService, setBookingService] = useState(null);
  const [myBookings, setMyBookings] = useState([]);

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
        if (!q) return true;
        return Boolean(matchReason(svc, q));
      })
      .map((svc) => ({ ...svc, __matchedBy: matchReason(svc, q) }));
  }, [services, search, businessType, businessId]);

  const handleCancel = async (bookingId) => {
    try {
      await updateBookingStatus(bookingId, 'cancelled');
      loadMyBookings();
    } catch {
      // Best-effort — leave the row as-is if the cancel is rejected server-side.
    }
  };

  if (loading) return <p className="p-6 text-sm text-gray-400">Loading…</p>;

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
            className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
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
          <p className="text-sm text-gray-400">No businesses are taking bookings right now.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400">No services match "{search}". Try a different search or filter.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((svc) => {
              const biz = svc.business || {};
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => setBookingService(svc)}
                  className="flex items-start gap-3 rounded-xl border border-gray-100 p-3 text-left hover:border-blue-300 transition"
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
                      {svc.booking_type === 'room' && <span title="Book a date range">🛏️</span>}
                      {svc.booking_type === 'ticket' && <span title="Book a quantity">🎫</span>}
                    </p>
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
                      <p className="text-sm font-semibold text-blue-600 mt-1">UGX {svc.selling_price || svc.price}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-gray-800 mb-3">My bookings</h3>
        {myBookings.length === 0 && <p className="text-sm text-gray-400">No bookings yet.</p>}
        <div className="space-y-2">
          {myBookings.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-xl border border-gray-100 p-3">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {b.products?.name}
                  {b.quantity > 1 && ` ×${b.quantity}`}
                </p>
                <p className="text-xs text-gray-400">
                  {b.supermarkets?.name} ·{' '}
                  {b.products?.booking_type === 'room' ? (
                    <>{b.booking_date} → {b.checkout_date}</>
                  ) : b.products?.booking_type === 'ticket' ? (
                    <>{b.booking_date}</>
                  ) : (
                    <>{b.booking_date} at {b.slot_start}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${STATUS_STYLES[b.status] || 'bg-gray-100 text-gray-500'}`}>
                  {b.status.replace('_', ' ')}
                </span>
                {['requested', 'confirmed'].includes(b.status) && (
                  <button type="button" onClick={() => handleCancel(b.id)} className="text-xs text-red-500 hover:underline">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
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
