# Local business server installer preview

This package installs a local copy of the Digital City Era app shell, a
business-specific self-hosted Supabase stack, a team text-chat workflow, a
read-only catalog mirror for supermarket nodes, and the cloud pairing/sync
worker. The stack is pinned to Supabase's
`self-hosted/v0.8.1` Docker release. Android, iPhone/iPad, Windows, macOS, and
Linux devices use a web browser to connect to the LAN app; only Windows/macOS/Linux
computers host the Docker stack. The HTTP preview is not a native phone package
or an installable PWA.

**This is preview software.** Team text messages queue on the local server and
sync to the cloud when internet returns. Supermarket nodes also receive current
product names, selling prices, and stock, plus cloud product/stock updates.
That mirror is read-only: local cash sales, stock movements, ICAN, BodaGoEra,
attachments, and the rest of the business database are not enabled offline.
Local owner/cashier/manager PIN accounts are installed. The local database
validates staff for team-message writes and supplies the saved sender name and
role. Cash sales and stock movements are not enabled.

## Requirements

- Windows 10/11 with Docker Desktop in Linux-container mode and Git for Windows
  (Git Bash must be available as `bash`), or macOS with Docker Desktop, or a
  Linux host with Docker Engine and Compose.
- Node.js 20 or newer, Git, a running Docker engine, and Docker Compose 2.24.4
  or newer.
- At least 4 GB RAM, 2 CPU cores, and 40 GB free disk space.
- Internet during initial setup to download the pinned Supabase files and
  container images.
- A fixed/reserved IPv4 address for the server on the business LAN.
- All four cloud migrations applied to the shared Supabase project in order:
  `backend/database/migrations/ADD_BUSINESS_LOCAL_SYNC_CONTROL_PLANE.sql`,
  `backend/database/migrations/ADD_BUSINESS_LOCAL_TEAM_MESSAGE_SYNC.sql`, and
  `backend/database/migrations/ADD_BUSINESS_LOCAL_SYNC_PROTOCOL_V2.sql`, and
  `backend/database/migrations/ADD_BUSINESS_LOCAL_CATALOG_SYNC.sql`.
- The shared cloud project already has the Digital City Era `public.products`
  and `public.inventory` tables. These setup migrations add the sync layer,
  not the full business application schema.

## Install

1. While signed in as the business owner, open **Offline server settings** in
   the business app (also available from Profile) and create a one-time pairing
   code.
2. Download and extract this package on the server computer. It includes the
   built app shell, so the build/package process must be run again after app
   updates.
3. On Windows, use File Explorer's **Extract All** on the downloaded ZIP, then
   double-click `local-server/installers/install-windows.cmd` inside the
   extracted folder. Do not run the launcher from the ZIP preview: it needs the
   neighboring installer files. The launcher starts Node.js and keeps the
   window open so you can read setup errors. Do not double-click `install.js`;
   Windows Script Host cannot run Node.js files. You can also open Git Bash in
   the extracted package directory and run the command below. On macOS or
   Linux, use a terminal there and run:

   ```sh
   node local-server/installers/install.js
   ```

4. Enter a new installation folder, the server's reserved LAN IPv4 address,
   and type `YES` after reviewing the preview limitations. The installer asks
   for the cloud Supabase project URL, public anon/publishable key, and the
   one-time pairing code. It checks for cloud protocol v3, team-history
   bootstrap, and supermarket-catalog support before consuming the code.

The installer generates unique local keys, creates a one-time local owner setup
code, installs local staff PIN sign-in and owner-managed cashier/manager
accounts, keeps the local app and API gateway bound to the selected LAN
interface, removes Supavisor and Studio host ports,
uses a persistent Docker volume for Storage, installs the local message/outbox
tables, and starts the local stack, app shell, and transport agent. The generated
`.env` and `.env.local-sync` files contain private server credentials; keep
them on the server computer and restrict the Windows account or POSIX file
permissions that can read them.

Do not forward ports 8000 or 8080 from the business router to the public
internet. Keep the machine and Wi-Fi on a trusted business LAN. The preview
uses HTTP, and any LAN device can read/write its local team messages.

## After installation

The local app is at `http://<reserved-lan-ip>:8080`; the local Supabase API is
at `http://<reserved-lan-ip>:8000`. The local node is registered to one
business in cloud control-plane metadata. Team messages are written to the
local database while offline, pushed to the cloud when it is reachable, and
pulled back to other paired nodes. Pairing queues existing team-message
history and a supermarket's current catalog; cloud product and stock changes
continue syncing while the node is paired. Protocol v3 acknowledges an event
only after the local inbox stores it. Unsupported event types are quarantined
in the local inbox. Sales and local stock deductions are not implemented.

To stop the stack, run from the chosen installation folder:

```sh
docker compose --env-file .env --env-file .env.local-sync \
  -f docker-compose.yml -f docker-compose.local-business.yml down
```

This command stops containers but keeps the database and Storage data. Do not
use `down -v` unless you intend to delete them. Automated backup, restore,
updates, rollback, TLS certificates, shared cash sales, stock movements, and
the rest of the business app schema/workflows still need to be added before
production use. Local staff PINs currently control app access only.

To rebuild the downloadable package from the repository, build the frontend
from `frontend` with `npm run build`, then run `local-server/package-preview.ps1`
from PowerShell. The owner page links to the resulting ZIP.
