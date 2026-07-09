# IceQueue 🧊

A small internal tool so office staff can check the ice machine's status and
queue for a batch without walking over to check it in person.

Implements the workflow from the IceQueue URD: a 🟢/🟡/🔴 status dashboard,
crowdsourced "es habis" reporting, a join-queue / call-next / auto-skip
queueing system with a grace period, and pluggable notifications.

## Tech stack

The URD's "Opsi B" (full-code) stack, adapted to run standalone with zero
external cloud accounts:

- **Next.js (App Router) + TypeScript + Tailwind** for the frontend and API routes.
- **SQLite via Prisma 7**, using the `@prisma/adapter-libsql` driver adapter
  (Prisma 7 requires an explicit driver adapter — there's no more implicit
  "read `DATABASE_URL`" client). Locally this is just a plain file
  (`file:./dev.db`, no external account needed); in production it points at
  a free [Turso](https://turso.tech) database instead, since serverless
  hosts like Vercel have no persistent local disk. Same schema, same code
  path, either way — see "Deploying" below.
- **Polling instead of websockets**: the dashboard polls `GET /api/status`
  every 4s. With a handful of concurrent users this is simpler and more
  robust than wiring up Firebase Realtime DB / a socket server, at the cost
  of up to ~4s of staleness (acceptable for "is the ice ready" — well under
  the 3-minute grace period).
- **Notifications**: `src/lib/notify.ts` logs to the server console and,
  if `SLACK_WEBHOOK_URL` is set, also posts there. Swap in a real
  WhatsApp/Slack bot API by editing that one file — every call site just
  calls `notifyUser(name, message)`.

## Data model

`prisma/schema.prisma` mirrors the URD's schema: `User`, `QueueEntry`
(`waiting` → `called` → `completed`/`skipped`), and a singleton
`MachineStatus` row (`available` / `processing` / `empty`, with
`estimatedReadyAt` for the countdown).

## How the state machine works

All the time-based transitions in the URD (batch timer elapsing, the
3-minute grace period expiring) are implemented as a single idempotent
`tick()` function (`src/lib/queue-engine.ts`) that runs at the start of
every read and write:

1. If the machine is `processing` and `estimatedReadyAt` has passed, flip
   to `available`.
2. Any `called` queue entry older than the 3-minute grace period is marked
   `skipped`.
3. If the machine is `available` and nobody is currently `called`, the
   earliest `waiting` entry is called and notified.

Because every request re-runs `tick()`, the app stays correct even with no
dashboard open — but there's also an optional `POST /api/cron/tick` route
you can hit from an external scheduler (e.g. a 1-minute cron ping) if you
want auto-skip/auto-available to fire exactly on time rather than on the
next visit.

### A deliberate deviation from the literal spec text

The URD's "Laporkan Es Habis" button description says it sets the status to
🔴 *and* starts a 15-minute countdown — but the dashboard section assigns
countdowns to 🟡 ("Menipis / Sedang Proses"), not 🔴. Since a state with an
active countdown is exactly what "processing" means, reporting empty sets
`currentStatus = 'processing'` (not `'empty'`) with the estimate attached.
`'empty'` stays in the schema for a machine with no known ETA at all; the
UI handles it (plain red, no countdown) if it's ever set directly.

## Running it

```bash
npm install
cp .env.example .env
npx prisma migrate deploy   # creates dev.db and applies migrations
npm run dev
```

Open http://localhost:3000, enter your name (stored in `localStorage`,
no real auth — this is an internal single-office tool), and use the
dashboard.

### Environment variables (`.env`)

- `DATABASE_URL` — `file:./dev.db` locally; a `libsql://...` URL in production.
- `TURSO_AUTH_TOKEN` — only needed in production, when `DATABASE_URL` points
  at Turso.
- `SLACK_WEBHOOK_URL` (optional) — an incoming webhook URL to also post
  queue-call notifications to Slack.

### Useful commands

- `npm run build` / `npm run start` — production build.
- `npx prisma studio` — browse/edit the SQLite data in a GUI.
- `npx prisma migrate dev --name <name>` — after changing `schema.prisma`.

## Deploying (free): Vercel + Turso

**Vercel's own GitHub integration does the deploying** — no custom Actions
deploy workflow, no Vercel API tokens to manage. You connect the repo once
and every push to `main` redeploys automatically.

Migrations are the one part that isn't automatic: Prisma's `migrate`
command only understands local `file:` SQLite connections, not a remote
`libsql://` URL — the driver adapter in `src/lib/db.ts` only covers the
app's normal queries at runtime, not the separate migration engine. So the
schema has to be applied to the Turso database once, directly, with plain
SQL (see step 1 below) — after that, the deployed app just connects and
queries it normally, which works fine.

**One-time setup (you'll need to do this part — it requires your own
accounts):**

1. **Create a free Turso database** and apply the schema to it:
   - Sign up at [turso.tech](https://turso.tech) and create a database
     (call it `icequeue`).
   - Find its **connection URL** (`libsql://icequeue-<org>.turso.io`) and
     create an **auth token** — both from the database's page in the
     dashboard.
   - Open the database's SQL console / "Studio" tab in the dashboard, and
     run the contents of
     [`prisma/migrations/20260709131516_init/migration.sql`](prisma/migrations/20260709131516_init/migration.sql)
     against it (paste the whole file, or run each `CREATE TABLE`/
     `CREATE INDEX` statement one at a time if the console only accepts one
     statement at once). This creates the `User`, `QueueEntry`, and
     `MachineStatus` tables the app expects.
2. **Import this GitHub repo into Vercel:** [vercel.com/new](https://vercel.com/new)
   → pick `seanalessandro/ss-ice-queue` → it auto-detects Next.js, no config
   needed.
3. **Add environment variables** in the Vercel project's Settings →
   Environment Variables:
   - `DATABASE_URL` = `libsql://icequeue-<org>.turso.io` (from step 1)
   - `TURSO_AUTH_TOKEN` = the token from step 1
   - `SLACK_WEBHOOK_URL` (optional)
4. **Deploy** — click Deploy in Vercel, or just push to `main`. From then
   on, every push to `main` redeploys automatically, and every PR gets its
   own preview URL (against the same Turso database, so be mindful that
   preview deploys share data with production unless you create a second
   Turso database for previews).

**If you change `prisma/schema.prisma` later:** run
`npx prisma migrate dev --name <name>` locally (against your local
`file:./dev.db`) to generate the new migration file, commit it, and then
run that new migration's SQL against the Turso database the same way as
step 1 above (dashboard SQL console, or `turso db shell icequeue <
prisma/migrations/<new>/migration.sql` if you have the CLI). The app
itself doesn't need to run migrations — it only needs the tables to
already match `schema.prisma`.

### CI

`.github/workflows/ci.yml` runs lint, typecheck, and a production build on
every push and pull request — independent of the Vercel deploy above, and
needs no secrets, so it works immediately with no setup.

### Alternative: skip Turso entirely

If you'd rather not touch the DB layer, any host that gives you a real,
always-on Linux box with a persistent disk (e.g. Oracle Cloud's Always
Free tier) can run this app exactly as committed — `git clone`, `npm ci`,
`npx prisma migrate deploy`, `npm run build && npm run start` behind a
reverse proxy — with the local `file:./dev.db` unchanged. The tradeoff is
you manage the box yourself instead of getting Vercel's push-to-deploy.

## API routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/status` | GET | Current machine status + live queue (runs `tick()` first) |
| `/api/status/report-empty` | POST `{ name, minutes? }` | "Laporkan Es Habis" — starts a new brew estimate (default 15 min) |
| `/api/status/mark-available` | POST `{ name }` | Manual override for "es sudah jadi" |
| `/api/queue/join` | POST `{ name }` | "Ikut Antrean" |
| `/api/queue/leave` | POST `{ name }` | Cancel your own queue entry |
| `/api/queue/complete` | POST `{ name }` | "Selesai Ambil" — completes your turn and calls the next person |
| `/api/cron/tick` | POST | Optional external-scheduler hook, see above |

## Not implemented (out of scope for this MVP)

- Real Slack/WhatsApp account linking (`User.contact`) — the field exists in
  the schema but nothing populates or reads it yet; `notifyUser` currently
  only reaches Slack via a single shared webhook.
- Any authentication — anyone can type any name. Fine for a low-stakes
  office tool; would need real auth before wider deployment.
