import React, { useEffect, useState } from 'react';
import { FiX, FiClock } from 'react-icons/fi';
import SlotPicker from './SlotPicker';
import TicketPicker from './TicketPicker';
import RoomPicker from './RoomPicker';
import BookingChatCallPanel from './BookingChatCallPanel';
import DynamicBookingFields, { findMissingRequiredField } from './DynamicBookingFields';
import { createBooking, getBookingFormFieldsForService } from '../../services/bookingService';

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
  const [formFields, setFormFields] = useState([]);
  const [formValues, setFormValues] = useState({});

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
      });
      setResult(data);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message || 'Could not complete that booking — availability may have just changed.');
      setRefreshKey((k) => k + 1);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div>
            <h3 className="font-semibold text-gray-800">{service.name}</h3>
            {businessName && <p className="text-xs text-gray-400">{businessName}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {result?.success ? (
            <>
              <div className="animate-pop-in rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-sm text-emerald-800">
                <div className="mb-1.5 flex items-center gap-1.5">
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
                  className="w-full text-sm bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg px-3 py-2"
                />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone (optional)"
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

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="button"
                onClick={handleConfirm}
                disabled={!selected || submitting}
                className="w-full rounded-lg bg-blue-600 text-white py-2.5 font-medium disabled:opacity-50"
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
