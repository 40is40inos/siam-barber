# Siam Barber · Booking

Online booking for Siam Barber, replacing the ebarber.gr booking page.
Customers pick a day, a time, type their name and phone, and they're booked. No accounts, no codes.

- `/`: customer booking (Greek by default, English toggle)
- `/cancel#<token>`: customer cancellation (linked from the confirmation screen)
- `/admin`: the barber's schedule (password protected)

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 and http://localhost:3000/admin.
The local database is created automatically in `data/siam-barber.db`. No settings file is needed
(`.env.example` lists the optional ones).

## Admin password

There is no password in any config file. The first visit to `/admin` on a fresh database shows
**Create a password**; the barber picks his own and is signed in. Later he changes it in
**Ρυθμίσεις / Settings → Admin password** (that signs out his other devices).

Until a password is created, whoever opens `/admin` first can set it, so do it right after deploying.
It's stored as a salted hash; the cookie-signing key is generated automatically and also lives in the
database. Five wrong attempts lock that IP out for 10 minutes.

## Change prices, hours, booking rules

The barber does this himself at `/admin` → **Ρυθμίσεις / Settings**:

- **Services & prices:** names in Greek and English, price; add or remove services. Removed services stay on old bookings.
- **Opening hours:** per weekday, with up to three ranges for lunch breaks or split shifts.
- **Booking rules:** appointment length, how many days ahead, how late a same-day booking can be made, bookings per phone.
- **Holidays & time off:** close a range of days with an optional note ("Χριστούγεννα") that customers see on the booking page.

Changes apply to the booking page right away. Bookings already made keep their time and length, and the
schedule never offers a slot that overlaps one.

[`src/lib/config.ts`](src/lib/config.ts) only holds the starting values (used until the barber first saves) and
details that don't change often: shop name, barber name, area and Maps link (still empty: ebarber lists both
Άρτα and Naousa), time zone.

## How booking stays safe without verification

- No overlapping bookings: the overlap check and the insert run in one database transaction, so two people can't take the same time.
- The server re-checks everything: slot on the schedule, inside the window, not in the past, day not closed.
- Phone numbers are normalised (`691 234 5678`, `+30…`, `0030…` are the same number) and limited to a set number of upcoming bookings (2 by default).
- A hidden honeypot field stops simple form bots.
- Customers get a private cancel link; the device also remembers their booking and offers it on the next visit.

## The barber's screen (`/admin`)

- Month view, browsed week by week, with booking counts; Greek/English switch.
- Each slot: booked (name, tap-to-call phone, service, cancel), free (**+ Ραντεβού** for phone or walk-in customers, **Κλείσιμο** to block it), or blocked (**Άνοιγμα**).
- **Κλείσιμο ημέρας** closes a whole day to new bookings (holidays, sick days); existing bookings stay.
- Refreshes every 30 seconds and when the tab regains focus.

## Deploy

**Cloudflare Workers + Turso (free tiers): the current setup.**
1. Connect the GitHub repo to a Worker named `siam-barber` (Workers Builds).
   Build command: `npx opennextjs-cloudflare build`. Deploy command: `npx opennextjs-cloudflare deploy`.
2. Create a free Turso database and a token at [turso.tech](https://turso.tech).
3. In the Worker's **Settings → Variables and Secrets**, add `DATABASE_URL` (`libsql://…`) and
   `DATABASE_AUTH_TOKEN`, both as type **Secret**.
4. Deploy, then open `/admin` straight away and create the admin password.

**A VPS or any Node host with a disk**
```bash
npm ci && npm run build
DATABASE_URL=file:/var/lib/siam-barber/siam.db npm start
```

The tables are created on first request.

## Stack

Next.js 16 (App Router), React 19, Tailwind CSS 4, Motion, shadcn/ui calendar, libSQL/SQLite (Turso),
deployed on Cloudflare Workers via OpenNext.
Fonts: Syne (display) and Manrope (text), both with Greek.
Motion respects the system's reduced-motion setting.
