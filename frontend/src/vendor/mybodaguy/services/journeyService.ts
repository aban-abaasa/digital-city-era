/**
 * Ported from mybodaguy's src/mybodaguy/services/journeyService.ts. Unlike
 * the original (same-origin relative /api/... calls), this one calls
 * mybodaguy's Vercel deployment cross-origin, since supermarkera and BodaGo
 * are two separate Vercel projects sharing one Supabase backend. The
 * journeys endpoints on mybodaguy's side have CORS enabled for this origin
 * (see mybodaguy/frontend/api/_lib/cors.js, ALLOWED_ORIGINS env var).
 *
 * requestShipCargoJourney is a direct Supabase RPC (no third-party secret
 * needed, unlike flight booking), so it needs no MBG_API_BASE_URL prefix —
 * same as getMyJourneys below.
 */
import { supabase } from './supabaseClient';

const MBG_API_BASE_URL = import.meta.env.VITE_MBG_API_BASE_URL || 'https://bodagoera.icanera.space';

export interface FlightOffer {
  offerId: string;
  carrier: string;
  totalAmount: string;
  totalCurrency: string;
  slices: any[];
  expiresAt: string;
}

export interface JourneyPickup {
  lat: number;
  lng: number;
  address: string;
  country?: string;
  city?: string;
  /** Customer's choice for the first leg — 'motorcycle' or 'car'. Falls
   * back to matching any available passenger vehicle when omitted. */
  vehicleType?: 'motorcycle' | 'car';
}

export interface JourneyDestination {
  address: string;
  country: string;
  city?: string;
  lat?: number | null;
  lng?: number | null;
}

export interface JourneyQuote {
  pickupFareUgx: number;
  flightFareUgx: number;
  cargoFareUgx: number;
  dropoffFareUgx: number;
  totalUgx: number;
  totalIcan: number;
  pickup: JourneyPickup;
  destination: JourneyDestination;
  offer: FlightOffer;
  cargoWeightKg: number;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${MBG_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Request to ${path} failed`);
  }
  return data as T;
}

export async function searchFlights(params: {
  originIata: string;
  destinationIata: string;
  departureDate: string;
  passengerCount?: number;
}): Promise<{ offerRequestId: string; offers: FlightOffer[] }> {
  return postJson('/api/journeys/flights/search', params);
}

export interface AirportSuggestion {
  iataCode: string;
  name: string;
  cityName: string | null;
  countryCode: string;
}

/** Resolves a typed city/airport name to real IATA codes (Duffel Places API)
 * so a customer never has to know/type a raw airport code. */
export async function searchAirports(query: string, countryCode?: string): Promise<{ airports: AirportSuggestion[] }> {
  return postJson('/api/journeys/flights/airports', { query, countryCode });
}

export async function getJourneyQuote(params: {
  customerUserId: string;
  pickup: JourneyPickup;
  offer: FlightOffer;
  destination: JourneyDestination;
  /** Extra baggage/cargo the passenger is bringing along on the flight,
   * beyond the free allowance — a straightforward per-kg platform
   * surcharge, not a real airline ancillary-baggage booking. */
  cargoWeightKg?: number;
}): Promise<{ quote: JourneyQuote }> {
  return postJson('/api/journeys/quote', params);
}

export async function confirmJourney(params: {
  customerUserId: string;
  quote: JourneyQuote;
  passengers: Array<{ type: 'adult'; given_name: string; family_name: string; born_on: string; gender: 'm' | 'f'; email: string; phone_number: string; title?: string }>;
}): Promise<{ journeyId: string; pnr: string }> {
  return postJson('/api/journeys/confirm', params);
}

export interface JourneyLeg {
  id: string;
  leg_order: number;
  leg_type: 'local_pickup' | 'flight' | 'local_dropoff' | 'road_leg' | 'sea_leg';
  status: string;
  ride_id: string | null;
  dispatch_after: string | null;
  flight_booking?: {
    pnr: string;
    status: string;
    current_departure_at: string;
    current_arrival_at: string;
  } | null;
  // The actual best-available rider mbg_dispatch_journey_leg matched (see
  // mbg_find_available_vehicles — nearest, then highest-rated) for this leg.
  ride?: {
    id: string;
    status: string;
    fare: number;
    rider?: {
      plate_number: string;
      vehicle_type: string;
      vehicle_color: string | null;
      vehicle_model: string | null;
      rating: number;
      user?: { phone: string | null; profile?: { full_name: string | null } | null } | null;
    } | null;
  } | null;
}

export interface Journey {
  id: string;
  status: string;
  destination_country: string;
  destination_city: string | null;
  destination_address: string | null;
  total_fare_ugx: number;
  total_fare_ican: number;
  legs: JourneyLeg[];
}

export async function getJourney(journeyId: string): Promise<Journey> {
  const res = await fetch(`${MBG_API_BASE_URL}/api/journeys/${journeyId}`);
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch journey');
  return data.journey as Journey;
}

/** Live-ish polling helper for the journey status screen (no realtime channel yet in Phase 1). */
export function pollJourney(journeyId: string, onUpdate: (journey: Journey) => void, intervalMs = 10000): () => void {
  let cancelled = false;
  const tick = async () => {
    if (cancelled) return;
    try {
      onUpdate(await getJourney(journeyId));
    } catch (err) {
      console.error('pollJourney error:', err);
    }
  };
  tick();
  const id = setInterval(tick, intervalMs);
  return () => {
    cancelled = true;
    clearInterval(id);
  };
}

/**
 * Books a full end-to-end cargo shipment (pickup -> departure port -> sea
 * crossing -> arrival port -> final delivery) directly via Supabase RPC —
 * no third-party secret needed, so no MBG_API_BASE_URL prefix, unlike
 * flight booking.
 */
export async function requestShipCargoJourney(params: {
  pickupLocation: string; pickupLat: number; pickupLng: number; pickupCountry: string;
  dropoffLocation: string; dropoffLat: number; dropoffLng: number; dropoffCountry: string;
  cargoDescription?: string;
  cargoWeightKg?: number;
}): Promise<{ success: boolean; journeyId?: string; error?: string }> {
  const { data, error } = await supabase.rpc('mbg_request_ship_cargo_journey', {
    p_pickup_location: params.pickupLocation,
    p_pickup_lat: params.pickupLat,
    p_pickup_lng: params.pickupLng,
    p_pickup_country: params.pickupCountry,
    p_dropoff_location: params.dropoffLocation,
    p_dropoff_lat: params.dropoffLat,
    p_dropoff_lng: params.dropoffLng,
    p_dropoff_country: params.dropoffCountry,
    p_cargo_description: params.cargoDescription ?? null,
    p_cargo_weight_kg: params.cargoWeightKg ?? null,
  });
  if (error) return { success: false, error: error.message };
  return { success: !!data?.success, journeyId: data?.journey_id, error: data?.error };
}

// digital-city-era customers are keyed the same way as BodaGo customers
// (mbg_customers.user_id = auth.uid()) since both apps share one Supabase
// auth pool and mbg_* schema — no separate customer record needed here.
export async function getMyJourneys(customerUserId: string): Promise<Journey[]> {
  const { data: customer } = await supabase.from('mbg_customers').select('id').eq('user_id', customerUserId).single();
  if (!customer) return [];
  const { data, error } = await supabase
    .from('mbg_journeys')
    .select('*, legs:mbg_journey_legs(*, flight_booking:mbg_flight_bookings(*))')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Journey[];
}
