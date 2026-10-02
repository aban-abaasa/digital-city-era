import React from 'react';
import { FiClock, FiTag, FiHome, FiCheck } from 'react-icons/fi';

// The three ways a service can be booked. One source of truth so the admin
// pickers, the availability tab and the customer browse screen all speak the
// same language (name, colour, icon, what the customer actually does).
export const BOOKING_TYPES = [
  {
    id: 'slot',
    label: 'Time slots',
    short: 'Appointments',
    emoji: '🕒',
    Icon: FiClock,
    tagline: 'Customer picks a day and a time',
    examples: 'Haircut, consultation, massage, repair',
    customerPicks: ['Date', 'Time'],
    youSet: 'Opening hours, minutes per booking, spots per slot',
    // Tailwind classes are written out in full so the compiler keeps them.
    accent: {
      ring: 'ring-blue-500 border-blue-500',
      soft: 'bg-blue-50 text-blue-700',
      solid: 'bg-blue-600 text-white',
      grad: 'from-blue-500 to-indigo-500',
      dot: 'bg-blue-500',
    },
  },
  {
    id: 'ticket',
    label: 'Tickets',
    short: 'Events & classes',
    emoji: '🎫',
    Icon: FiTag,
    tagline: 'Customer picks a day and how many seats',
    examples: 'Event, workshop, class, tour, entry pass',
    customerPicks: ['Date', 'Quantity'],
    youSet: 'How many tickets are available each day',
    accent: {
      ring: 'ring-fuchsia-500 border-fuchsia-500',
      soft: 'bg-fuchsia-50 text-fuchsia-700',
      solid: 'bg-fuchsia-600 text-white',
      grad: 'from-fuchsia-500 to-pink-500',
      dot: 'bg-fuchsia-500',
    },
  },
  {
    id: 'room',
    label: 'Rooms & stays',
    short: 'Date ranges',
    emoji: '🛏️',
    Icon: FiHome,
    tagline: 'Customer picks check-in, check-out and rooms',
    examples: 'Hotel room, guest house, hall, equipment hire',
    customerPicks: ['Check-in', 'Check-out', 'Rooms'],
    youSet: 'How many rooms or units are free each night',
    accent: {
      ring: 'ring-emerald-500 border-emerald-500',
      soft: 'bg-emerald-50 text-emerald-700',
      solid: 'bg-emerald-600 text-white',
      grad: 'from-emerald-500 to-teal-500',
      dot: 'bg-emerald-500',
    },
  },
];

export const getBookingType = (id) => BOOKING_TYPES.find((t) => t.id === id) || BOOKING_TYPES[0];

// A tiny, honest mock of what the customer will see for each type, so an admin
// understands the choice by looking, not by reading a dropdown.
const Preview = ({ type }) => {
  const a = type.accent;
  if (type.id === 'slot') {
    return (
      <div className="space-y-1.5">
        <div className="flex gap-1">
          {['Mon', 'Tue', 'Wed', 'Thu'].map((d, i) => (
            <span key={d} className={`rounded-md px-2 py-1 text-[10px] font-semibold ${i === 1 ? a.solid : 'bg-gray-100 text-gray-500'}`}>
              {d}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {['09:00', '09:30', '10:00', '10:30'].map((t, i) => (
            <span key={t} className={`rounded-md border px-2 py-1 text-[10px] font-medium ${i === 2 ? `${a.soft} border-current` : 'border-gray-200 text-gray-500'}`}>
              {t}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (type.id === 'ticket') {
    return (
      <div className="space-y-1.5">
        <span className={`inline-block rounded-md px-2 py-1 text-[10px] font-semibold ${a.solid}`}>Sat 12 Oct</span>
        <div className="flex items-center gap-2 text-[11px] text-gray-600">
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300">−</span>
          <span className="font-semibold">2 tickets</span>
          <span className={`flex h-5 w-5 items-center justify-center rounded-full ${a.solid}`}>+</span>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] font-semibold">
        <span className={`rounded-md px-2 py-1 ${a.solid}`}>Fri 3 Oct</span>
        <span className="text-gray-400">→</span>
        <span className={`rounded-md px-2 py-1 ${a.soft}`}>Mon 6 Oct</span>
      </div>
      <p className="text-[11px] text-gray-600">3 nights · 1 room</p>
    </div>
  );
};

/**
 * variant="cards"  — full visual chooser (use when creating/editing one service)
 * variant="chips"  — compact segmented control (use in dense lists)
 * Both are controlled: value + onChange(id). `disabled` greys them out.
 */
const BookingTypePicker = ({ value, onChange, disabled = false, variant = 'cards', showPreview = true }) => {
  if (variant === 'chips') {
    return (
      <div
        role="radiogroup"
        aria-label="How customers book this"
        className={`inline-flex rounded-full bg-gray-100 p-0.5 ${disabled ? 'opacity-50' : ''}`}
      >
        {BOOKING_TYPES.map((t) => {
          const active = value === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => !active && onChange(t.id)}
              title={`${t.label}: ${t.tagline}`}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
                active ? `${t.accent.solid} shadow-sm` : 'text-gray-500 hover:text-gray-800'
              } ${disabled ? 'cursor-not-allowed' : ''}`}
            >
              <t.Icon className="h-3 w-3" />
              {t.label}
            </button>
          );
        })}
      </div>
    );
  }

  const current = getBookingType(value);
  return (
    <div className={disabled ? 'opacity-60' : ''}>
      <div role="radiogroup" aria-label="How customers book this" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {BOOKING_TYPES.map((t) => {
          const active = value === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(t.id)}
              className={`group relative overflow-hidden rounded-xl border bg-white p-3 text-left transition-all focus:outline-none focus-visible:ring-2 ${
                active
                  ? `${t.accent.ring} ring-2 shadow-md`
                  : 'border-gray-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${t.accent.grad} text-white shadow-sm transition-transform group-hover:scale-105`}>
                <t.Icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-bold text-gray-900">{t.label}</p>
              <p className="mt-0.5 text-xs leading-snug text-gray-500">{t.tagline}</p>
              {active && (
                <span className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full ${t.accent.solid} animate-pop-in`}>
                  <FiCheck className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {showPreview && (
        <div key={current.id} className="mt-3 grid gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 animate-fade-in-up sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">What customers see</p>
            <div className="rounded-lg border border-gray-200 bg-white p-2.5">
              <Preview type={current} />
            </div>
          </div>
          <div className="space-y-1.5 text-xs">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Good for</p>
            <p className="text-gray-700">{current.examples}</p>
            <p className="pt-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">You control</p>
            <p className="text-gray-700">{current.youSet}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Small coloured pill for lists / cards.
export const BookingTypeBadge = ({ type, className = '' }) => {
  const t = getBookingType(type);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.accent.soft} ${className}`}>
      <t.Icon className="h-2.5 w-2.5" />
      {t.label}
    </span>
  );
};

export default BookingTypePicker;
