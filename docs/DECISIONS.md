# Decisions

Short notes on why the prototype is built the way it is. Each one is reversible; the "later" column says what changes when GIST wants it for real.

## Scope: one app, three audiences

GIST currently runs on a website (gistcleaning.com), Gusto (time, schedule, pay, onboarding), Google Drive (SOPs, handbooks, agreements), texts/email with clients, and Venmo/Zelle/Square. The hub puts all of that behind one login with three roles — **owner/manager**, **employee**, **client** — plus the public website for visitors. One codebase serves the website, the web app and the Android app.

**One sign-in, demo accounts kept apart (Rob, after the first review):** the first version listed every demo person on the login page, which no real app would do. Now the page has the real shape: one sign-in form for everyone (email link or Google) where the account decides whether you land in the client portal, the team app or the owner tools. Next to it, a dashed panel marked **Demo only** holds the made-up accounts, one role per tab (Client, Cleaning team, Owner), and the person switcher in the app is labelled **Demo**. In the prototype the email form signs a demo email in straight away (nothing is sent) and Google shows a "comes with the backend" note.

## Self-contained demo (no server)

| Now | Why | Later |
|---|---|---|
| All data lives in the browser (IndexedDB), seeded with fake people relative to today's date | Anyone Dustin sends the link to can click everything, approve, pay, cancel, without accounts, a backend bill or risk to real data. The demo always looks "live" because the seed is generated from the current date. | Supabase (Postgres + auth + storage + row-level security). The data model in `app/src/lib/types.ts` is already table-shaped. See [BACKEND.md](BACKEND.md). |
| Demo sign-in panel + "Demo" person switcher | Lets one person see how a change flows from employee → owner → client. | Real sign-in (email magic link / Google), already shown on the sign-in page; the demo panel and switcher disappear. |
| Notifications and messages are local | They show the flow (bell, badges, threads) end to end. | Supabase realtime + push notifications (Capacitor Push / FCM). |

## Pay rules researched, payroll estimated

The pay rules (rate, semi-monthly periods, payday timing, overtime, on-site-only hours, PTO accrual, supply/gas cards, reimbursements) come from GIST's Gusto account, the handbooks and the employment agreements; see [RESEARCH.md](RESEARCH.md). They are encoded once in `app/src/lib/payroll.ts` (`POLICY`).

Tax withholding is an **estimate** (2026 federal percentage method, Social Security, Medicare, Idaho's flat rate) so paystubs look and add up like real ones. The prototype does not file taxes or move money. **Recommendation:** keep Gusto (or another payroll provider) as the system of record and have the hub push approved hours to it; see BACKEND.md.

## Time clock with a geofence

Gusto's GIST setup only lets techs clock in at the client's home. The hub does the same: clock-in requires being within a configurable radius (default 150 m) of the home's coordinates. In the browser demo the location is **simulated** by default (owner Settings → "Simulate being on-site"), because Dustin won't be standing in a client's driveway when he tests it. Turn it off and the same check uses real GPS, in the browser (navigator.geolocation) and in the Android app (native location permission); verified on an Android emulator, where clocking out 5 km from the home was refused. Travel between homes isn't paid time (per the handbook), so it's logged as mileage instead.

## Docs: readable and downloadable, generated once

Rob asked that every Drive doc be readable on the site *and* downloadable. The Drive docs were exported, cleaned to Markdown, and turned into four formats (PDF, .docx, .md, .txt) by `tools/build_docs.py`; the readable pages render the Markdown with a table of contents and in-doc search. They're static files, so they load fast, work offline in the APK, and don't depend on Google Drive permissions. Because the public copies of client SOPs are pseudonymized, team members can load the real ones onto their own device with **Docs → Import private pack** (a file kept outside this repo); they're stored on that device only and never uploaded.

**Team only (Rob, after the first review):** handbooks, SOPs, agreements and client checklists are internal, so they're reachable only inside the signed-in team app (employees see **Handbook & SOPs**, the owner **SOPs & docs**), not on the public site or in the client portal. Old `#/docs` links redirect to sign-in and then straight to the doc. The assistant follows the same line: visitors and clients only search the public-site content, and the team pay/employment rules (`skills/gist-team.md`) are sent only for staff. In this no-server demo that is a UI boundary: anyone can still "sign in" as a demo employee, and the static files and the public repo stay readable. Real protection comes with the backend in BACKEND.md (real logins, docs served from authenticated storage, not from the public build).

## Client privacy over realism

The repo is public, so client SOPs are pseudonymized (plant-name households, fake streets, phones and door codes) and a leak checker (`tools/check_leaks.py`) compares every public file against the private originals before anything is pushed. See [PRIVACY.md](PRIVACY.md).

## AI: useful in small places, live in the demo

The assistant appears where it saves time (explain a paystub, draft a client reply, ask a doc, quote a booking) plus one general chat. **Live Claude, two assistants (Rob, after the first review):** the demo now answers with Rob's own Claude Code through a locked-down public bridge on his always-on PC, split into a customer assistant (public knowledge, a client's own visits) and a team assistant (adds SOPs, handbook and pay rules). It has daily and per-visitor limits, and the built-in **offline** assistant answers whenever the live one is off, so the demo never breaks. The Claude API is wired as the production path. Each request only carries the asking user's own role-scoped data. See [AI.md](AI.md).

## "Sign in" and "Get app" on the website

The header button always says **Sign in** (it used to say "Open app" once signed in, which reads oddly when you're already in an app). Next to it, **Get app** downloads the Android APK straight from the repo's GitHub release (`releases/latest/download/gist-cleaning-hub.apk`), so there's no hosting cost and the button always gets the newest build. It's hidden inside the Android app itself.

## Branding

GIST's real logo, colors (navy + sage + soft yellow), fonts and photos from gistcleaning.com are used because the app is being built *for* GIST (Rob confirmed). A banner on every screen says it's a concept prototype by Robert and links the official site, so nobody mistakes it for GIST's live system.

## Tech choices

- **React 19 + TypeScript + Vite**: fast, common, easy for any future developer to pick up.
- **Hash routing** (`/#/app/...`): works on any static host (GitHub Pages) and inside the Android WebView with no server rewrites.
- **Capacitor 8** for Android instead of a separate native app: one codebase; native GPS, file saving and share sheet through plugins. An iOS build is the same project plus `npx cap add ios` on a Mac.
- **No UI framework**: a small hand-written CSS design system (`index.css`) keeps the bundle small and matches GIST's look.
- **GitHub Pages** hosting: free, HTTPS, deploys from the repo on every push (`.github/workflows/pages.yml`).
- **Domain:** gistcleaninghub.com, registered at Porkbun ($11.81 for the first year, renews about $11/yr) and pointed at GitHub Pages (four A records, four AAAA records, `www` CNAME to bluesmanna.github.io; the `CNAME` file in the repo keeps Pages on it). It's deliberately not gistcleaning.com, which stays Dustin's real site; if he adopts the hub, it can move to a subdomain such as app.gistcleaning.com with one CNAME record.
