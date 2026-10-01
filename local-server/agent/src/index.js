import './local-auth-server.js';

const requiredEnvironment = [
  'LOCAL_SUPABASE_URL',
  'LOCAL_SUPABASE_SERVICE_ROLE_KEY',
  'CLOUD_SUPABASE_URL',
  'CLOUD_SUPABASE_ANON_KEY',
  'BUSINESS_SYNC_NODE_ID',
  'BUSINESS_SYNC_NODE_SECRET',
  'BUSINESS_SYNC_BUSINESS_TYPE',
  'BUSINESS_SYNC_BUSINESS_ID',
];

for (const name of requiredEnvironment) {
  if (!process.env[name]) throw new Error(`Missing required environment value: ${name}`);
}

const localBaseUrl = process.env.LOCAL_SUPABASE_URL.replace(/\/$/, '');
const localKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;
const cloudBaseUrl = process.env.CLOUD_SUPABASE_URL.replace(/\/$/, '');
const cloudAnonKey = process.env.CLOUD_SUPABASE_ANON_KEY;
const nodeId = process.env.BUSINESS_SYNC_NODE_ID;
const nodeSecret = process.env.BUSINESS_SYNC_NODE_SECRET;
const businessType = process.env.BUSINESS_SYNC_BUSINESS_TYPE;
const businessId = process.env.BUSINESS_SYNC_BUSINESS_ID;
const pollMs = Math.max(5000, Number(process.env.BUSINESS_SYNC_POLL_MS) || 15000);
const batchSize = 100;
const requestTimeoutMs = 20000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (!['supermarket', 'business_profile'].includes(businessType)) {
  throw new Error('BUSINESS_SYNC_BUSINESS_TYPE must be supermarket or business_profile.');
}
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(businessId)) {
  throw new Error('BUSINESS_SYNC_BUSINESS_ID must be a UUID returned by the pairing service.');
}

let running = false;
let stopped = false;

async function request(baseUrl, key, path, { method = 'GET', body, prefer } = {}) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;

  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });

  if (!response.ok) {
    const message = (await response.text()).slice(0, 500);
    throw new Error(`Supabase request failed (${response.status}): ${message}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function rpc(functionName, parameters) {
  return request(cloudBaseUrl, cloudAnonKey, `rpc/${functionName}`, {
    method: 'POST',
    body: parameters,
  });
}

async function pushLocalEvents() {
  const query = new URLSearchParams({
    select: 'event_id,event_type,schema_version,payload,occurred_at,created_at',
    synced_at: 'is.null',
    order: 'created_at.asc',
    limit: String(batchSize),
  });
  const events = await request(
    localBaseUrl,
    localKey,
    `business_local_sync_outbox?${query.toString()}`
  );
  if (!events?.length) return 0;

  const result = await rpc('push_business_local_sync_events', {
    p_node_id: nodeId,
    p_node_secret: nodeSecret,
    p_events: events.map(({ event_id, event_type, schema_version, payload, occurred_at }) => ({
      event_id,
      event_type,
      schema_version,
      occurred_at,
      payload,
    })),
  });
  if (!result?.success) throw new Error(result?.error || 'Cloud rejected the local sync batch.');

  const applied = await rpc('apply_business_local_sync_events', {
    p_node_id: nodeId,
    p_node_secret: nodeSecret,
    p_event_ids: events.map(({ event_id }) => event_id),
  });
  if (!applied?.success) throw new Error(applied?.error || 'Cloud could not apply the local sync batch.');
  const cloudErrors = Array.isArray(applied.errors) ? applied.errors : [];
  if (cloudErrors.length) {
    console.warn(`[local-sync] cloud quarantined ${cloudErrors.length} outbound event(s):`, cloudErrors.slice(0, 5));
  }

  const acknowledgedIds = events.map((event) => event.event_id);
  const idFilter = `in.(${acknowledgedIds.join(',')})`;
  const ackError = cloudErrors.length
    ? `Cloud quarantined ${cloudErrors.length} event(s); review the local sync log.`
    : null;
  await request(
    localBaseUrl,
    localKey,
    `business_local_sync_outbox?event_id=${encodeURIComponent(idFilter)}`,
    {
      method: 'PATCH',
      body: { synced_at: new Date().toISOString(), last_error: ackError },
      prefer: 'return=minimal',
    }
  );
  return acknowledgedIds.length;
}

async function recordPullFailure(error) {
  const pending = await request(
    localBaseUrl,
    localKey,
    'business_local_sync_meta?key=eq.last_sync_error'
  );
  const message = String(error?.message || error).slice(0, 1000);
  const record = { key: 'last_sync_error', value: message, updated_at: new Date().toISOString() };
  if (pending?.length) {
    await request(
      localBaseUrl,
      localKey,
      'business_local_sync_meta?key=eq.last_sync_error',
      { method: 'PATCH', body: record, prefer: 'return=minimal' }
    );
  } else {
    await request(
      localBaseUrl,
      localKey,
      'business_local_sync_meta?on_conflict=key',
      { method: 'POST', body: record, prefer: 'resolution=merge-duplicates,return=minimal' }
    );
  }
}

async function pullCloudEvents() {
  const result = await rpc('pull_business_local_sync_events', {
    p_node_id: nodeId,
    p_node_secret: nodeSecret,
    // NULL selects protocol v3's retryable delivery mode. The cloud only
    // marks events delivered after their rows are durable in the local inbox.
    p_after_event_id: null,
    p_limit: batchSize,
  });
  if (!result?.success) throw new Error(result?.error || 'Cloud rejected the local server credentials.');

  const events = Array.isArray(result.events) ? result.events : [];
  if (events.length) {
    const rows = events.map((event) => ({
      cursor: event.cursor,
      event_id: event.event_id,
      event_type: event.event_type,
      schema_version: event.schema_version || 1,
      payload: event.payload,
      occurred_at: event.occurred_at || event.created_at,
      created_at: event.created_at,
      received_at: new Date().toISOString(),
    }));
    await request(
      localBaseUrl,
      localKey,
      'business_local_sync_inbox?on_conflict=event_id',
      { method: 'POST', body: rows, prefer: 'resolution=ignore-duplicates,return=minimal' }
    );

    const acknowledged = await rpc('ack_business_local_sync_events', {
      p_node_id: nodeId,
      p_node_secret: nodeSecret,
      p_event_ids: events.map((event) => event.event_id),
    });
    if (!acknowledged?.success) {
      throw new Error(acknowledged?.error || 'Cloud could not acknowledge the locally stored events.');
    }
  }

  await applyLocalInboxEvents();

  return events.length;
}

async function recordSyncSuccess() {
  const syncedAt = new Date().toISOString();
  await request(
    localBaseUrl,
    localKey,
    'business_local_sync_meta?on_conflict=key',
    {
      method: 'POST',
      body: [
        { key: 'last_successful_sync', value: syncedAt, updated_at: syncedAt },
        { key: 'last_sync_error', value: '', updated_at: syncedAt },
      ],
      prefer: 'resolution=merge-duplicates,return=minimal',
    }
  );
}

async function applyLocalCatalogEvent(event) {
  const payload = event.payload || {};
  const productId = String(payload.product_id || '');
  if (!UUID_PATTERN.test(productId)) throw new Error('Catalog event has an invalid product ID.');

  if (payload.operation === 'delete') {
    const productUpdatedAt = new Date(payload.product_updated_at || event.occurred_at).toISOString();
    const stockUpdatedAt = new Date(payload.stock_updated_at || event.occurred_at).toISOString();
    await request(
      localBaseUrl,
      localKey,
      'business_local_catalog?on_conflict=business_id,product_id',
      {
        method: 'POST',
        body: {
          business_id: businessId,
          product_id: productId,
          name: 'Deleted product',
          is_active: false,
          product_updated_at: productUpdatedAt,
          stock_updated_at: stockUpdatedAt,
        },
        prefer: 'resolution=merge-duplicates,return=minimal',
      }
    );
    return;
  }

  if (payload.operation !== 'upsert') throw new Error('Catalog event has an unsupported operation.');
  const name = String(payload.name || '').trim();
  const inventoryMode = String(payload.inventory_mode || 'stock_controlled');
  const validModes = new Set(['stock_controlled', 'listing_only', 'batch_controlled', 'service_item']);
  const numeric = (value, field) => {
    const number = Number(value ?? 0);
    if (!Number.isFinite(number) || Math.abs(number) > 1e12) {
      throw new Error(`Catalog event has an invalid ${field}.`);
    }
    return number;
  };
  const updatedAt = (value, field) => {
    const date = new Date(value || event.occurred_at);
    if (!Number.isFinite(date.getTime())) throw new Error(`Catalog event has an invalid ${field}.`);
    return date.toISOString();
  };

  if (!name || name.length > 255 || !validModes.has(inventoryMode)) {
    throw new Error('Catalog event has invalid product details.');
  }
  if (payload.category_id != null && !UUID_PATTERN.test(String(payload.category_id))) {
    throw new Error('Catalog event has an invalid category ID.');
  }

  const row = {
    business_id: businessId,
    product_id: productId,
    name,
    sku: payload.sku == null ? null : String(payload.sku).slice(0, 100),
    barcode: payload.barcode == null ? null : String(payload.barcode).slice(0, 100),
    price: numeric(payload.price, 'price'),
    selling_price: numeric(payload.selling_price, 'selling price'),
    tax_rate: numeric(payload.tax_rate, 'tax rate'),
    category_id: payload.category_id || null,
    inventory_mode: inventoryMode,
    is_active: payload.is_active !== false,
    current_stock: numeric(payload.current_stock, 'stock'),
    reserved_stock: numeric(payload.reserved_stock, 'reserved stock'),
    minimum_stock: numeric(payload.minimum_stock, 'minimum stock'),
    reorder_point: numeric(payload.reorder_point, 'reorder point'),
    product_updated_at: updatedAt(payload.product_updated_at, 'product timestamp'),
    stock_updated_at: updatedAt(payload.stock_updated_at, 'stock timestamp'),
  };

  await request(
    localBaseUrl,
    localKey,
    'business_local_catalog?on_conflict=business_id,product_id',
    {
      method: 'POST',
      body: row,
      prefer: 'resolution=merge-duplicates,return=minimal',
    }
  );
}

async function applyLocalInboxEvents() {
  const query = new URLSearchParams({
    select: 'cursor,event_id,event_type,schema_version,occurred_at,payload',
    applied_at: 'is.null',
    order: 'cursor.asc',
    limit: String(batchSize),
  });
  const pending = await request(
    localBaseUrl,
    localKey,
    `business_local_sync_inbox?${query.toString()}`
  );
  if (!pending?.length) return 0;

  let appliedCount = 0;
  for (const event of pending) {
    let lastError = null;
    if (event.event_type === 'team.message.v1' && Number(event.schema_version) === 1) {
      const payload = event.payload || {};
      const role = String(payload.sender_role || '');
      const name = String(payload.sender_name || '').trim();
      const body = String(payload.body || '').trim();
      if (!/^[a-z][a-z0-9_-]{1,31}$/.test(role) || !name || name.length > 120 || !body || body.length > 4000) {
        lastError = 'Team message payload failed local validation.';
      } else {
        await request(
          localBaseUrl,
          localKey,
          'business_local_team_messages?on_conflict=id',
          {
            method: 'POST',
            body: {
              id: event.event_id,
              business_type: businessType,
              business_id: businessId,
              sender_role: role,
              sender_name: name,
              body,
              created_at: payload.created_at || event.occurred_at || event.created_at,
            },
            prefer: 'resolution=ignore-duplicates,return=minimal',
          }
        );
        appliedCount += 1;
      }
    } else if (event.event_type === 'catalog.product.v1' && Number(event.schema_version) === 1) {
      try {
        await applyLocalCatalogEvent(event);
        appliedCount += 1;
      } catch (error) {
        lastError = String(error?.message || error).slice(0, 500);
      }
    } else {
      lastError = Number(event.schema_version) !== 1
        ? `Unsupported schema version ${String(event.schema_version)} for ${String(event.event_type).slice(0, 64)}`
        : `Unsupported sync event type: ${String(event.event_type).slice(0, 64)}`;
    }

    await request(
      localBaseUrl,
      localKey,
      `business_local_sync_inbox?cursor=eq.${encodeURIComponent(event.cursor)}`,
      {
        method: 'PATCH',
        body: { applied_at: new Date().toISOString(), last_error: lastError },
        prefer: 'return=minimal',
      }
    );
    if (lastError) console.warn(`[local-sync] quarantined event ${event.event_id}: ${lastError}`);
  }

  return appliedCount;
}

async function syncOnce() {
  if (running || stopped) return;
  running = true;
  try {
    const [pushed, pulled] = await Promise.all([pushLocalEvents(), pullCloudEvents()]);
    await recordSyncSuccess();
    if (pushed || pulled) console.info(`[local-sync] accepted ${pushed} outbound and received ${pulled} inbound events`);
  } catch (error) {
    console.warn('[local-sync] sync attempt failed; queued events will retry:', error.message);
    try {
      await recordPullFailure(error);
    } catch (statusError) {
      console.warn('[local-sync] could not persist sync status:', statusError.message);
    }
  } finally {
    running = false;
  }
}

const timer = setInterval(syncOnce, pollMs);
timer.unref?.();
syncOnce();

function stop(signal) {
  if (stopped) return;
  stopped = true;
  clearInterval(timer);
  console.info(`[local-sync] stopping after ${signal}`);
  process.exitCode = 0;
}

process.once('SIGTERM', () => stop('SIGTERM'));
process.once('SIGINT', () => stop('SIGINT'));
