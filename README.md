# Siam Barber · Booking

Online booking for Siam Barber, replacing the ebarber.gr booking page.
Customers pick a day, a time, type their name and phone, and they're booked. No accounts, no codes.

- `/`: customer booking (Greek by default, English toggle)
- `/cancel#<token>`: customer cancellation (linked from the confirmation screen)
- `/admin`: the barber's schedule (password protected)

## Run it locally

```bash
npm install
cp .env.example .env.local   # then set ADMIN_PASSWORD and SESSION_SECRET
npm run dev
```

Open http://localhost:3000 and http://localhost:3000/admin.
The local database is created automatically in `data/siam-barber.db`.

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

The app is a standard Next.js server. It needs somewhere to keep the database:

**Vercel + Turso (free tiers)**
1. Create a Turso database and token (`turso db create siam-barber`, `turso db tokens create siam-barber`).
2. On Vercel, import the repo and set `DATABASE_URL` (`libsql://…`), `DATABASE_AUTH_TOKEN`, `ADMIN_PASSWORD`, `SESSION_SECRET`.

**A VPS or any Node host with a disk**
```bash
npm ci && npm run build
DATABASE_URL=file:/var/lib/siam-barber/siam.db ADMIN_PASSWORD=… SESSION_SECRET=… npm start
```

The tables are created on first request.

## Stack

Next.js 16 (App Router, Cache Components), React 19, Tailwind CSS 4, Motion, libSQL/SQLite.
Fonts: Syne (display) and Manrope (text), both with Greek.
Motion respects the system's reduced-motion setting.
