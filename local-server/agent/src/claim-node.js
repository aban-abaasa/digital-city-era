import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';

const prompt = createInterface({ input: stdin, output: stdout });
const outputPath = resolve(process.argv[2] || '.env.local-sync');

try {
  const cloudUrlInput = await prompt.question('Cloud Supabase URL: ');
  const cloudAnonKey = (await prompt.question('Cloud Supabase anon/publishable key: ')).trim();
  const pairingToken = (await prompt.question('One-time pairing code: ')).trim().toLowerCase();

  const cloudUrl = new URL(cloudUrlInput.trim());
  if (!['https:', 'http:'].includes(cloudUrl.protocol)) {
    throw new Error('Cloud URL must use HTTP or HTTPS.');
  }
  if (cloudUrl.pathname !== '/' || cloudUrl.search || cloudUrl.hash) {
    throw new Error('Cloud URL must be the Supabase project URL without a path or query string.');
  }
  if (!cloudAnonKey || /[\r\n]/.test(cloudAnonKey)) {
    throw new Error('Cloud anon/publishable key is missing or malformed.');
  }
  if (!/^[a-f0-9]{64}$/i.test(pairingToken)) {
    throw new Error('Pairing code must be the 64-character code from the owner setup page.');
  }

  // Check the app workflow migration before consuming the one-use pairing
  // token. The expected response is an explicit invalid-node error from the
  // newly added RPC, which proves the cloud schema is present.
  const schemaCheck = await fetch(`${cloudUrl.toString().replace(/\/$/, '')}/rest/v1/rpc/apply_business_local_sync_events`, {
    method: 'POST',
    headers: {
      apikey: cloudAnonKey,
      Authorization: `Bearer ${cloudAnonKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      p_node_id: '00000000-0000-0000-0000-000000000000',
      p_node_secret: '',
      p_event_ids: [],
    }),
    signal: AbortSignal.timeout(20000),
  });
  const schemaResult = await schemaCheck.json().catch(() => null);
  if (!schemaCheck.ok || schemaResult?.success !== false
      || !String(schemaResult?.error || '').includes('credentials are invalid')) {
    throw new Error('Apply the business-local sync control-plane and team-message migrations to cloud Supabase before pairing. The one-time code has not been used.');
  }

  const protocolCheck = await fetch(`${cloudUrl.toString().replace(/\/$/, '')}/rest/v1/rpc/business_local_sync_protocol_info`, {
    method: 'POST',
    headers: {
      apikey: cloudAnonKey,
      Authorization: `Bearer ${cloudAnonKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: '{}',
    signal: AbortSignal.timeout(20000),
  });
  const protocolInfo = await protocolCheck.json().catch(() => null);
  if (!protocolCheck.ok || protocolInfo?.success !== true
      || Number(protocolInfo.protocolVersion) < 3
      || Number(protocolInfo.teamHistoryBootstrapVersion) < 1
      || Number(protocolInfo.catalogBootstrapVersion) < 1) {
    throw new Error('Run the latest four business-local migrations in cloud Supabase before pairing. The one-time code has not been used.');
  }

  const response = await fetch(`${cloudUrl.toString().replace(/\/$/, '')}/rest/v1/rpc/claim_business_local_sync_pairing`, {
    method: 'POST',
    headers: {
      apikey: cloudAnonKey,
      Authorization: `Bearer ${cloudAnonKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ p_pairing_token: pairingToken }),
    signal: AbortSignal.timeout(20000),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.error || `Cloud pairing failed (${response.status}).`);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.nodeId || '')
      || !/^[a-f0-9]{64}$/i.test(result.nodeSecret || '')
      || !['supermarket', 'business_profile'].includes(result.businessType)
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.businessId || '')) {
    throw new Error('Cloud returned incomplete node credentials; create a new pairing code and retry.');
  }

  const envFile = [
    `CLOUD_SUPABASE_URL=${cloudUrl.toString().replace(/\/$/, '')}`,
    `CLOUD_SUPABASE_ANON_KEY=${cloudAnonKey}`,
    `BUSINESS_SYNC_NODE_ID=${result.nodeId}`,
    `BUSINESS_SYNC_NODE_SECRET=${result.nodeSecret}`,
    `BUSINESS_SYNC_BUSINESS_TYPE=${result.businessType}`,
    `BUSINESS_SYNC_BUSINESS_ID=${result.businessId}`,
    '',
  ].join('\n');

  // Exclusive creation avoids silently replacing an existing node credential.
  // On POSIX hosts, restrict the new file to its owner. Windows uses the
  // directory's inherited ACL; install this under an account-only data folder.
  const handle = await open(outputPath, 'wx', 0o600);
  try {
    await handle.writeFile(envFile, { encoding: 'utf8' });
  } finally {
    await handle.close();
  }

  console.info(`Paired node ${result.nodeId}. Credentials saved to ${outputPath}.`);
  console.info('Keep this file on the local server only; do not send it to staff devices.');
} catch (error) {
  console.error(error.message || 'Could not pair this local server.');
  process.exitCode = 1;
} finally {
  prompt.close();
}
