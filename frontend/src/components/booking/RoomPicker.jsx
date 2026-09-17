import React, { useEffect, useState } from 'react';
import { getAvailableSlots } from '../../services/bookingService';

const toISODate = (d) => d.toISOString().slice(0, 10);
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

// Once every night of the stay is sold out there's no real ceiling to hand
// the stepper (it's no longer bounded by real capacity, it's a request the
// store reviews) — this is just a sane upper bound on the input itself.
const UNBOUNDED_MAX = 20;

// Check-in / check-out date range + "how many rooms" stepper for a 'room'
// product. Availability across the whole stay is the MINIMUM of every
// night's spots_left, shown as a live preview — but a stay is bookable
// even when that minimum is 0: fn_get_available_slots always returns each
// open night (spots_left clamped to 0 rather than omitted), and
// fn_create_service_booking only blocks a night that isn't open at all,
// never one that's merely full. A fully-booked stay still goes through as
// a request the store approves or declines by hand.
const RoomPicker = ({ productId, refreshKey, onSelect, selected }) => {
  const today = toISODate(new Date());
  const [checkin, setCheckin] = useState(selected?.checkin || today);
  const [checkout, setCheckout] = useState(selected?.checkout || addDays(today, 1));
  const [minAvailable, setMinAvailable] = useState(null);
  const [allNightsOpen, setAllNightsOpen] = useState(true);
  const [quantity, setQuantity] = useState(selected?.quantity || 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const nights = Math.round((new Date(`${checkout}T00:00:00`) - new Date(`${checkin}T00:00:00`)) / 86400000);

  useEffect(() => {
    if (!productId || !checkin || !checkout || nights < 1) {
      setMinAvailable(null);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    Promise.all(
      Array.from({ length: nights }, (_, i) => getAvailableSlots(productId, addDays(checkin, i)))
    )
      .then((nightsData) => {
        if (!active) return;
        const allOpen = nightsData.every((d) => (d?.length || 0) > 0);
        setAllNightsOpen(allOpen);
        const min = Math.min(...nightsData.map((d) => d?.[0]?.spots_left ?? 0));
        setMinAvailable(min);
        const cap = min > 0 ? min : UNBOUNDED_MAX;
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
  }, [productId, checkin, checkout, nights, refreshKey]);

  useEffect(() => {
    if (nights >= 1 && allNightsOpen) onSelect({ checkin, checkout, quantity });
    else onSelect(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkin, checkout, quantity, allNightsOpen, nights]);

  const isSoldOut = allNightsOpen && minAvailable <= 0;
  const stepMax = minAvailable > 0 ? minAvailable : UNBOUNDED_MAX;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Check-in</label>
          <input
            type="date"
            value={checkin}
            min={today}
            onChange={(e) => {
              const v = e.target.value;
              setCheckin(v);
              if (checkout <= v) setCheckout(addDays(v, 1));
            }}
            className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Check-out</label>
          <input
            type="date"
            value={checkout}
            min={addDays(checkin, 1)}
            onChange={(e) => setCheckout(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5"
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          Checking availability…
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!loading && !error && nights >= 1 && (
        !allNightsOpen ? (
          <p className="text-sm text-gray-400">Not open for every night of that stay — try different dates.</p>
        ) : (
          <div className="animate-fade-in-up">
            {isSoldOut && (
              <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200 px-2.5 py-1.5">
                <span className="animate-badge-pop rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                  Fully booked
                </span>
                <span className="text-[11px] text-rose-700">Request anyway — the store confirms by chat.</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {isSoldOut
                  ? 'How many rooms would you like to request?'
                  : `${minAvailable} room${minAvailable === 1 ? '' : 's'} available for ${nights} night${nights === 1 ? '' : 's'}`}
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
        )
      )}
    </div>
  );
};

export default RoomPicker;
