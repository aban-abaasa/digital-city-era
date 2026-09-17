import React, { useEffect, useMemo, useState } from 'react';
import { FiClock } from 'react-icons/fi';
import { getAvailableSlots } from '../../services/bookingService';

const formatTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = ((hour + 11) % 12) + 1;
  return `${displayHour}:${m} ${suffix}`;
};

const nextNDays = (n) => {
  const days = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
};

const toISODate = (d) => d.toISOString().slice(0, 10);

// A slot never disappears for being full — fn_get_available_slots keeps
// returning it with spots_left clamped to 0. It stays fully clickable: a
// "sold out" pick still goes through as a request the store approves by
// hand, it just wears a different badge so the customer knows to expect a
// wait instead of an instant hold.
const SlotBadge = ({ spotsLeft }) => {
  if (spotsLeft === 0) {
    return (
      <span className="absolute -top-2 -right-2 animate-badge-pop rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white shadow-sm">
        Full
      </span>
    );
  }
  if (spotsLeft <= 3) {
    return (
      <span className="absolute -top-2 -right-2 flex animate-badge-pop items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-semibold text-amber-900 shadow-sm">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-700" />
        {spotsLeft}
      </span>
    );
  }
  return null;
};

// Date strip + slot grid for one bookable product. Re-fetches whenever the
// date changes or `refreshKey` changes (bump it after a booking succeeds so
// a just-taken slot disappears for this viewer too, not just on reload).
const SlotPicker = ({ productId, refreshKey, onSelect, selected }) => {
  const days = useMemo(() => nextNDays(14), []);
  const [selectedDate, setSelectedDate] = useState(toISODate(days[0]));
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!productId || !selectedDate) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    getAvailableSlots(productId, selectedDate)
      .then((data) => {
        if (active) setSlots(data);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Could not load availability');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId, selectedDate, refreshKey]);

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map((d) => {
          const iso = toISODate(d);
          const isSelected = iso === selectedDate;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelectedDate(iso)}
              className={`flex-shrink-0 flex flex-col items-center rounded-lg border px-3 py-2 text-xs transition-all duration-200 ${
                isSelected
                  ? 'border-blue-600 bg-blue-600 text-white scale-105 shadow-md shadow-blue-200'
                  : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:-translate-y-0.5'
              }`}
            >
              <span>{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
              <span className="font-semibold">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          Loading available times…
        </div>
      )}
      {error && <p className="text-sm text-red-500 py-3">{error}</p>}
      {!loading && !error && slots.length === 0 && (
        <p className="text-sm text-gray-400 py-3">Not open this day — try another date.</p>
      )}

      {!loading && slots.length > 0 && (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2">
            {slots.map((s, i) => {
              const isSelected = selected?.date === selectedDate && selected?.slotStart === s.slot_start;
              const isFull = s.spots_left === 0;
              return (
                <button
                  key={s.slot_start}
                  type="button"
                  onClick={() => onSelect({ date: selectedDate, slotStart: s.slot_start, slotEnd: s.slot_end })}
                  style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                  className={`relative animate-fade-in-up rounded-lg border px-2 py-2 text-xs font-medium transition-all duration-200 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-600 text-white scale-105 shadow-md shadow-blue-200'
                      : isFull
                      ? 'border-dashed border-gray-300 text-gray-500 hover:border-rose-300 hover:-translate-y-0.5'
                      : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:-translate-y-0.5'
                  }`}
                >
                  <SlotBadge spotsLeft={s.spots_left} />
                  {formatTime(s.slot_start)}
                </button>
              );
            })}
          </div>
          <p className="flex items-center gap-1 pt-2 text-[11px] text-gray-400">
            <FiClock className="h-3 w-3" />
            "Full" slots can still be booked — you'll be added to the request list and the store confirms by chat.
          </p>
        </>
      )}
    </div>
  );
};

export default SlotPicker;
