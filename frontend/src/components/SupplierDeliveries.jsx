import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader, MapPin, Navigation, Phone, RefreshCw, Star } from 'lucide-react';
import supplierDeliveriesService from '../services/supplierDeliveriesService';
import { METHOD, METHOD_LABEL, STAGE, STAGE_META, isActiveStage } from '../utils/supplierDeliveryStage';
import '../styles/supplier-classic.css';

const formatUgx = (value) => `UGX ${Math.round(Number(value) || 0).toLocaleString()}`;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const formatTime = (value) => (value ? new Date(value).toLocaleString('en-UG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const mapsUrl = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

const DUE_BADGE = {
  overdue: { label: 'Overdue', tone: 'bad' },
  today: { label: 'Due today', tone: 'warn' },
  soon: { label: 'Due soon', tone: 'warn' },
};

const LEG_LABEL = { road_leg: 'Road', sea_leg: 'Sea', air_leg: 'Air' };
const LEG_STATUS = {
  pending: 'Waiting', ready_to_dispatch: 'Ready', queued: 'Queued', scheduled: 'Scheduled',
  dispatched: 'Dispatched', in_transit: 'Travelling', in_progress: 'Travelling', completed: 'Done', delivered: 'Done',
};

const FILTERS = [
  { id: 'active', label: 'Active' },
  { id: 'action', label: 'Needs action' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'all', label: 'All' },
];

const POLL_MS = 120000; // Free plan: never poll faster than every 2 minutes.

/**
 * The supplier's delivery desk: every order that has to travel to a buyer, the
 * BodaGoEra trip carrying it (rider, plate, status), and what to do next.
 * Orders are ranked so overdue and moving trips come first.
 */
export default function SupplierDeliveries({ supplierProfile, onGoProfile, onOpenOrders }) {
  const [state, setState] = useState({ deliveries: [], tripsAvailable: true, hasPickupPin: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('active');
  const [updatedAt, setUpdatedAt] = useState(null);
  const touchedFilter = useRef(false);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    const result = await supplierDeliveriesService.getSupplierDeliveries({
      businessProfileHint: supplierProfile?.supplier_business_profile_id || null,
    });
    if (result.success) {
      setState({ deliveries: result.deliveries, tripsAvailable: result.tripsAvailable, hasPickupPin: result.hasPickupPin });
      setError('');
      setUpdatedAt(new Date());
      // First load: land on the list that has something in it.
      if (!touchedFilter.current) {
        touchedFilter.current = true;
        const active = result.deliveries.some((d) => isActiveStage(d.stage));
        if (!active && result.deliveries.length > 0) setFilter('all');
      }
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [supplierProfile?.supplier_business_profile_id]);

  useEffect(() => { load(); }, [load]);

  // Keep moving trips fresh, but only while the tab is visible.
  const hasMoving = state.deliveries.some((d) => [STAGE.FINDING, STAGE.ASSIGNED, STAGE.ON_THE_WAY].includes(d.stage));
  useEffect(() => {
    if (!hasMoving) return undefined;
    const timer = setInterval(() => { if (!document.hidden) load({ quiet: true }); }, POLL_MS);
    return () => clearInterval(timer);
  }, [hasMoving, load]);

  const { deliveries } = state;
  const counts = useMemo(() => ({
    active: deliveries.filter((d) => isActiveStage(d.stage)).length,
    action: deliveries.filter((d) => d.needsAction).length,
    overdue: deliveries.filter((d) => d.due === 'overdue').length,
    delivered: deliveries.filter((d) => d.stage === STAGE.DELIVERED).length,
    moving: deliveries.filter((d) => [STAGE.ASSIGNED, STAGE.ON_THE_WAY].includes(d.stage)).length,
  }), [deliveries]);

  const visible = deliveries.filter((d) => {
    if (filter === 'active') return isActiveStage(d.stage);
    if (filter === 'action') return d.needsAction;
    if (filter === 'delivered') return d.stage === STAGE.DELIVERED;
    return true;
  });

  const needsRider = deliveries.some((d) => isActiveStage(d.stage) && d.method !== METHOD.self && d.method !== METHOD.pickup);

  return (
    <div className="spc">
      <section className="spc-hero">
        <p className="spc-eyebrow">Deliveries</p>
        <h2>Track every delivery</h2>
        <p>Each order that has to reach a buyer, with the rider carrying it, where it is now, and what you need to do next.</p>
      </section>

      <div className="spc-stats">
        <div className="spc-stat is-ok"><p className="spc-stat-label">In motion</p><p className="spc-stat-value">{loading && !updatedAt ? '-' : counts.moving}</p><p className="spc-stat-note">rider assigned or travelling</p></div>
        <div className="spc-stat is-warn"><p className="spc-stat-label">Needs action</p><p className="spc-stat-value">{loading && !updatedAt ? '-' : counts.action}</p><p className="spc-stat-note">waiting on you</p></div>
        <div className="spc-stat is-bad"><p className="spc-stat-label">Overdue</p><p className="spc-stat-value">{loading && !updatedAt ? '-' : counts.overdue}</p><p className="spc-stat-note">past expected date</p></div>
        <div className="spc-stat"><p className="spc-stat-label">Delivered</p><p className="spc-stat-value">{loading && !updatedAt ? '-' : counts.delivered}</p><p className="spc-stat-note">recent orders</p></div>
      </div>

      {error && <p className="spc-note bad">{error}</p>}
      {!error && state.hasPickupPin === false && needsRider && (
        <p className="spc-note warn">
          Your business location is not pinned, so BodaGoEra cannot book a rider to collect from you.{' '}
          {onGoProfile && <button type="button" onClick={onGoProfile} style={{ background: 'none', border: 0, padding: 0, textDecoration: 'underline', fontWeight: 700, color: 'inherit' }}>Pin it in your profile</button>}
        </p>
      )}
      {!error && !state.tripsAvailable && deliveries.some((d) => d.kind === 'store') && (
        <p className="spc-note info">Live rider and trip details are not switched on yet. Order-level delivery status is shown below.</p>
      )}

      <section className="spc-card" aria-label="Deliveries">
        <div className="spc-card-head">
          <div>
            <p className="spc-eyebrow">Trips and handovers</p>
            <h3 className="spc-title">{updatedAt ? `Updated ${updatedAt.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })}` : 'Loading…'}</h3>
          </div>
          <button type="button" className="spc-icon-btn" onClick={() => load()} disabled={loading} title="Refresh" aria-label="Refresh deliveries">
            <RefreshCw size={18} className={loading ? 'spc-spin' : ''} />
          </button>
        </div>

        <div className="spc-seg" role="tablist" style={{ marginBottom: 12 }}>
          {FILTERS.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? 'on' : ''}
              onClick={() => { touchedFilter.current = true; setFilter(item.id); }}>
              {item.label}<b>{item.id === 'all' ? deliveries.length : counts[item.id]}</b>
            </button>
          ))}
        </div>

        {loading && !updatedAt ? (
          <p className="spc-sub" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Loader size={16} className="spc-spin" /> Loading deliveries…</p>
        ) : visible.length === 0 ? (
          <div className="spc-empty">
            <b>{deliveries.length === 0 ? 'No deliveries yet' : 'Nothing in this view'}</b>
            <span>{deliveries.length === 0
              ? 'When a store or business orders from you, the order and its delivery appear here.'
              : 'Pick a different filter above.'}</span>
          </div>
        ) : (
          <div className="spc-list">
            {visible.map((delivery) => (
              <DeliveryCard key={delivery.key} delivery={delivery} tripsAvailable={state.tripsAvailable} onChanged={() => load({ quiet: true })} onOpenOrders={onOpenOrders} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DeliveryCard({ delivery, tripsAvailable, onChanged, onOpenOrders }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const meta = STAGE_META[delivery.stage] || STAGE_META.arrange;
  const due = DUE_BADGE[delivery.due];
  const { steps, at } = delivery.track;
  const ride = delivery.trip?.ride || null;
  const legs = delivery.trip?.journey?.legs || [];

  const canSelfDeliver = delivery.kind === 'store' && delivery.status === 'confirmed' && !delivery.trip
    && delivery.stage === STAGE.ARRANGE && delivery.method !== METHOD.pickup;
  const canUndo = delivery.kind === 'store' && delivery.status === 'confirmed' && delivery.method === METHOD.self && delivery.stage === STAGE.ON_THE_WAY;

  const toggleSelf = async (dispatched) => {
    if (dispatched && !window.confirm('Mark this order as out for delivery by you? The store will see it is on its way.')) return;
    setBusy(true);
    setError('');
    const result = await supplierDeliveriesService.setOrderDispatched(delivery.id, dispatched);
    setBusy(false);
    if (!result.success) { setError(result.error); return; }
    onChanged();
  };

  return (
    <div className="spc-item">
      <button type="button" className="spc-item-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <div className="spc-item-main">
          <p className="spc-item-title">{delivery.reference} · {delivery.buyer}</p>
          <p className="spc-item-meta">{delivery.summary}{delivery.expected_delivery_date ? ` · Expected ${formatDate(delivery.expected_delivery_date)}` : ''}</p>
          <p className="spc-item-meta" style={{ fontWeight: 600 }}>
            Step {at + 1} of {steps.length} · {steps[at]}
          </p>
        </div>
        <div className="spc-item-side">
          <span className={`spc-badge ${meta.tone}`}>{meta.label}</span>
          {due && <span className={`spc-badge ${due.tone}`}>{due.label}</span>}
        </div>
        <ChevronDown size={18} className={`spc-chev ${open ? 'open' : ''}`} />
      </button>

      {open && (
        <div className="spc-item-body">
          {delivery.next && <p className="spc-note info" style={{ marginTop: 10 }}>{delivery.next}</p>}

          <ol className="spc-track" aria-label="Delivery progress">
            {steps.map((label, index) => (
              <li key={label} className={index < at ? 'done' : index === at ? 'now' : ''}>
                <i aria-hidden="true" />
                <span>{label}</span>
              </li>
            ))}
          </ol>

          {ride && (
            <div className="spc-rider">
              {ride.rider_avatar ? <img src={ride.rider_avatar} alt="" /> : <span className="spc-rider-ph" aria-hidden="true">{(ride.rider_name || 'R').charAt(0)}</span>}
              <div style={{ minWidth: 0 }}>
                <p className="spc-item-title">{ride.rider_name}</p>
                <p className="spc-item-meta">
                  {[ride.vehicle_color, ride.vehicle_model, ride.vehicle_type].filter(Boolean).join(' ')}
                  {ride.plate_number ? ` · ${ride.plate_number}` : ''}
                </p>
                {ride.rider_rating != null && Number(ride.rider_rating) > 0 && (
                  <p className="spc-item-meta" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Star size={12} /> {Number(ride.rider_rating).toFixed(1)}</p>
                )}
              </div>
            </div>
          )}

          {legs.length > 0 && (
            <div>
              <p className="spc-sub-h" style={{ marginBottom: 6 }}>Journey legs</p>
              <div className="spc-legs">
                {legs.map((leg) => (
                  <div key={leg.leg_order} className="spc-leg">
                    <b>{LEG_LABEL[leg.leg_type] || leg.leg_type}</b>
                    <span>{[leg.from, leg.to].filter(Boolean).join(' → ')}</span>
                    <span className="spc-badge">{LEG_STATUS[leg.status] || leg.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="spc-kv">
            <div><p className="k">How it travels</p><p className="v">{METHOD_LABEL[delivery.method]}</p></div>
            <div><p className="k">Order value</p><p className="v">{formatUgx(delivery.amount)}</p></div>
            {delivery.vehicle && <div><p className="k">Vehicle</p><p className="v" style={{ textTransform: 'capitalize' }}>{delivery.vehicle}</p></div>}
            <div><p className="k">Ordered</p><p className="v">{formatDate(delivery.ordered_at)}</p></div>
            {ride?.started_at && <div><p className="k">Collected</p><p className="v">{formatTime(ride.started_at)}</p></div>}
            {ride?.completed_at && <div><p className="k">Delivered</p><p className="v">{formatTime(ride.completed_at)}</p></div>}
            {ride?.distance_km != null && <div><p className="k">Distance</p><p className="v">{Number(ride.distance_km).toFixed(1)} km</p></div>}
            {delivery.pickup_from && <div className="wide"><p className="k">Pickup from</p><p className="v">{delivery.pickup_from}</p></div>}
            <div className="wide"><p className="k">Deliver to</p><p className="v">{delivery.deliver_to || 'Address not set yet'}</p></div>
            {delivery.instructions && <div className="wide"><p className="k">Instructions</p><p className="v">{delivery.instructions}</p></div>}
          </div>

          {!tripsAvailable && delivery.kind === 'store' && delivery.method === METHOD.bodagoera && (
            <p className="spc-sub">Rider details appear here once live trip tracking is switched on.</p>
          )}

          <div className="spc-actions">
            {delivery.deliver_to && (
              <a className="spc-btn ghost" href={mapsUrl(delivery.deliver_to)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <Navigation size={16} /> Directions
              </a>
            )}
            {delivery.buyer_phone && (
              <a className="spc-btn ghost" href={`tel:${delivery.buyer_phone}`} style={{ textDecoration: 'none' }}>
                <Phone size={16} /> Call {delivery.kind === 'store' ? 'store' : 'buyer'}
              </a>
            )}
            {delivery.stage === STAGE.NEW && onOpenOrders && (
              <button type="button" className="spc-btn" onClick={onOpenOrders}>Open Orders to accept</button>
            )}
            {canSelfDeliver && (
              <button type="button" className="spc-btn gold" disabled={busy} onClick={() => toggleSelf(true)}>
                <MapPin size={16} /> {busy ? 'Saving…' : 'I am delivering this'}
              </button>
            )}
            {canUndo && (
              <button type="button" className="spc-btn danger" disabled={busy} onClick={() => toggleSelf(false)}>{busy ? 'Saving…' : 'Undo out for delivery'}</button>
            )}
          </div>
          {error && <p className="spc-note bad">{error}</p>}
        </div>
      )}
    </div>
  );
}
