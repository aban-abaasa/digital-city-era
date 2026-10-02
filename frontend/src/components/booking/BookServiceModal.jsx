import React, { useEffect, useRef, useState } from 'react';
import { FiX, FiClock, FiCalendar, FiCheckCircle } from 'react-icons/fi';
import SlotPicker from './SlotPicker';
import TicketPicker from './TicketPicker';
import RoomPicker from './RoomPicker';
import BookingChatCallPanel from './BookingChatCallPanel';
import DynamicBookingFields, { findMissingRequiredField } from './DynamicBookingFields';
import { createBooking, getBookingFormFieldsForService, newIdempotencyKey } from '../../services/bookingService';

const fmtDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : '';

// What the customer is about to book, in one line, shown right above the button.
const summarize = (bookingType, selected) => {
  if (!selected) return '';
  if (bookingType === 'room') return `${fmtDate(selected.checkin)} → ${fmtDate(selected.checkout)} · ${selected.quantity} room${selected.quantity > 1 ? 's' : ''}`;
  if (bookingType === 'ticket') return `${fmtDate(selected.date)} · ${selected.quantity} ticket${selected.quantity > 1 ? 's' : ''}`;
  return `${fmtDate(selected.date)} at ${String(selected.slotStart).slice(0, 5)}`;
};

// Google Calendar "add event" link for the confirmed request — no API needed.
const calendarLink = (title, booking, bookingType) => {
  const ymd = (iso) => String(iso).replace(/-/g, '');
  let dates;
  if (bookingType === 'room') {
    dates = `${ymd(booking.booking_date)}/${ymd(booking.checkout_date)}`;
  } else if (bookingType === 'ticket' || !booking.slot_start) {
    const next = new Date(`${booking.booking_date}T00:00:00`);
    next.setDate(next.getDate() + 1);
    const nd = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}${String(next.getDate()).padStart(2, '0')}`;
    dates = `${ymd(booking.booking_date)}/${nd}`;
  } else {
    const start = new Date(`${booking.booking_date}T${String(booking.slot_start).slice(0, 5)}:00`);
    const end = new Date(start.getTime() + 30 * 60000);
    const f = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`;
    dates = `${f(start)}/${f(end)}`;
  }
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dates}`;
};

const CONFIRM_LABEL = (bookingType, selected) => {
  if (!selected) return bookingType === 'room' ? 'Pick your dates' : bookingType === 'ticket' ? 'Pick a date' : 'Pick a time';
  if (bookingType === 'room') return `Book ${selected.quantity} room${selected.quantity > 1 ? 's' : ''}`;
  if (bookingType === 'ticket') return `Book ${selected.quantity} ticket${selected.quantity > 1 ? 's' : ''}`;
  return `Book ${selected.slotStart}`;
};

// Customer flow: pick a slot/date/date-range -> confirm contact details ->
// book -> land in a real chat thread (+ call buttons) with the store.
// `service` is a row from bookingService.getBookableServices()/
// searchBookableServices(), carrying `booking_type` ('slot' | 'ticket' |
// 'room') which decides which picker below is shown; `identity` is
// { userId, name, email, phone } for the signed-in customer.
const BookServiceModal = ({ service, businessName, identity, onClose }) => {
  const bookingType = service.booking_type || 'slot';
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState(identity?.name || '');
  const [phone, setPhone] = useState(identity?.phone || '');
  const [notes, setNotes] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  // One key per modal open: tapping Book twice (or a network retry) returns
  // the same booking instead of creating a second.
  const idempotencyKey = useRef(newIdempotencyKey());
  const [formFields, setFormFields] = useState([]);
  const [formValues, setFormValues] = useState({});

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    getBookingFormFieldsForService(service.id).then(setFormFields).catch(() => setFormFields([]));
  }, [service.id]);

  const handleConfirm = async () => {
    if (!selected || !name.trim()) {
      setError(`Pick ${bookingType === 'room' ? 'your dates' : 'a date'} and enter your name.`);
      return;
    }
    const missing = findMissingRequiredField(formFields, formValues);
    if (missing) {
      setError(`"${missing.label}" is required.`);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const data = await createBooking({
        productId: service.id,
        bookingDate: bookingType === 'room' ? selected.checkin : selected.date,
        slotStart: bookingType === 'slot' ? selected.slotStart : undefined,
        checkoutDate: bookingType === 'room' ? selected.checkout : undefined,
        quantity: bookingType === 'slot' ? 1 : selected.quantity,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail: identity?.email,
        notes: notes.trim(),
        formResponses: formValues,
        idempotencyKey: idempotencyKey.current,
      });
      setResult(data);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message || 'Could not complete that booking — availability may have just changed.');
      // These mean what was on screen is stale: reload the slots/dates and
      // drop the now-invalid pick so they choose again.
      if (['slot_unavailable', 'slot_passed', 'closed_day', 'date_in_past'].includes(err.code)) setSelected(null);
      setRefreshKey((k) => k + 1);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`Book ${service.name}`}
    >
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[92vh] overflow-y-auto animate-fade-in-up">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          <div>
            <h3 className="font-semibold text-gray-800">{service.name}</h3>
            {businessName && <p className="text-xs text-gray-400">{businessName}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {result?.success ? (
            <>
              <div className="animate-pop-in rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-sm text-emerald-800">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <FiCheckCircle className="h-4 w-4 text-emerald-600" />
                  <span className="font-semibold">Request sent</span>
                  <span className="flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                    <FiClock className="h-2.5 w-2.5" /> Pending approval
                  </span>
                </div>
                {bookingType === 'room' ? (
                  <>Requested {result.booking.quantity} room{result.booking.quantity > 1 ? 's' : ''} from {result.booking.booking_date} to {result.booking.checkout_date}.</>
                ) : bookingType === 'ticket' ? (
                  <>Requested {result.booking.quantity} ticket{result.booking.quantity > 1 ? 's' : ''} for {result.booking.booking_date}.</>
                ) : (
                  <>Requested for {result.booking.booking_date} at {result.booking.slot_start}.</>
                )}{' '}
                The store has been notified and will confirm shortly — message or call them below if you need to.
              </div>
              <a
                href={calendarLink(`${service.name}${businessName ? ` - ${businessName}` : ''}`, result.booking, bookingType)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:border-blue-300 hover:text-blue-600"
              >
                <FiCalendar className="h-4 w-4" /> Add to my calendar
              </a>
              <BookingChatCallPanel
                bookingId={result.booking.id}
                conversationId={result.conversationId}
                selfId={identity?.userId}
                selfName={name}
              />
            </>
          ) : (
            <>
              {bookingType === 'room' ? (
                <RoomPicker productId={service.id} refreshKey={refreshKey} onSelect={setSelected} selected={selected} />
              ) : bookingType === 'ticket' ? (
                <TicketPicker productId={service.id} refreshKey={refreshKey} onSelect={setSelected} selected={selected} />
              ) : (
                <SlotPicker productId={service.id} refreshKey={refreshKey} onSelect={setSelected} selected={selected} />
              )}

              <div className="space-y-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  aria-label="Your name"
                  className="w-full text-sm bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg px-3 py-2"
                />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  type="tel"
                  autoComplete="tel"
                  aria-label="Phone"
                  className="w-full text-sm bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg px-3 py-2"
                />
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything the store should know? (optional)"
                  rows={2}
                  className="w-full text-sm bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <DynamicBookingFields
                fields={formFields}
                values={formValues}
                onChange={setFormValues}
                productId={service.id}
              />

              {selected && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  <FiCalendar className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium">{summarize(bookingType, selected)}</span>
                </div>
              )}

              {error && (
                <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              )}
              <p className="text-center text-[11px] text-gray-400">The store confirms your request. You can message them after booking.</p>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={!selected || submitting}
                className="sticky bottom-0 w-full rounded-lg bg-blue-600 text-white py-3 font-semibold shadow-lg shadow-blue-200 transition active:scale-[0.99] hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none"
              >
                {submitting ? 'Booking…' : CONFIRM_LABEL(bookingType, selected)}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookServiceModal;
