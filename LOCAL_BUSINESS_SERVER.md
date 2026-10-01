# Optional local server for a business

## Goal

Let a business opt into a server on its own premises. Staff devices on that
business's Wi-Fi/LAN can keep using supported business features when the
internet connection is down. When the connection returns, the local server
syncs with the shared cloud Supabase project used by the applications.

The feature is optional. Businesses without a local server continue using the
hosted applications and shared cloud Supabase as they do today.

Each business server must contain only that business's data. The shared cloud
project remains the cross-business source of truth and the local server is an
offline operating node, not a separate cloud account or an unrestricted copy
of the shared database.

## Device and server platform support

Treat server hosting and staff-device support as separate things:

- **Server host:** provide a guided setup for a Windows PC with Docker Desktop,
  a Mac with Docker Desktop, or a Linux server/desktop with Docker. Supabase's
  one-command `setup.sh` is Linux-only; Windows and macOS need the manual
  Docker Compose setup in the official self-hosting guide. Start with these
  three host platforms, and list any additional Docker-compatible host only
  after it is supported and maintained by the installer.
- **Staff clients:** Windows, macOS, Linux, iPhone/iPad, and Android devices
  connect to the business server over its Wi-Fi/LAN using the app in a
  supported browser or installed PWA. They do not install or run Supabase.
- **Phone/tablet as server:** do not promise that Android or iPhone/iPad can
  host the Supabase stack. Keep mobile devices as clients; use a PC or server
  on the business network for the local node.
- **Offline requirement:** a device must have opened/installed the LAN app
  while connected to that business network. The LAN app and API need a
  secure-origin plan so browser storage, authentication, and PWA behavior work
  across devices.

Supabase documents Docker-based self-hosting for Linux, macOS, and Windows,
but its automated `setup.sh` supports Linux only. It also calls out a macOS
Docker Desktop bind-mount limitation that can affect Storage; the business
deployment must use the documented named-volume workaround or verify its
Storage configuration before promising file uploads. See the official
[self-hosting platform and storage guidance](https://supabase.com/docs/guides/self-hosting/docker).

## Current state in this repository

- The main Supabase clients in Digital City Era, ICAN, and mybodaguy can use a
  deployment-specific public `/runtime-config.js` (`supabaseUrl`,
  `supabaseAnonKey`), with their existing Vite build-time settings as fallback.
  ICAN's MOMO function URL uses the same override. Runtime config must contain
  only public client settings, never a `service_role` key.
- Digital City Era's POS uses the shared Supabase client when runtime settings
  are provided. Its legacy cloud client remains as the cloud-only fallback.
- Business settings link to `/business-local-server` from the profile,
  supermarket admin, manager, cashier, supplier, POS, and ICAN wallet screens.
  The shared account menu also exposes the same setup page across app portals,
  including the BodaGo dashboard. That owner-facing page creates one-use,
  ten-minute pairing codes, lists paired nodes, and revokes nodes. Apply
  `backend/database/migrations/ADD_BUSINESS_LOCAL_SYNC_CONTROL_PLANE.sql`,
  `backend/database/migrations/ADD_BUSINESS_LOCAL_TEAM_MESSAGE_SYNC.sql`, and
  `backend/database/migrations/ADD_BUSINESS_LOCAL_SYNC_PROTOCOL_V2.sql`,
  then `backend/database/migrations/ADD_BUSINESS_LOCAL_CATALOG_SYNC.sql` to the
  cloud project before pairing a server. The shared cloud project must already
  have the Digital City Era `public.products` and `public.inventory` tables;
  these sync migrations do not install the full app schema.
- `local-server/agent` transports typed team-message and supermarket-catalog
  events, writes incoming rows to local tables, and quarantines event types it
  does not understand. Pairing seeds existing team history and catalog data;
  reapplying the latest migration also backfills active nodes paired earlier.
- `local-server/installers/install.js` and
  `frontend/public/downloads/business-local-server-installer.zip` provide a
  cross-platform installer preview. It packages the app shell, pins the
  upstream Supabase Docker release, creates local keys, claims the owner
  pairing code, binds app/API ports to one LAN IPv4 interface, blocks host
  ports for Postgres, Supavisor, and Studio, and starts the transport worker.
- `local-server/agent/src/claim-node.js` can also be run by itself to claim an
  owner-generated pairing code and write the node credential to a server-side
  `.env.local-sync` file.
- Sync envelopes carry a schema version, stable event ID, registered source
  node, and original `occurred_at`; cloud `created_at` remains the receipt time.
  Protocol v3 acknowledges cloud events only after they are durable in the
  local inbox. Pairing checks the team-history and catalog bootstrap versions
  before it consumes a one-time pairing code.
- The cloud migrations have not been applied to the shared Supabase project.
  The new workflow stays inactive in the hosted app until all four are applied.
- The installer serves the app shell and team channel on the LAN. Supermarket
  nodes also hold a read-only mirror of product names, prices, and stock; cloud
  catalog changes flow to paired nodes. Local owner and staff PIN sign-in with
  owner-managed cashier/manager accounts is available. The local database
  checks staff identity when sending team messages and stamps the saved staff
  name and role. Cash sales, local stock movements, other app schemas, TLS,
  backup, and update/rollback remain to be built.
- Digital City Era's cashier PWA caches the app and a business's product
  catalog/profile on each device, and queues cash sales in IndexedDB. It sends
  queued sales directly to the configured Supabase endpoint when reachable.
- The cashier browser queue is device-specific and does not provide a shared
  till or stock ledger on the LAN. The local server now supplies the current
  read-only catalog and stock mirror, but it does not yet record shared local
  sales or stock movements.
- Other features call Supabase directly. They do not automatically use the
  cashier queue, and payment/authentication flows that require a live service
  remain online-dependent.

The repository has a downloadable **business-server preview**. Team chat works
over the LAN and syncs after reconnection; supermarket catalog and stock data
bootstrap to the node and receive cloud updates. It is not a complete offline
business system: cash sales, stock movements, full app schemas, TLS, backup,
and update/rollback are still missing. Local PIN sign-in is available for app
access, but does not yet enable shared till transactions.

## What the Supabase installer does

Supabase documents `curl -fsSL https://supabase.link/setup.sh | sh` as a
Linux self-hosting quick start. On supported Debian/Ubuntu and
RHEL/CentOS/Fedora systems, it can install prerequisites and Docker Engine,
fetch the Supabase Docker configuration, generate secrets, prompt for URLs,
and pull the container images. The resulting Supabase stack is a database/API
installation. It does not provision this application's business account,
install this application's frontend, filter the shared cloud data to one
business, or establish cloud synchronization.

Supabase's setup script targets Linux; manual Docker Compose setup is needed
for Windows and macOS hosts. Mobile devices connect as LAN clients rather than
hosting the stack. Supabase documents those supported host environments in its
[self-hosting Docker guide](https://supabase.com/docs/guides/self-hosting/docker).

The setup script needs internet access while it downloads code and container
images. After setup, local devices can reach the server over the business LAN
without an internet connection. Updates and disaster recovery still need a
planned internet/maintenance path.

Official references:

- [Supabase self-hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)
- [Supabase self-hosting overview](https://supabase.com/docs/guides/self-hosting)

## Intended business setup experience

1. A business owner opens **Offline server settings** from their business
   settings (or profile) while online from a supported desktop browser
   (`/business-local-server`).
2. The cloud checks that the owner can administer the selected business, then
   issues a short-lived, single-use pairing code. No cloud service-role key is
   given to the business.
3. The operator downloads and runs the business-server preview package on a
   Windows, macOS, or Linux host with Node.js, Git, Docker, and recent Docker
   Compose. Windows also requires Git Bash. The installer pins Supabase
   `self-hosted/v0.8.1`, generates local secrets, and binds its API gateway to
   a reserved business-LAN IPv4 address.
4. The installer claims the pairing code, enrolls one node for that business,
   and stores its credential in `.env.local-sync` on the server. It also
   removes host-published Postgres/Supavisor ports and persists Storage in a
   named Docker volume.
5. The installer serves the built app shell and configures the business-scoped
   text team channel, creates a one-use owner setup code, and installs local
   staff sign-in with owner-managed cashier/manager accounts. It does not load
   the full app schema or sales data.
6. Staff devices open `http://<reserved-lan-ip>:8080` on the same LAN. The
   owner uses the setup code once, creates local staff PIN accounts, then each
   worker signs in locally. The local database validates staff identity for
   team-message writes and stamps their saved name and role.
7. When internet returns, the agent pushes and applies `team.message.v1`
   events. The team widget reports pending outbound items, last successful
   sync, and whether the agent reports an error. Unsupported types are
   quarantined; sales/inventory sync and operator resolution still need work.

The generated server must have a supported local HTTPS/address strategy for
the app origin, Supabase API, and authentication redirects. A service worker
does not make an internet-hosted app available to new LAN devices during an
outage; the frontend itself must be served on the LAN and installed/cached
before it is needed offline.

## Sync contract required before rollout

Do not copy or logically replicate the entire shared database into each
business node. Build an explicit business-scoped sync protocol:

- Enroll a node with a stable node ID, business ID, schema version, and
  revocable credentials. Never put Supabase `service_role` secrets in a
  browser, installer output, or downloadable app bundle.
- Bootstrap only rows authorized for that business. Enforce the business
  boundary on the server; do not trust a business ID supplied by the client.
- Give every offline-created operation a stable UUID/idempotency key and
  record its origin node and original event time. Retrying after an
  acknowledgment is lost must not create duplicate sales, messages, payments,
  or stock movements.
- Use append-only events for sales, team messages, and stock movements where
  possible. Resolve inventory from movements and reconciliation rules rather
  than silently overwriting a newer stock count.
- Define cloud-to-node and node-to-cloud rules per table. For example, shared
  catalog/configuration changes can flow cloud-to-node; locally recorded
  sales/messages can flow node-to-cloud. Mutable records need explicit
  version/conflict behavior; last-write-wins is not safe for money or stock.
- Keep a durable outbound queue, retry with backoff, record acknowledgments,
  surface permanent failures, and provide an operator-visible sync log.
- Review and revoke local staff access deliberately. Cloud Supabase Auth and
  the separate local PIN service do not share users, passwords, or sessions.
- Back up and restore the local database and uploaded files. Verify that
  restoring a node does not replay already-acknowledged operations twice.

## Build sequence

1. Inventory every app's business-owned tables and write a data ownership and
   authority matrix. Include ICAN and mybodaguy integrations that share the
   cloud Supabase project; do not assume every table belongs to the store.
2. Add node enrollment, business-scoped bootstrap, revocation, and the
   idempotent event/outbox protocol in the cloud backend.
3. Add the local node agent and versioned migrations. Team messaging,
   cloud-to-node supermarket catalog updates, and local PIN accounts are
   implemented in preview. Next add shared local cash sales and stock
   movements with explicit idempotency and conflict handling.
4. Finish converting all frontend Supabase client creation to a single
   validated runtime config supplied by the LAN deployment. The primary
   shared client and POS local-mode branch use runtime settings; other direct
   Supabase client constructors still need an app-wide audit. Serve the local
   app and API through a supported secure origin.
5. Expand the cross-platform business-server preview into a production
   installer: add the versioned app schema, HTTPS/certificate enrollment,
   backup/restore, and update/rollback. The current
   package pins Supabase, includes the app shell, creates unique local keys,
   binds the app/API to one LAN address, and blocks database/Studio host ports.
6. Verify one-business isolation, offline LAN operation, cloud reconnection,
   duplicate retries, concurrent stock changes, auth expiry, update/rollback,
   backup/restore, and node revocation before offering the download broadly.

## Current supported behavior vs. target

| Capability | Current repository | Target local server |
| --- | --- | --- |
| Cashier cash sale during outage | Queued on that browser/device | Accepted by the LAN node and synced once |
| POS catalog during outage | Cached on that browser/device | Read-only catalog and current stock mirrored to the supermarket node; local stock updates are not enabled |
| Team messages during outage | Text-only LAN preview with cloud sync | Authenticated team messaging over a secure LAN |
| Other business tables/features | Mostly direct cloud Supabase calls | Enabled only after a table-specific sync path exists |
| Per-business Supabase download | App-shell/server preview with local PIN accounts; full app schema and sales workflows are absent | Guided node enrollment/install with app bootstrap |
| Cloud/local database sync | Business-scoped team text events after both cloud migrations are applied | Sync for sales, inventory, messages, and other workflows |
