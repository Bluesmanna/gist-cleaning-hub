# Research and how it maps into the app

Four sources were studied before building: GIST's Gusto account (employee side, via Rob's own login), gistcleaning.com, GIST's Facebook page, and every doc in GIST's shared Google Drive. No personal data from any of them is in this repo (see [PRIVACY.md](PRIVACY.md)).

## 1. Gusto (what the team uses today)

Gusto's employee menu for GIST: Home, My profile, Pay, Wallet, Schedule, Time tracking, Benefits, Documents, Performance, Expenses, Refer & earn, Giving, Settings. What GIST actually uses, and where it lives in the hub:

| Gusto | How GIST uses it | In the hub |
|---|---|---|
| **Time tracking** (Time Tools) | Clock in/out on the phone, **only at the client's home** (geofenced job sites); hours reviewed per pay period ("My hours"), edits with notes; employees submit, Dustin approves | Dashboard clock-in card with a geofence (150 m default), Time page with edit-with-note history and **Submit hours**, owner **Approvals** |
| **Schedule** | Weekly schedule for the "Residential Cleaning Techs" team, **Set availability**, **Calendar sync** | Schedule (week/list), Availability, add shifts to your calendar (.ics); owner schedule builder with availability-conflict warnings and **Publish** |
| **Pay** + pay tracker | Semi-monthly paystubs; a tracker for the current period's upcoming payroll | Pay page: paystubs with full breakdown, year-to-date totals, "this period so far" tracker; owner **Payroll** preview → process |
| **Documents** | Form I-9, W-4, W-2 (paper copy on request), uploaded documents, signed company docs | Documents & onboarding: W-4, I-9, direct deposit, handbook + agreement e-signature; plus the full doc library |
| **Expenses** | Add expense with category, date, amount, receipt | Expenses: mileage (IRS rate), laundry, supplies with receipt photos → approved → reimbursed on the next paystub |
| **My profile** | Personal info, emergency contact, pay method | Profile (and onboarding for new hires) |
| **Wallet / Benefits / Performance / Giving / Refer** | Gusto-specific extras; GIST doesn't offer health benefits; no reviews recorded there | Left out on purpose. GIST's real perks (cards, PTO, tips, reimbursements) are modeled in Pay; 6-month merit reviews could be added later |
| Admin side (Dustin) | Run payroll, approve hours/PTO/expenses, manage team, hire/onboard | Dashboard, Approvals, Payroll, Team (incl. new-hire setup), Reports |

### Pay rules found (encoded in `app/src/lib/payroll.ts`)

- Hourly; $18/hour starting for Residential Cleaning Techs.
- Semi-monthly periods: 1st–15th and 16th–end of month.
- Payday about 5 days after the period closes (the Nov 1–15 period was paid Friday Nov 20); weekend paydays move to the Friday before.
- Overtime at 1.5x over 40 hours in a workweek (federal FLSA; Idaho has no daily overtime).
- Only on-site (geofenced) time is paid; driving between homes is reimbursed as mileage instead.
- PTO accrues 1 hour per 25 hours worked.
- Supply card $75 and gas card $50 loaded each pay period; half for substitutes working under 20 hours in the period.
- Tips paid in full; mileage and laundry reimbursements pass through untaxed.
- Hours are due by the last day of each period; a forgotten clock-out is set to the scheduled end with a note.

## 2. gistcleaning.com and Facebook (the public face)

Pages: home, services (Basic Cleaning, "White Glove" & Move-Out, "Rescue Cleaning", Residential Organization, Commercial / GIST for Business), add-ons, pricing, cancellation policy, organization photo gallery with a before/after story, about Dustin, careers, contact. Facebook adds announcements (e.g. the Jan 12, 2026 rate change to $37/hour and hiring the first employee) and photos.

In the hub: all of it is on the public site with the real copy, prices, policy, photos and logo, plus things the current site doesn't have: an instant **price estimator** (service + hours + add-ons), an online **booking request** that lands in Dustin's Bookings inbox (one click turns it into a client and a draft shift), and a client portal.

Business facts the AI assistant knows are in `app/src/lib/ai/skills/gist-business.md`.

## 3. Google Drive (internal docs)

36 docs: Standard Operating Procedures (general), 28 client SOPs (one per home: access, pets, preferences, supplies, room-by-room checklist), two project task lists, two employee handbooks (RCT, Substitute RCT) and three employment agreements (RCT, Substitute RCT, Assistant Manager).

In the hub: every one is a readable page (table of contents, search, ask-AI) and downloads as PDF, Word, Markdown and text. Client SOPs also feed the shift screen, so a tech sees that home's checklist and notes when they clock in. The handbook and agreement are what new hires sign during onboarding.

## 4. Gaps the hub fills

Things GIST currently does by text, email or memory that now have a place:

- Booking requests and quotes (website form → Bookings → client + shift)
- Invoicing and payment tracking (Venmo / Zelle / Square), with the cancellation fee applied automatically
- One message thread per client and per employee
- Client preferences and home photos next to the SOP
- Reports: hours, payroll cost, revenue by client, CSV export
