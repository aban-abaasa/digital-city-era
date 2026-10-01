# Business local sync agent

This container is the local node's server-side transport worker. It polls the
local `business_local_sync_outbox`, uploads idempotent event envelopes to the
cloud node RPC, downloads pending events, stores them durably in
`business_local_sync_inbox`, and acknowledges those event IDs to the cloud.
This retryable delivery avoids losing a lower sequence ID that commits after
a higher one. The worker keeps its local Supabase service-role key and
one-time-provisioned node secret inside the server container environment.

The agent applies version-1 team-message events and supermarket catalog events
to local tables, and quarantines unsupported event types or schema versions.
It omits product cost from the LAN catalog. Catalog rows are read-only to LAN
clients; only the agent can change the replicated data.

The same container hosts a LAN-only local staff authentication endpoint behind
the app's Nginx proxy. It verifies locally stored PIN hashes and issues short-
lived JWTs signed with the local Supabase JWT secret. The installer creates a
one-use owner setup code; the owner can then add or disable local cashier and
manager accounts. Local staff accounts do not synchronize with cloud Auth.

## Local database setup

Apply `sql/local-sync-storage.sql` to the local Supabase database once the
business application schema exists. The agent needs the local self-hosted
Supabase `SERVICE_ROLE_KEY`, which must stay on the server.

## Pair the local node

From the local Supabase project directory, run the pairing helper with Node.js
22 or newer:

```sh
node /path/to/local-server/agent/src/claim-node.js .env.local-sync
```

Enter the cloud Supabase URL, public anon/publishable key, and the one-time
code created by the business owner. The helper claims the code once and writes
the node credential to `.env.local-sync`; keep that file on the server only.
If the claim succeeds but the response is lost before the file is written,
revoke that node from the owner setup page and create a fresh code.

The cloud pairing migration must already be applied before this command can
work. No cloud `service_role` key is used.

## Environment

The pairing helper writes the cloud URL, anon key, node ID, and node secret to
`.env.local-sync`. The local Supabase `SERVICE_ROLE_KEY` is read from the
upstream `.env` file and is never written into the pairing file.

## Start with the Supabase stack

Copy `docker-compose.override.yml` and the `agent/` directory into the
self-hosted Supabase project directory. From that directory run:

```sh
docker compose --env-file .env --env-file .env.local-sync \
  -f docker-compose.yml -f docker-compose.override.yml up -d --build
```

The agent has no published host port. It connects to Supabase through the
Compose network and calls the shared cloud project's PostgREST RPC endpoint
over HTTPS.
