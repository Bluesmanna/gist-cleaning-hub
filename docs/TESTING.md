# Testing guide

## Manual test script (about 15 minutes)

Open the live site (or the APK). Data is saved in your browser; use **Reset demo** in Settings (or on the About page) to start over. Switch people with the **Viewing as** menu at the top.

**1. Visitor → booking**
1. On the home page, try the price estimator on **Pricing**.
2. **Book a cleaning**: fill the form and send it. You'll see a confirmation.

**2. Jamie (cleaning tech)**
1. Log in → **Jamie Rivera**. The dashboard shows today's home.
2. **Clock in** (the demo simulates being on site so you can test from anywhere; as Dustin, turn off **Simulate being on-site** in Settings to use real GPS in the browser or on Android, and clock-in then only works within 150 m of the home). Open **Details** to see the home's checklist and tick a few tasks. **Clock out**.
3. **Time**: edit an entry (a note is required), then **Submit hours**.
4. **Pay**: open a paystub, tap **Explain this paystub**.
5. **Time off**: request a day. **Expenses**: log mileage or a receipt (attach a photo).
6. **Schedule** → **Availability**: change a day.

**3. Taylor (new hire)** — open **Documents & onboarding**: fill the profile, direct deposit, W-4, I-9, and sign the handbook and agreement.

**4. Dustin (owner)**
1. **Approvals**: approve Jamie's hours, PTO and expenses (receipts open full size).
2. **Payroll**: check the preview, **Process payroll**. Switch back to Jamie: the new paystub is there.
3. **Schedule**: **Add shift**, save, **Publish** (the employee gets a notification). Assign it on a day someone marked unavailable to see the warning.
4. **Bookings**: your visitor booking is here. **Make client & schedule** creates the client and a draft shift. Try **Draft a quote reply**.
5. **Invoices**: **Invoice completed cleanings**, open one, **Send to client**.
6. **Messages**: open a thread, reply, try **Draft a reply with AI**.
7. **Reports**: hours, payroll, revenue; **Hours CSV**.
8. **Team** → a person: their time, pay, profile and docs. **Clients** → a household: SOP, photos, preferences.

**5. Alex Aspen (client)**
1. **Invoices**: **Pay** → choose Venmo/Zelle/Square → mark paid. Dustin sees it paid.
2. **Visits**: **Cancel / reschedule** — the fee shown follows the real policy (48h+ free, 24–48h $20, same day half the visit). A fee creates an invoice; Dustin and the tech are notified.
3. **Request a cleaning**, **Preferences** (pets, notes, preferred cleaner, add-ons, home photos), **Messages**.

**6. Docs (team only)** — as Jamie open **Handbook & SOPs** (as Dustin, **SOPs & docs**): open a handbook, use the table of contents and search, download PDF / Word / Markdown / text, **Ask AI about this doc**. Signed out or as a client, an old `#/docs` link asks you to sign in as staff, and the assistant won't quote internal docs.

**7. Assistant** — the sparkle button. Try: "What's the cancellation fee with 10 hours notice?", "When is my next payday?" (as Jamie), "How much PTO do I have?", "What do I do if I forget to clock out?".

## Automated checks

Run against a local build (`cd app && npm run build && npx vite preview --host 127.0.0.1 --port 4173`). Both use Playwright for Python with Chrome.

```bash
python tools/smoke.py http://127.0.0.1:4173/                 # every public route + every route for each role: no console errors, no blank pages
python tools/flows.py http://127.0.0.1:4173/ ./shots         # 16 end-to-end flows (booking, clock, submit, PTO, AI stub, approvals,
                                                             # payroll, schedule, booking→client, invoices, messages, assistant,
                                                             # client pay, client cancel, staff-only docs, 390px mobile overflow on ~30 screens)
python tools/check_leaks.py <private-docs-dir>               # must print 0 hits before any public push
```

Plus `npm run build` (TypeScript strict) and `npm run lint` (oxlint).
