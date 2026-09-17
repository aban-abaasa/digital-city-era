import React, { useEffect, useState } from 'react';
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
} from 'react-icons/fi';
import {
  getStoreBookings,
  updateBookingStatus,
  getBookableServices,
  getAvailabilityRules,
  saveAvailabilityRule,
  deleteAvailabilityRule,
  ALL_DAY_AVAILABILITY,
} from '../../services/bookingService';
import BookingChatCallPanel from './BookingChatCallPanel';
import BookingFormEditor from './BookingFormEditor';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_STYLES = {
  requested: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
  no_show: 'bg-red-100 text-red-600',
};

const BookingsTab = ({ supermarketId, staffIdentity }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openBookingId, setOpenBookingId] = useState(null);
  // { bookingId, type: 'audio' | 'video' } — set by the Call/Video quick
  // buttons so the chat panel below rings the instant it mounts, instead of
  // making staff open the thread first and then hunt for the phone icon.
  const [autoStart, setAutoStart] = useState(null);

  const openThread = (id) => setOpenBookingId((prev) => (prev === id ? null : id));
  const quickCall = (id, type) => {
    setOpenBookingId(id);
    setAutoStart({ bookingId: id, type });
  };

  const load = () => getStoreBookings(supermarketId).then(setBookings).finally(() => setLoading(false));

  useEffect(() => {
    if (supermarketId) load();
  }, [supermarketId]);

  const handleStatus = async (id, status) => {
    try {
      await updateBookingStatus(id, status);
      load();
    } catch (err) {
      alert(err.message || 'Could not update booking');
    }
  };

  if (loading) return <p className="text-sm text-gray-400 p-4">Loading bookings…</p>;
  if (bookings.length === 0) return <p className="text-sm text-gray-400 p-4">No bookings yet.</p>;

  return (
    <div className="space-y-2">
      {bookings.map((b, i) => (
        <div
          key={b.id}
          style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
          className="animate-fade-in-up rounded-xl border border-gray-100 p-3 transition-shadow hover:shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-gray-800">{b.products?.name}</p>
              <p className="text-xs text-gray-500">
                {b.customer_name} {b.customer_phone ? `· ${b.customer_phone}` : ''}
              </p>
              <p className="text-xs text-gray-400 flex items-center gap-1 flex-wrap">
                <FiCalendar className="h-3 w-3" />
                {b.products?.booking_type === 'room' ? (
                  <>{b.booking_date} → {b.checkout_date}</>
                ) : (
                  <>
                    {b.booking_date}
                    {b.products?.booking_type === 'ticket' ? null : (
                      <>
                        <FiClock className="h-3 w-3 ml-1" /> {b.slot_start}
                      </>
                    )}
                  </>
                )}
                {b.quantity > 1 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    ×{b.quantity} {b.products?.booking_type === 'room' ? 'rooms' : 'tickets'}
                  </span>
                )}
              </p>
              {b.notes && <p className="text-xs text-gray-400 italic">"{b.notes}"</p>}
              {b.form_responses && Object.keys(b.form_responses).length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {Object.entries(b.form_responses).map(([key, value]) => (
                    <p key={key} className="text-xs text-gray-500">
                      <span className="text-gray-400">{key.replace(/_/g, ' ')}:</span>{' '}
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
            </div>
            <div className="flex items-center gap-2">
              <span className={`animate-pop-in text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLES[b.status] || 'bg-gray-100 text-gray-500'}`}>
                {b.status.replace('_', ' ')}
              </span>
              {b.chat_conversation_id && (
                <div className="flex items-center gap-0.5 rounded-full border border-gray-200 bg-gray-50 p-0.5">
                  <button
                    onClick={() => openThread(b.id)}
                    className={`rounded-full p-1.5 transition-all hover:scale-110 active:scale-90 ${
                      openBookingId === b.id ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-white hover:text-blue-600'
                    }`}
                    title="Message this customer"
                  >
                    <FiMessageCircle className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => quickCall(b.id, 'audio')}
                    className="rounded-full p-1.5 text-gray-500 transition-all hover:scale-110 hover:bg-white hover:text-emerald-600 active:scale-90"
                    title="Audio call this customer"
                  >
                    <FiPhone className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => quickCall(b.id, 'video')}
                    className="rounded-full p-1.5 text-gray-500 transition-all hover:scale-110 hover:bg-white hover:text-purple-600 active:scale-90"
                    title="Video call this customer"
                  >
                    <FiVideo className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {b.status === 'requested' && (
                <button onClick={() => handleStatus(b.id, 'confirmed')} className="text-xs text-blue-600 hover:underline">
                  Confirm
                </button>
              )}
              {['requested', 'confirmed'].includes(b.status) && (
                <>
                  <button onClick={() => handleStatus(b.id, 'completed')} className="text-xs text-emerald-600 hover:underline">
                    Complete
                  </button>
                  <button onClick={() => handleStatus(b.id, 'no_show')} className="text-xs text-red-500 hover:underline">
                    No-show
                  </button>
                  <button onClick={() => handleStatus(b.id, 'cancelled')} className="text-xs text-gray-500 hover:underline">
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
          {openBookingId === b.id && b.chat_conversation_id && (
            <div className="mt-3">
              <BookingChatCallPanel
                bookingId={b.id}
                conversationId={b.chat_conversation_id}
                selfId={staffIdentity?.userId}
                selfName={staffIdentity?.name}
                senderRole="admin"
                autoStart={autoStart?.bookingId === b.id ? autoStart.type : null}
                onAutoStarted={() => setAutoStart(null)}
              />
            </div>
          )}
        </div>
      ))}
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
            {s.name} {s.booking_type === 'room' ? '(rooms)' : s.booking_type === 'ticket' ? '(tickets)' : ''}
          </option>
        ))}
      </select>

      {selectedService && (
        <>
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
const BookingsPanel = ({ supermarketId, staffIdentity, focusServiceId }) => {
  const [tab, setTab] = useState(focusServiceId ? 'availability' : 'bookings');

  useEffect(() => {
    if (focusServiceId) setTab('availability');
  }, [focusServiceId]);

  return (
    <div className="container-glass rounded-2xl p-4 sm:p-6 shadow-lg">
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <FiCalendar /> Bookings
      </h2>
      <div className="flex gap-2 mb-4 border-b border-gray-100">
        {['bookings', 'availability', 'form'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-all duration-200 ${
              tab === t ? 'border-blue-600 text-blue-600 -translate-y-0.5' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'bookings' ? 'Upcoming bookings' : t === 'availability' ? 'Availability' : 'Booking form'}
          </button>
        ))}
      </div>
      <div key={tab} className="animate-fade-in-up">
        {tab === 'bookings' && <BookingsTab supermarketId={supermarketId} staffIdentity={staffIdentity} />}
        {tab === 'availability' && <AvailabilityTab supermarketId={supermarketId} focusServiceId={focusServiceId} />}
        {tab === 'form' && <BookingFormEditor supermarketId={supermarketId} focusServiceId={focusServiceId} />}
      </div>
    </div>
  );
};

export default BookingsPanel;
