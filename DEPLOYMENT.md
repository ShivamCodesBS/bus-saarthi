# Bus Saarthi — Deployment & Operations Guide

> **This file contains no secrets.** Every credential below is a
> placeholder. The real values live in Render's environment settings, in
> the Vercel project's environment variables, and in the local `.env` file
> (which is gitignored). Do not paste a real key into this document —
> it is committed to GitHub.

## 1. Where each piece runs

| Piece | Where | URL / Notes |
|---|---|---|
| Backend API | Render (Docker) | `https://bus-saarthi-j3lq.onrender.com` |
| Student / Parent / Admin web app | Vercel | `https://bus-saarthi-inky.vercel.app` |
| Tech-admin portal (internal) | Vercel / local | Your ops console — system metrics and logs |
| Database | Supabase PostgreSQL | `aws-0-ap-northeast-1.pooler.supabase.com:5432` |
| Media uploads | Cloudinary | cloud name `dddm66gd7` — the API key and secret live in the environment |
| Bus sensor app | Flutter APK | Installed on the device fixed in the bus |
| Redis | *Not deployed yet* | Optional — see §6 |

## 2. Environment variables

Only three are **required** in production. The service starts without any
others and degrades gracefully.

```bash
# ── Required ───────────────────────────────────────────────────
NODE_ENV=production
PORT=5000

# The Supabase connection string. The session pooler (port 5432) is used
# because the direct host does not resolve over IPv4 from Render.
# The password lives in Render's environment settings.
DATABASE_URL=postgresql://postgres.<PROJECT>:<PASSWORD>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require

# A 64+ character random string. Generate with: openssl rand -base64 64
JWT_SECRET=<generate-one>

# The token the bus app sends as the x-hardware-token header.
WEBHOOK_SECRET=<generate-one>
```

Optional, but recommended:

```bash
# The Vercel frontend and any extra web frontends.
CORS_ORIGINS=https://bus-saarthi-inky.vercel.app

# Cloudinary. Without these, image uploads return a clear error and
# everything else keeps working.
CLOUDINARY_CLOUD_NAME=dddm66gd7
CLOUDINARY_API_KEY=<in-the-environment>
CLOUDINARY_API_SECRET=<in-the-environment>

# Redis. See §6 — this is the single biggest speed win.
REDIS_URL=redis://<host>:6379

# Web push. Without these, push notifications are off but in-app
# notifications still work.
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=mailto:admin@invertisbus.com

# Cap the database pool (default 5, max 15 — the pooler allows 15).
DATABASE_POOL_SIZE=5
```

The frontend reads `VITE_API_URL` and `VITE_SOCKET_URL` at build time. The
admin portal reads `VITE_API_URL`.

**Where the real values are:**

| Secret | Lives in |
|---|---|
| `DATABASE_URL` password | Render → your service → Environment |
| `JWT_SECRET`, `WEBHOOK_SECRET` | Render → your service → Environment |
| Cloudinary API key and secret | Render → Environment, and the local `.env` |
| `VITE_API_URL` | Vercel → your project → Settings → Environment Variables |
| `VAPID_*` | Render → Environment, and the local `.env` |

## 3. Seeded accounts

Run `npm run prisma:seed --prefix backend` to recreate them. They are
upserts, so it is safe to run again.

| Role | IDs | Password |
|---|---|---|
| Student | `S001` – `S010` | `Student@123` |
| Teacher / staff | `T001` – `T003` | `Teacher@123` |
| Parent | `P001` – `P010` (or the parent's phone) | `Parent@123` |
| Driver | `D001` – `D005` | `Driver@123` |
| Transport Incharge | `TI001` – `TI003` | `Transport@123` |
| Administrator | `AD001` – `AD003` | `Admin@123` |
| System administrator | `techadmin`, `admin`, `TECH001` | `TechAdmin@123` |

These are fixed demo credentials for a seeded database. Change them
before the system carries real student data.

Routes and the bus serving each one:

| Route | Bus | Stops | Capacity |
|---|---|---|---|
| 1 | `UP25 AB 1001` | Civil Lines & Chowki | 52 |
| 2 | `UP25 AB 1002` | Rajendra Nagar & DD Puram | 50 |
| 3 | `UP25 AB 1003` | Subhash Nagar & Junction | 48 |
| 4 | `UP25 AB 1004` | Cantonment & Sadar | 50 |
| 5 | `UP25 AB 1005` | Pilibhit Bypass & University Road | 54 |

## 4. How the app fits together

### The grievance lifecycle

A complaint is **never closed by the transport team alone**. It closes only
when the person who raised it confirms the fix.

```
pending ──"Start work"──> in_progress ──"Mark as fixed"──> resolved
                                                                   │
                                              complainant confirms ─┴──> closed
                                                                   │
                                              complainant rejects ──┘
                                                    (priority +10, back to the top of the queue)
```

- `resolved` is **awaiting confirmation**. It stays in the staff queue and
  has a 48-hour deadline. Staff can extend it by 24 hours.
- `reopened` means the complainant said it is not fixed. It sorts above
  everything else in the triage queue.
- `closed` is terminal — the only way out of it is a staff member deleting
  the record.

Each transition writes an in-app notification and sends a web push, and the
complaint's full history is in the detail sheet.

### Roles and what they can see

| Role | Sees |
|---|---|
| Student / teacher | Complaints for **their own route**, and their own complaints. Everyone else's is anonymous. |
| Parent | Their children's complaints, with status, and the confirm / reject buttons. |
| Driver | Their own route, the bus pass, the licence details. |
| Transport Incharge | Every bus, every complaint, with the reporter's real name. |
| Administrator | Everything, plus user and route management. |
| System administrator | The internal metrics and log portal. |

Non-staff **never** receive another passenger's real name — the server
strips it, it is not just hidden in the UI.

### Bus versus route

A **route** is the stable identity — the pick-up and drop-off points. A
**bus** is the vehicle that serves it, and it can change (a bus is
swapped, or two routes are merged for the day). Every complaint records
the route it was raised against and the bus that was running at the time;
the live bus is always resolved from the route.

### Bus merges

When two routes are merged for the day, the students of the cancelled
route become eligible to board the target bus. Attendance records keep
their original route in `originalRouteId` and the merge in `mergeEventId`,
so the history is never lost. Merges expire at midnight.

## 5. The bus sensor app (Flutter)

One app, two modes, chosen on the sign-in screen:

- **Driver phone** — the driver's own phone. A dashboard and a navigation
  aid. It does not run the sensors and does not scan faces.
- **In-bus device** — a phone or tablet fixed inside the bus. Runs the
  sensor telemetry for live tracking **and** the ArcFace scanner for
  attendance, continuously, without a user account.

Build it with the mode baked in:

```bash
# The in-bus device
flutter build apk --release --target-platform android-arm64 \
  --dart-define=API_URL=https://bus-saarthi-j3lq.onrender.com \
  --dart-define=SOCKET_URL=https://bus-saarthi-j3lq.onrender.com \
  --dart-define=ROUTE_ID=4 \
  --dart-define=APP_MODE=busDevice

# The driver's phone
flutter build apk --release --target-platform android-arm64 \
  --dart-define=API_URL=https://bus-saarthi-j3lq.onrender.com \
  --dart-define=APP_MODE=driver
```

The attendance chain:

```
ArcFace match → POST /api/sync/attendance → attendance row
              → the profile's attendance summary
```

The bus app identifies itself with the `x-hardware-token` header
(`WEBHOOK_SECRET`), so a device works even when the bus has no network
for a moment — the records are queued locally and synced when it returns.

**Face recognition is ArcFace and is planned to be replaced** with a
stronger ArcFace model; the on-device embedding store and matcher are
already structured for that.

## 6. Redis — what it is for, and what it will smoothen out

Redis is **optional**. The app runs correctly without it; every Redis
feature falls back to an in-process equivalent. It is worth deploying
because the app talks to Supabase over the internet, and every database
round trip costs roughly 100–200 ms.

Redis is used in four places:

### a) Caching hot reads — the biggest win

| What is cached | Key | Time to live |
|---|---|---|
| The route list (every bus, its live bus, capacity, driver) | `routes:all` | 60 s |
| The signed-in user's identity for the JWT check | `auth:user:<loginId>` | 5 min |
| The active wake-alarm list | `wake:alarms:active` | 30 s |

The route list alone is read on every dashboard load, on every bus picker
and on every profile page, and it changes perhaps once a day. Caching it
turns a ~1 s page load into a ~50 ms one.

The JWT check is the other big one. **Every authenticated request** used
to run a `SELECT * FROM users` — including the bcrypt hash — to confirm
the account still existed. With the cache, a signed-in user's requests
are answered from memory.

The wake-alarm list is read on every telemetry update, roughly once a
second per bus. That query used to scan every user row in the database.

### b) The Socket.IO adapter

Socket.IO is how live tracking, attendance and complaint updates reach
the dashboards. Without Redis, Socket.IO keeps its state inside a single
process — which is fine, but the moment Render runs **two instances** (it
does this to keep the free tier awake) the two processes cannot see each
other's clients. A live update sent to instance A never reaches a user
connected to instance B, and the dashboards silently stop updating.

Redis fixes this by letting the instances share their pub/sub state. This
is the reason to deploy Redis even if you never look at the cache.

### c) SOS cooldowns

A passenger can only send one SOS per minute. The cooldown is stored in
Redis so the limit holds across every instance. Without Redis it is
tracked in the memory of one process, so the limit is per-instance.

### d) Rate limiting

The login endpoint is throttled. With Redis the attempt counter is
shared across instances, so a brute-force attempt cannot be spread
across them.

### What Redis will **not** fix

- The first request after a cold start is still slow — the cache is
  empty.
- A query that is not cached still costs a round trip to Supabase.
- The app is already written so that Redis being down changes nothing
  except the speed.

**Recommendation:** deploy a small managed Redis (Render has a free
Redis, or use Upstash). Point `REDIS_URL` at it and restart. Expect the
dashboard load time to drop from around a second to well under a
quarter of a second, and the live tracking to become reliable across
instances.

## 7. Database migrations

The schema is versioned with Prisma migrations. The migration files live
in `backend/prisma/migrations/` and are applied on every deploy:

```bash
npm run migrate:deploy --prefix backend   # apply pending migrations
npm run migrate:status  --prefix backend   # check what is pending
```

**Never use `prisma db push` in production.** It compares the schema
with the live database and tries to *drop* whatever differs — which took
the service down twice. `migrate deploy` only ever moves forward.

To change the schema:

```bash
cd backend
npx prisma migrate dev --name what_you_changed
```

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Deploy fails with `Environment variable not found: DIRECT_URL` | An old schema | Update the schema — `directUrl` was removed on purpose. |
| Deploy fails with `max clients reached in session mode` | The pool exceeded the pooler's 15-connection limit | `DATABASE_POOL_SIZE=5`. The app now caps it automatically. |
| Deploy fails with `Use the --accept-data-loss flag` | `prisma db push` was used | Use `prisma migrate deploy` (the Dockerfile now does). |
| The service will not start | `JWT_SECRET` or `WEBHOOK_SECRET` missing | Both are required in production. |
| A complaint will not post | The payload has a field the API does not accept | The backend rejects unknown fields. Check the DTO. |
| The profile shows a stale fee status | The page read the login snapshot | The profile now reads `GET /api/users/me`. |
| Live tracking stops updating | More than one Render instance | Deploy Redis (§6). |
