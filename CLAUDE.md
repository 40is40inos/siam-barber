# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Online booking site for **Siam Barber** (one barber in Greece), replacing an ebarber.gr page. Customers pick a day, a
time, give name + phone (+ optional note); no accounts or verification. The barber manages everything at `/admin`.
Greek is the default language, English is a toggle. See `README.md` for the product overview and deploy notes.

**Read `AGENTS.md` first:** this is Next.js 16.4 with breaking changes. Check `node_modules/next/dist/docs/` before
using any Next API you haven't verified in this repo.

## Commands

```bash
npm run dev            # dev server on :3000 (local SQLite at data/siam-barber.db, created on first request)
npm run build          # production build — the strictest check (Cache Components prerender rules)
npm start              # serve the build on :3000
npx tsc --noEmit       # type-check
npx eslint src         # lint (npm run lint also works)
npx next typegen       # regenerate route types (RouteContext<...>) if tsc can't find them
```

There is **no test suite**. Verify changes with `tsc` + `eslint` + `next build`, `curl` against the API, and the
browser. For end-to-end checks without touching the real database or the barber's password, run a throwaway
production server on another port, then delete its DB afterwards:

```bash
ADMIN_PASSWORD=throwaway SESSION_SECRET=tmp DATABASE_URL="file:<scratch-dir>/verify.db" node node_modules/next/dist/bin/next start -p 3100
```

Never read or use the real `ADMIN_PASSWORD` from `.env.local`; the owner may have set a personal one.

## Next.js 16 specifics that shape this code

- **`cacheComponents: true`** (next.config.ts). Pages (`/`, `/admin`, `/cancel`) are static shells rendering a single
  client component; all runtime data comes from client `fetch` to `/api/*`. Server components must not read the
  clock or cookies. GET route handlers that depend on the time call `await connection()` first (see
  `api/availability`).
- **Activity route preservation.** Navigating away *hides* a page instead of unmounting it: state survives and
  effects re-run on return. Stale UI must be cleared explicitly. See `BookingApp.tsx`: the device-bookings effect
  always replaces the list (no early return), and a `useLayoutEffect` cleanup resets the flow if the user left from
  the confirmation step.
- **Lint rule `react-hooks/set-state-in-effect`** rejects synchronous `setState` in effect bodies. Pattern used
  everywhere: `fetchX().then(applyX).catch(...)`, with state set only inside the callbacks.
- `params` are Promises; route handlers type context with `RouteContext<"/api/...">`.
- `@libsql/client` is already in Next's server-external list; no `serverExternalPackages` entry is needed.

## Architecture

**Server data flow** (all business logic lives in `src/lib`; route handlers in `src/app/api` are thin wrappers that
validate input, call `lib/bookings.ts`, and return `json()`/`fail()` from `lib/http.ts`):

```
config.ts          static shop info (name, barber, area, time zone) + STARTING values for settings
settings.ts        shared (server+browser) Settings types, DEFAULT_SETTINGS, validateSettings, toPublicShop
settings-store.ts  reads/writes the single "shop" settings row; falls back to defaults if unsaved/invalid
time.ts            date/time math in the shop's zone; scheduleSlots(date, settings), overlaps, withinHours
bookings.ts        availability, create/cancel, admin day view, blocks, walk-ins, holidays
db.ts              libsql client, schema, MIGRATIONS
```

- **Dates and times** are plain strings: `"YYYY-MM-DD"` and `"HH:MM"`, always in `Europe/Athens`. `shopNow()` gives
  the shop-local date and minute regardless of server zone. Client date formatting goes through `fmtDate` in
  `i18n.ts` (formats with `timeZone: "UTC"` on noon-UTC dates).
- **Schedule:** slots come from `settings.hours[weekday]` (0 = Sunday, up to 3 ranges per day for breaks), stepped
  by `settings.slotMinutes`. Every service lasts exactly one slot; per-service durations are not supported.
- **Database tables:**
  - `appointments`: holds both bookings and blocks (`kind`), with `status` active/cancelled, `minutes` (length when
    booked), `source` online/admin, optional `note`, and a random `token` (the customer's cancel key).
  - `closed_days`: holidays and closed days, with an optional `note` shown to customers.
  - `settings`: a single `"shop"` JSON row.
  - **Schema changes:** append an `ALTER TABLE` to `MIGRATIONS` in `db.ts`. Each runs at startup and "duplicate
    column" errors are ignored, so existing databases upgrade themselves.
- **No double booking:** the overlap check and the insert run inside `inWriteTx` (a libsql write transaction).
  Overlap uses each row's stored `minutes` (`LEGACY_MINUTES = 45` for old rows), so changing the slot length never
  double-books. A partial unique index on `(date, time) WHERE status='active'` is the backstop. (Cloudflare D1
  lacks interactive transactions, which is why it isn't a drop-in replacement.)
- **"Outside hours"** in admin means the booking doesn't fit inside opening hours (`withinHours`). It is not about
  sitting on the slot grid.
- **Services are never hard-deleted.** Removing one in Settings archives it (`archived: true`, merged server-side in
  `api/admin/settings`), so old bookings still resolve their name. Customers only see `activeServices`.
- **Customer identity:** none. The cancel link is `/cancel#<token>`; it uses the URL fragment so the token never
  reaches server logs. The browser keeps its booking tokens in localStorage (`siam:bookings`) to show a "your
  appointment" banner. Abuse limits: per-phone cap (`maxActivePerPhone`, phones normalised to E.164 in
  `validate.ts`) and a hidden `website` honeypot field.
- **Admin auth:** a single `ADMIN_PASSWORD`. Sign-in sets an HttpOnly cookie holding an HMAC-signed expiry
  (`lib/auth.ts`). Every `/api/admin/*` handler starts with `requireAdmin(request)`; there is no proxy/middleware.
  Login brute-force protection is an in-memory counter, so it only applies per server instance.

**Client:**

- `components/booking/BookingApp.tsx` orchestrates `when → details → done`. The big headline doubles as the
  progress indicator: its lines are replaced by the chosen date and time. `/api/availability` returns `days` plus
  `shop` (public services, hours, slot length); price/hours UI renders invisibly until it arrives, so the built-in
  defaults never flash.
- `components/admin/AdminApp.tsx` holds login, a Dashboard with Schedule/Settings tabs (both stay mounted so unsaved
  settings survive tab switches), `MonthWeeks` (month picker + horizontal week pager), `SlotRow` and `QuickBook`.
  `AdminSettings.tsx` edits a draft against a saved `base`; a sticky save bar appears when they differ.
  Holidays save immediately, outside that draft.

## Conventions

- **Bilingual everything:** customer texts in `lib/i18n.ts`, admin texts in `lib/admin-i18n.ts`; every key needs
  both `el` and `en`. Store error/toast *codes* in state and translate at render, so a language switch updates them.
  Language state is in `LangProvider` (`useSyncExternalStore` over localStorage `siam:lang`).
- **Styling:** Tailwind 4 with design tokens on `:root` in `globals.css` (dark theme only; accent `#ff5b35`).
  Custom CSS must stay inside `@layer base` / `@layer components`: unlayered CSS beats Tailwind utilities. Fonts
  (Syne display, Manrope body) must keep the `greek` subset.
- **Motion** (`motion/react`, wrapped in `MotionConfig reducedMotion="user"`):
  - The customer flow is deliberately expressive: staggered entrances, rolling text, shared-layout pills, success
    burst.
  - The admin screen is used many times a day: keep motion quick (≈150–300 ms) and quiet.
  - Ease `[0.23, 1, 0.32, 1]`; animate transform/opacity only; gate hover effects behind `(hover: hover)`.
  - CSS loops (ambient glows, barber pole, marquee, caret) stop under `prefers-reduced-motion`.

## Environment and deployment

- `.env.local` (ignored; template in `.env.example`) holds `ADMIN_PASSWORD`, `SESSION_SECRET`, `DATABASE_URL`
  (default `file:data/siam-barber.db`) and `DATABASE_AUTH_TOKEN` (for a remote libsql/Turso database).
- The code is in a private repo on GitHub, `40is40inos/siam-barber`. Commits use the repo-local git identity, which
  is set to the owner's GitHub no-reply email.
- **Not deployed yet.** The direction discussed is Cloudflare Workers via OpenNext plus Turso. It would require
  turning `cacheComponents` off (OpenNext has open issues with Cache Components on Next 16), re-testing the
  Activity-dependent behaviour above, and switching the libsql import to the web client for the Workers runtime.
  Vercel's free plan is non-commercial, so it was ruled out.
- Still unconfirmed with the shop: real opening hours (the defaults were inferred from ebarber), plus `shop.area`
  and `shop.mapsUrl` in `config.ts` (both empty).

## Working on Windows here

- The machine is Windows. Git Bash heredocs and `node -e` strings can silently strip backslashes (regexes have been
  corrupted this way). Make regex and escaped-string edits with the Edit tool, not shell scripts.
- Git is set to `core.autocrlf=true`, so files may have CRLF line endings. Normalise before doing exact string
  replacement in scripts.
- Stopping a background `next start` task can leave its child `node` process running on the port. Kill it by
  matching `next start -p <port>` in the process command line.
- When the browser pane is in the background, `requestAnimationFrame` pauses, so `AnimatePresence mode="wait"` step
  transitions never finish if the UI is driven only via injected JS. Use real clicks and screenshots to advance.
