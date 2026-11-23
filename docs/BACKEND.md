# From demo to real: backend plan

The demo stores everything on the device. To run GIST on it, add a backend. Recommended: **Supabase** (hosted Postgres, auth, file storage, realtime, edge functions; free tier is enough for a team of a few people and a few dozen clients).

## 1. Database

`app/src/lib/types.ts` is already shaped like tables. One table per collection in `State`:

| Table | From | Notes |
|---|---|---|
| `users` | `User` | `id` = Supabase auth user id; `role` in (`owner`, `manager`, `employee`, `client`) |
| `clients` | `Client` | address, lat/lng (geofence), pets, preferences, photos (storage paths), SOP slug |
| `shifts` | `Shift` | `published` flag; RLS: employees see their own published shifts |
| `time_entries` | `TimeEntry` | clock-in/out with GPS + distance, edits with a required note, status `open/submitted/approved` |
| `availability`, `pto_requests`, `expenses` | | receipts in storage |
| `paystubs`, `payroll_runs` | | if payroll stays in Gusto, store the stub PDFs/summary only |
| `bookings`, `invoices`, `messages`, `notifications`, `tasks` | | |
| `docs`, `signatures` | | signed handbook/agreement records (who, when, IP, doc version hash) |

**Row-level security** carries the role rules the demo enforces in the UI: employees read/write only their own time, PTO, expenses and stubs; clients only their household's visits, invoices and messages; owner/manager everything. Door codes and key locations live in a separate `client_access` table readable only by the owner and the employees scheduled at that home.

## 2. Auth

Supabase Auth with email magic links (no passwords for clients) and optional Google sign-in for the team. Owner invites employees and clients from Team / Clients (the "new hire" and "make client" flows already exist).

## 3. Swap the store

`app/src/lib/store.tsx` is the only place that reads/writes data (`update(draft => ...)`). Replace its IndexedDB persistence with Supabase queries + realtime subscriptions, keeping the same `useStore()` API so pages don't change. Keep IndexedDB as an offline cache so techs can clock in with weak signal and sync later.

## 4. Payroll and taxes

Don't rebuild payroll. Options, best first:

1. **Keep Gusto as payroll; the hub feeds it.** Gusto's API (partner/app integration) accepts time and returns payroll + stubs. Approved hours flow from the hub; employees see stubs in the hub.
2. Embedded payroll (Check, Gusto Embedded) if GIST outgrows Gusto's UI.

The hub's own pay engine (`lib/payroll.ts`) stays useful for previews and "what will my check be" estimates.

## 5. Payments

Clients already pay by Venmo, Zelle or Square. Easiest real version: Square Invoices API (card + Cash App Pay, auto-reconciled) with Venmo/Zelle kept as "mark as paid" options. Stripe works too.

## 6. Notifications

Supabase realtime for in-app updates; push to phones with Capacitor Push Notifications + Firebase Cloud Messaging; email (Resend) for clients who don't use the app: booking confirmations, invoice sent, visit reminders.

## 7. AI

Move the AI call into an edge function as described in [AI.md](AI.md).

## 8. Hosting

- Web: keep GitHub Pages (static) or move to Netlify/Vercel/Cloudflare Pages; the custom domain carries over.
- Android: Play Store listing ($25 one-time developer fee), signed release build.
- iOS: `npx cap add ios` and an Apple Developer account ($99/yr).

## Rough effort

A developer familiar with the stack: about 2–4 weeks for auth + database + RLS + store swap + push, plus the payroll integration depending on Gusto API access.
