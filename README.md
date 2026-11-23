# GIST Cleaning Hub — concept prototype

**One app for everything GIST Cleaning runs on today:** the public website, client booking and invoices, the team's time clock, schedule, pay and paperwork (what Gusto does now), and every company doc from Google Drive, readable right on the page and downloadable. Plus an AI assistant that knows the business.

> Built by Robert (a GIST Residential Cleaning Tech) as a proof of concept for Dustin. It is **not** the official site — that's [gistcleaning.com](https://www.gistcleaning.com). Every client, address, paycheck and message in the demo is made up.

**Try it:** **https://gistcleaninghub.com** (also at bluesmanna.github.io/gist-cleaning-hub) · **Android APK:** [latest release](https://github.com/Bluesmanna/gist-cleaning-hub/releases/latest)

No sign-up. Open **Sign in**: the left side is the sign-in a real customer or employee would see (one email/Google login for everyone; the account decides the view, and typing a demo email like `jamie@gist.demo` works). The right side, marked **Demo only**, lets you try it as a Client, Cleaning team member or the Owner, one tab at a time. Inside, the **Demo** switcher at the top changes person any time. Everything you do is saved in your own browser, and **Settings → Reset demo data** puts it back.

| Sign in as | Role | Good things to try |
|---|---|---|
| **Dustin Sipes** | Owner / manager | Approve hours, PTO and receipts · run payroll · build and publish next week's schedule · turn a website booking into a client · send invoices · reports · message anyone |
| **Jamie Rivera** | Cleaning tech | Clock in at today's home (location simulated) · check off the home's task list · submit hours · paystubs (ask the AI to explain one) · request time off · log mileage/receipts · set availability |
| **Sam Okafor** | Substitute tech | Same as Jamie, with substitute card amounts |
| **Taylor Brooks** | New hire | Onboarding: profile, direct deposit, W-4, I-9, handbook + agreement signatures |
| **Alex Aspen** | Client | Upcoming visits · cancel/reschedule (with the real fee policy) · pay invoices (Venmo/Zelle/Square) · request a cleaning · home preferences |
| **Vale & Wren Hawthorne** | Client | A second client household |

A step-by-step test script for each role is in [docs/TESTING.md](docs/TESTING.md).

## What's inside

**Public website** — home, services and add-ons, pricing with an instant estimator, the cancellation policy, booking request form, the organization photo gallery and before/after story, about Dustin, careers, and the doc library. Text, prices, policies, photos and logo come from gistcleaning.com and GIST's Facebook page (used with Rob's go-ahead, since this is being made for GIST).

**For the team (replaces Gusto day-to-day)**
- Time clock that only works within 150 m of the client's home (Gusto-style geofence), with today's home, directions, task checklist and notes
- Timesheets with per-day edits (edits need a note), submit-for-approval, overtime split by Sun–Sat workweek
- Schedule (week view, add your shifts to your phone calendar), availability, time-off requests and PTO balance (1 hour per 25 worked)
- Pay: paystubs with earnings, taxes, deductions, supply/gas cards and reimbursements; year-to-date totals; download or print to PDF
- Expenses and mileage with receipt photos
- Onboarding: personal info, direct deposit, W-4, I-9, e-signing the handbook and agreement
- Documents: your signed papers plus every SOP, handbook and agreement

**For Dustin** — dashboard, schedule builder with availability-conflict warnings, approvals queue, payroll preview → process (paystubs appear for each employee), team management and new-hire setup, client records with photos and home SOPs, website bookings inbox, invoicing, reports with CSV export, settings (geofence radius, AI provider, data export/import/reset).

**For clients** — visits, cancel/reschedule with the fee shown up front, invoices and payment, request a cleaning, preferences (pets, notes, preferred cleaner, frequency, add-ons, home photos), messages.

**Docs (from Google Drive)** — all 36 Drive docs (general SOP, 28 home SOPs, two project task lists, both handbooks, three agreement templates) are rendered as readable pages with a table of contents and search, and each downloads as **PDF, Word (.docx), Markdown or text**. They live **inside the team app only** (employees: **Handbook & SOPs**; owner: **SOPs & docs**), not on the public site or in the client portal. Client SOPs are **pseudonymized** for this public demo (see Privacy below).

**AI** — a GIST assistant (floating button, or **Assistant** in the menu) plus small AI buttons where they help: explain a paystub, draft a reply to a client, ask a question about a doc, quote a booking. It works offline out of the box, and can be pointed at Rob's own Claude Code through a locked-down local bridge, or at the Claude API. See [docs/AI.md](docs/AI.md).

## Docs

- [docs/DECISIONS.md](docs/DECISIONS.md) — why it's built the way it is
- [docs/RESEARCH.md](docs/RESEARCH.md) — what was researched (Gusto, gistcleaning.com, Facebook, the Drive docs) and how each piece maps into the app
- [docs/AI.md](docs/AI.md) — the assistant, the Claude Code bridge, and the path to production AI
- [docs/BACKEND.md](docs/BACKEND.md) — how to turn the demo into the real thing (Supabase, payments, payroll)
- [docs/TESTING.md](docs/TESTING.md) — manual test scripts and the automated checks
- [docs/PRIVACY.md](docs/PRIVACY.md) — what is real, what is fake, and what was kept out of this repo

## Run it yourself

```bash
cd app
npm install
npm run dev          # http://localhost:5173
npm run build        # production build in app/dist (static; any web host works)
npm run bridge       # optional: AI via your own Claude Code (see docs/AI.md)
```

Android: `npm run build && npx cap sync android`, then build `app/android` with Android Studio or `gradlew assembleDebug` (JDK 21, Android SDK 36).

Stack: React 19 + TypeScript + Vite, React Router (hash routes so it runs from any static host and inside the APK), IndexedDB for demo data, Capacitor 8 for Android (native GPS, file saving and share sheet). No server needed for the demo.

## Privacy, briefly

This repo is public, so: client SOPs use made-up household names, addresses, phone numbers and door codes (the real ones stay private, outside this repo); no real payroll, tax or ID data is in here; the demo people are fictional apart from Dustin as owner. Details in [docs/PRIVACY.md](docs/PRIVACY.md).
