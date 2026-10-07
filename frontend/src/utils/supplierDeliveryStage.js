// Turns an order (store purchase order or marketplace order) plus its live
// BodaGoEra trip into ONE delivery stage the supplier can act on. Pure functions:
// no network, so the rules can be tested on their own.

export const METHOD = {
  bodagoera: 'bodagoera',
  self: 'self',
  pickup: 'pickup',
  undecided: 'undecided',
};

export const METHOD_LABEL = {
  bodagoera: 'BodaGoEra rider',
  self: 'Your own delivery',
  pickup: 'Store collects',
  undecided: 'Not arranged yet',
};

// Stage keys, in the order a delivery normally moves through them.
export const STAGE = {
  NEW: 'new',                 // order not accepted yet
  ARRANGE: 'arrange',         // accepted, delivery not arranged / not started
  FINDING: 'finding',         // rider requested, none assigned yet
  ASSIGNED: 'assigned',       // rider accepted, on the way to collect
  ON_THE_WAY: 'on_the_way',   // goods are travelling
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

export const STAGE_META = {
  new:        { label: 'New order',            tone: 'info' },
  arrange:    { label: 'Ready to hand over',   tone: 'warn' },
  finding:    { label: 'Finding a rider',      tone: 'warn' },
  assigned:   { label: 'Rider assigned',       tone: 'info' },
  on_the_way: { label: 'On the way',           tone: 'ok' },
  delivered:  { label: 'Delivered',            tone: 'ok' },
  cancelled:  { label: 'Cancelled',            tone: 'bad' },
};

// The step track shown inside a card. `at` is the index of the step reached.
const TRACKS = {
  bodagoera: ['Accepted', 'Rider requested', 'Rider assigned', 'On the way', 'Delivered'],
  self:      ['Accepted', 'Preparing', 'Out for delivery', 'Delivered'],
  pickup:    ['Accepted', 'Ready for pickup', 'Delivered'],
  undecided: ['Accepted', 'Delivery arranged', 'On the way', 'Delivered'],
};

const IDLE_LEG = ['pending', 'ready_to_dispatch', 'queued', 'scheduled'];
const DONE_LEG = ['completed', 'delivered', 'arrived'];
const DEAD_LEG = ['cancelled', 'failed', 'refunded'];

const norm = (value) => String(value || '').toLowerCase();

/** How the goods travel, from the strongest signal to the weakest. */
export function deliveryMethodOf(order, trip) {
  if (trip?.ride || trip?.journey) return METHOD.bodagoera;
  const method = norm(order.delivery_method);
  if (method === 'supermarket_pickup') return METHOD.pickup;
  if (method === 'supplier_delivery') return METHOD.self;
  if (method === 'mybodaguy_delivery') return METHOD.bodagoera;
  if (norm(order.transport_provider) === 'supplier') return METHOD.self;
  if (['requested', 'dispatched', 'delivered'].includes(norm(order.transport_status))
      && norm(order.transport_provider) !== 'supplier') return METHOD.bodagoera;
  return METHOD.undecided;
}

function journeyStage(journey) {
  const legs = journey?.legs || [];
  if (legs.length === 0) return null;
  const live = legs.filter((leg) => !DEAD_LEG.includes(norm(leg.status)));
  if (live.length === 0) return null;
  if (live.every((leg) => DONE_LEG.includes(norm(leg.status)))) return STAGE.DELIVERED;
  const moving = live.some((leg) => !IDLE_LEG.includes(norm(leg.status)) && !DONE_LEG.includes(norm(leg.status)));
  if (moving || live.some((leg) => DONE_LEG.includes(norm(leg.status)))) return STAGE.ON_THE_WAY;
  return STAGE.FINDING;
}

function rideStage(ride) {
  switch (norm(ride?.status)) {
    case 'pending': return STAGE.FINDING;
    case 'accepted': return STAGE.ASSIGNED;
    case 'in_progress': return STAGE.ON_THE_WAY;
    case 'completed': return STAGE.DELIVERED;
    default: return null;
  }
}

/**
 * Which stage is this order in?
 *  order: { kind: 'store' | 'marketplace', status, transport_status, delivery_method, ... }
 *  trip:  { ride, journey } from supplier_get_delivery_trips, or undefined
 */
export function stageOf(order, trip) {
  const status = norm(order.status);
  const transport = norm(order.transport_status);

  if (['cancelled', 'rejected'].includes(status)) return STAGE.CANCELLED;
  if (['received', 'completed', 'fulfilled', 'delivered'].includes(status) || order.delivered_date || transport === 'delivered') {
    return STAGE.DELIVERED;
  }

  // Live trip data wins: it is what the rider is actually doing.
  const fromTrip = journeyStage(trip?.journey) || rideStage(trip?.ride);
  if (fromTrip) return fromTrip;

  if (['sent_to_supplier', 'approved', 'pending_approval', 'pending', 'submitted'].includes(status)) return STAGE.NEW;

  if (transport === 'dispatched') return STAGE.ON_THE_WAY;
  if (transport === 'requested') return STAGE.FINDING;
  return STAGE.ARRANGE;
}

/** Steps for the card's progress track and which one is current. */
export function trackOf(order, trip, stage = stageOf(order, trip)) {
  const method = deliveryMethodOf(order, trip);
  const steps = TRACKS[method];
  const last = steps.length - 1;
  let at = 0;
  if (stage === STAGE.DELIVERED) at = last;
  else if (stage === STAGE.CANCELLED || stage === STAGE.NEW) at = 0;
  else if (method === METHOD.bodagoera) at = { arrange: 0, finding: 1, assigned: 2, on_the_way: 3 }[stage] ?? 0;
  else if (method === METHOD.self) at = { arrange: 1, on_the_way: 2 }[stage] ?? 1;
  else if (method === METHOD.pickup) at = 1;
  else at = { arrange: 1, finding: 1, assigned: 1, on_the_way: 2 }[stage] ?? 1;
  return { method, steps, at: Math.min(at, last) };
}

const startOfDay = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** 'overdue' | 'today' | 'soon' (within 2 days) | null — only for undelivered orders. */
export function dueState(order, stage, now = Date.now()) {
  if (!order.expected_delivery_date || [STAGE.DELIVERED, STAGE.CANCELLED].includes(stage)) return null;
  const days = Math.round((startOfDay(order.expected_delivery_date) - startOfDay(now)) / 86400000);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 2) return 'soon';
  return null;
}

/** One plain-language line telling the supplier what to do (or wait for) next. */
export function nextStep(order, trip, stage, method) {
  switch (stage) {
    case STAGE.NEW:
      return 'Accept the order in Orders so delivery can be arranged.';
    case STAGE.ARRANGE:
      if (method === METHOD.self) return 'Pack the goods, then mark the order out for delivery when it leaves.';
      if (method === METHOD.pickup) return 'Have the goods ready; the store will collect them.';
      return 'Pack the goods. A BodaGoEra rider is booked automatically once both locations are pinned.';
    case STAGE.FINDING:
      return 'A rider is being matched. Keep the goods packed and ready at your pickup point.';
    case STAGE.ASSIGNED:
      return trip?.ride?.plate_number
        ? `Rider ${trip.ride.rider_name || ''} (${trip.ride.plate_number}) is coming to collect. Check their plate before handing over.`
        : 'A rider is coming to collect. Check their plate before handing over.';
    case STAGE.ON_THE_WAY:
      return method === METHOD.self ? 'You have this order out for delivery. The store confirms receipt.' : 'Goods are with the rider. Nothing to do.';
    case STAGE.DELIVERED:
      return order.status && ['received', 'completed', 'fulfilled'].includes(norm(order.status))
        ? 'Delivered and received by the buyer.'
        : 'Delivered by the rider. Waiting for the buyer to confirm receipt.';
    default:
      return '';
  }
}

const URGENCY = { on_the_way: 1, assigned: 2, finding: 3, new: 4, arrange: 5, delivered: 9, cancelled: 10 };

/** Whether the supplier has to do something. */
export function needsAction(order, stage, method, due) {
  if ([STAGE.DELIVERED, STAGE.CANCELLED].includes(stage)) return false;
  if (stage === STAGE.NEW) return true;
  if (stage === STAGE.ARRANGE && method === METHOD.self) return true;
  return due === 'overdue';
}

export function sortDeliveries(list) {
  return [...list].sort((a, b) => {
    const rank = (d) => (d.due === 'overdue' ? 0 : (URGENCY[d.stage] ?? 6));
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    const ta = a.expected_delivery_date ? new Date(a.expected_delivery_date).getTime() : Infinity;
    const tb = b.expected_delivery_date ? new Date(b.expected_delivery_date).getTime() : Infinity;
    if (ta !== tb) return ta - tb;
    return new Date(b.ordered_at || 0).getTime() - new Date(a.ordered_at || 0).getTime();
  });
}

export const isActiveStage = (stage) => ![STAGE.DELIVERED, STAGE.CANCELLED].includes(stage);
