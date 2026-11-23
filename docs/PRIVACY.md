# Privacy: what's real, what's fake, what's not here

This repository and the live demo are public. These rules were followed throughout.

## Real (public already, used with permission)

- GIST's name, logo, colors, photos, service descriptions, prices, cancellation policy, testimonials (first names only, as published), contact email/phone and Facebook link — all from gistcleaning.com and GIST's public Facebook page. Rob is building this for GIST and confirmed using them.
- Dustin Sipes as owner (named on the public site).
- The general SOP, both employee handbooks, and the three employment agreement **templates** (blank, unsigned) from GIST's Google Drive.

## Pseudonymized

- **All 28 client SOPs and both project task lists.** Household names are replaced by plant names (Aspen, Birchwood, Camas…), and every street address, phone number, email, door/lockbox code, key location and personal name inside is replaced with invented values. Room-by-room cleaning instructions are kept because they show how GIST works.
- `tools/check_leaks.py` extracts every real name, street, phone and code from the private originals and scans all public files for them; it must report **0 hits** before any push.

## Made up

- Every employee other than Dustin (Jamie, Sam, Taylor), every client household in the app, every address, schedule, time entry, paystub, bank digit, invoice and message.

## Not in this repo

- The real client SOPs, addresses, door codes and home photos. They are kept privately, outside this repository; staff can load them onto their own device with Docs → Import private pack, which stores them in that browser only.
- Anyone's real payroll, tax, bank, SSN, I-9 or W-4 information, and any signed agreement or handbook.
- API keys or tokens. The app's "Export backup" strips any AI key before saving.

If you spot something that looks real and shouldn't be here, open an issue or contact Rob and it will be removed.
