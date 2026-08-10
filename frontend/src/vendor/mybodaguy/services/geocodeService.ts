/**
 * Ported from mybodaguy's src/mybodaguy/services/geocodeService.ts.
 * Free, no-API-key geocoding (OpenStreetMap Nominatim) so a customer can
 * just type a pickup address instead of being asked for raw lat/lng.
 * Fine for Phase 1's low volume; a production-scale rollout should move to
 * a hosted OSM-compatible geocoder with request caching.
 * Talks to Nominatim's public API directly (not mybodaguy's backend), so no
 * cross-origin/base-URL adaptation is needed here, unlike journeyService.ts.
 */
export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

// Nominatim's usage policy caps free public use at 1 request/second per
// client. This booking flow can fire several geocode calls close together
// (pickup address, city autocomplete, a dropped map pin's reverse lookup,
// its country lookup) — without this, those can silently collide and get
// rate-limited, which looks exactly like "no cities found" with no error.
// Serializing every Nominatim call through one throttled queue guarantees
// they're always spaced out, regardless of which function fired them.
const NOMINATIM_MIN_INTERVAL_MS = 1100;
let lastNominatimRequestAt = 0;
let nominatimQueue: Promise<void> = Promise.resolve();

function countryCodeHint(countryHint?: string): string | undefined {
  if (!countryHint) return undefined;
  const normalized = countryHint.trim().toLowerCase();
  if (normalized === 'uganda') return 'ug';
  return /^[a-z]{2}$/.test(normalized) ? normalized : undefined;
}

function throttledFetch(url: string, init?: RequestInit): Promise<Response> {
  const run = async () => {
    const wait = Math.max(0, lastNominatimRequestAt + NOMINATIM_MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastNominatimRequestAt = Date.now();
    return fetch(url, init);
  };
  const result = nominatimQueue.then(run);
  // Keep the queue alive even if this particular call fails, so one bad
  // request doesn't jam throttling for everything after it.
  nominatimQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

/**
 * countryHint biases short/local place names (e.g. "Ntinda" — a Kampala
 * neighborhood with no country in the text) toward the right country,
 * since Nominatim's global index often can't resolve a bare neighborhood
 * name on its own. Tries with the hint first, then falls back to the raw
 * query in case the caller already typed a full address themselves.
 */
export async function geocodeAddress(query: string, countryHint?: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  // Put the country-qualified query first. This is especially important for
  // short local names such as "Bugazi", "Kubiri" or "Ntinda", which can
  // otherwise resolve to a similarly named place in another country.
  const hasCountry = countryHint && trimmed.toLowerCase().includes(countryHint.toLowerCase());
  const attempts = countryHint && !hasCountry
    ? [`${trimmed}, ${countryHint}`, trimmed]
    : [trimmed];

  for (const attempt of attempts) {
    const params = new URLSearchParams({
      format: 'json',
      q: attempt,
      limit: '8',
      addressdetails: '1',
      'accept-language': 'en',
    });
    const countryCode = countryCodeHint(countryHint);
    if (countryCode) params.set('countrycodes', countryCode);

    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    const res = await throttledFetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) continue;

    const results = await res.json();
    if (results?.length) {
      // Nominatim can return a broad district before the exact minor place.
      // Prefer results whose name/address contains more of what the customer
      // typed, while still accepting every OSM feature type (not just cities).
      const tokens = trimmed.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      const ranked = results
        .filter((result: any) => Number.isFinite(Number(result.lat)) && Number.isFinite(Number(result.lon)))
        .map((result: any) => {
          const haystack = `${result.display_name || ''} ${result.name || ''}`.toLowerCase();
          const matches = tokens.filter((token) => haystack.includes(token)).length;
          return { result, score: matches * 10 + Number(result.importance || 0) };
        })
        .sort((a: any, b: any) => b.score - a.score)[0]?.result;
      if (ranked) {
        return {
          lat: Number(ranked.lat),
          lng: Number(ranked.lon),
          displayName: ranked.display_name || attempt,
        };
      }
    }
  }

  // Photon indexes many small OSM places that Nominatim may omit or rank
  // poorly. It is a fallback only, so Nominatim remains the primary source
  // and its public 1-request/second limit is respected.
  try {
    const photonQuery = attempts[0];
    const photon = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(photonQuery)}&limit=8&lang=en`);
    if (photon.ok) {
      const features = (await photon.json())?.features || [];
      const feature = features.find((item: any) => Number.isFinite(Number(item.geometry?.coordinates?.[1])));
      if (feature) {
        const [lng, lat] = feature.geometry.coordinates;
        const p = feature.properties || {};
        const displayName = [p.name, p.street, p.city || p.town || p.village, p.state, p.country]
          .filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(', ');
        return { lat: Number(lat), lng: Number(lng), displayName: displayName || trimmed };
      }
    }
  } catch {
    // Map pinning still works when the secondary geocoder is unavailable.
  }
  return null;
}

/**
 * The inverse of geocodeAddress — turns a map pin (lat/lng) back into a
 * human-readable address, so a customer who drops a pin on the map still
 * sees real text in the pickup/dropoff field instead of raw coordinates.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`;
  try {
    const res = await throttledFetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const result = await res.json();
    return result?.display_name || null;
  } catch {
    return null;
  }
}

export interface CountryLookup {
  name: string;
  iso2: string;
}

/**
 * Resolves just the country a pin sits in — used for cross-border
 * matching decisions. Always keyed off address.country_code (a stable
 * ISO2 code), never the localized address.country display string:
 * without &accept-language=en, Nominatim returns country names in the
 * local language (confirmed: DR Congo comes back as "République
 * démocratique du Congo" by default), which would silently break any
 * string-match against data/countries.ts's COUNTRIES list.
 */
export interface CitySuggestion {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
}

export interface AddressSuggestion {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
}

async function runCitySearch(trimmed: string, countryIso2: string | undefined, strict: boolean): Promise<CitySuggestion[]> {
  const params = new URLSearchParams({
    format: 'json',
    limit: '8',
    q: trimmed,
    addressdetails: '1',
    'accept-language': 'en',
  });
  // Nominatim's featureType=settlement bucket (city/town/village/hamlet)
  // covers most real places, but plenty of smaller or unusually-tagged
  // towns fall outside it and come back with zero results — not because
  // they don't exist, just because of how this one place happens to be
  // classified in OSM. Only used on the first, strict attempt.
  if (strict) params.set('featureType', 'settlement');
  if (countryIso2) params.set('countrycodes', countryIso2.toLowerCase());

  const res = await throttledFetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];

  const results = await res.json();
  return (results || []).map((r: any) => ({
    name: r.address?.city || r.address?.town || r.address?.village || r.name || r.display_name.split(',')[0],
    displayName: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon),
  }));
}

/**
 * Real city/town/village search worldwide — no country whitelist, works for
 * any of the ~195 real countries in data/countries.ts (or none at all, if
 * countryIso2 is omitted). Tries the tight settlement-only search first;
 * if that finds nothing, retries without the featureType filter so a
 * customer typing a real but loosely-tagged town still gets a result
 * instead of "no cities found."
 */
export async function searchCities(query: string, countryIso2?: string): Promise<CitySuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const strict = await runCitySearch(trimmed, countryIso2, true);
  if (strict.length > 0) return strict;
  return runCitySearch(trimmed, countryIso2, false);
}

/** Search live mapped places, buildings, roads and addresses in a country. */
export async function searchAddresses(query: string, countryIso2?: string, city?: string): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({
    format: 'json',
    limit: '15',
    q: [trimmed, city].filter(Boolean).join(', '),
    addressdetails: '1',
    namedetails: '1',
    'accept-language': 'en',
  });
  if (countryIso2) params.set('countrycodes', countryIso2.toLowerCase());

  let results: any[] = [];
  try {
    const res = await throttledFetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) results = await res.json();
  } catch {
    // Use the secondary live index below if Nominatim is unavailable.
  }

  // Photon is also based on live OpenStreetMap data and is useful for
  // autocomplete because it responds faster than the public Nominatim queue.
  if (!results.length) {
    try {
      const photonQuery = [trimmed, city, countryIso2?.toUpperCase() === 'UG' ? 'Uganda' : ''].filter(Boolean).join(', ');
      const photonRes = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(photonQuery)}&limit=15&lang=en`);
      if (photonRes.ok) {
        const features = (await photonRes.json())?.features || [];
        results = features
          .filter((feature: any) => Number.isFinite(Number(feature.geometry?.coordinates?.[1])))
          .filter((feature: any) => !countryIso2 || !feature.properties?.countrycode || feature.properties.countrycode.toUpperCase() === countryIso2.toUpperCase())
          .map((feature: any) => {
            const [lng, lat] = feature.geometry.coordinates;
            const p = feature.properties || {};
            const displayName = [p.name, p.street, p.city || p.town || p.village, p.state, p.country]
              .filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(', ');
            return { name: p.name || p.street || displayName.split(',')[0], display_name: displayName, lat, lon: lng };
          });
      }
    } catch {
      return [];
    }
  }

  const seen = new Set<string>();
  return results
    .filter((r: any) => Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lon)))
    .map((r: any) => ({
      name: r.name || r.namedetails?.name || r.address?.hotel || r.address?.amenity || r.address?.building || r.display_name.split(',')[0],
      displayName: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
    }))
    .filter((place: AddressSuggestion) => {
      const key = `${place.name.toLowerCase()}|${place.lat.toFixed(5)}|${place.lng.toFixed(5)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function reverseGeocodeCountry(lat: number, lng: number): Promise<CountryLookup | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=en`;
  try {
    const res = await throttledFetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const result = await res.json();
    const iso2 = result?.address?.country_code;
    if (!iso2) return null;
    return { name: result.address.country || iso2.toUpperCase(), iso2: iso2.toUpperCase() };
  } catch {
    return null;
  }
}
