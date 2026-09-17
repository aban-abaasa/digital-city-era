import React, { useEffect, useMemo, useState } from 'react';
import { getAvailableSlots } from '../../services/bookingService';

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

// Once a date is sold out there's no real ceiling to hand the stepper
// (it's no longer bounded by real capacity, it's a request the store
// reviews) — this is just a sane upper bound on the input itself.
const UNBOUNDED_MAX = 20;

// Date strip + "how many" stepper for a 'ticket' product — no time-of-day,
// just a date and a quantity. A sold-out date still shows a badge and still
// lets the customer request tickets: fn_get_available_slots always returns
// the day's pseudo-slot (spots_left clamped to 0 rather than omitted), and
// booking it never hard-blocks on capacity — it lands as a request the
// store approves or declines.
const TicketPicker = ({ productId, refreshKey, onSelect, selected }) => {
  const days = useMemo(() => nextNDays(14), []);
  const [selectedDate, setSelectedDate] = useState(selected?.date || toISODate(days[0]));
  const [spotsLeft, setSpotsLeft] = useState(null);
  const [isOpenDay, setIsOpenDay] = useState(true);
  const [quantity, setQuantity] = useState(selected?.quantity || 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!productId || !selectedDate) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    getAvailableSlots(productId, selectedDate)
      .then((data) => {
        if (!active) return;
        const open = (data?.length || 0) > 0;
        setIsOpenDay(open);
        const left = data?.[0]?.spots_left ?? 0;
        setSpotsLeft(left);
        const cap = left > 0 ? left : UNBOUNDED_MAX;
        setQuantity((q) => Math.max(1, Math.min(q, cap)));
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

  useEffect(() => {
    if (isOpenDay) onSelect({ date: selectedDate, quantity });
    else onSelect(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, quantity, isOpenDay]);

  const isSoldOut = isOpenDay && spotsLeft <= 0;
  const stepMax = spotsLeft > 0 ? spotsLeft : UNBOUNDED_MAX;

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
          Checking availability…
        </div>
      )}
      {error && <p className="text-sm text-red-500 py-3">{error}</p>}
      {!loading && !error && (
        <>
          {!isOpenDay ? (
            <p className="text-sm text-gray-400 py-3">Not open this day — try another date.</p>
          ) : (
            <div className="animate-fade-in-up pt-2">
              {isSoldOut && (
                <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200 px-2.5 py-1.5">
                  <span className="animate-badge-pop rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                    Sold out
                  </span>
                  <span className="text-[11px] text-rose-700">Request anyway — the store confirms by chat.</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {isSoldOut ? 'How many would you like to request?' : `${spotsLeft} ticket${spotsLeft === 1 ? '' : 's'} left for this date`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="h-7 w-7 rounded-lg border border-gray-300 text-gray-600 transition hover:border-blue-400 active:scale-90"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-medium">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(stepMax, q + 1))}
                    className="h-7 w-7 rounded-lg border border-gray-300 text-gray-600 transition hover:border-blue-400 active:scale-90"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TicketPicker;
