# app/

The GIST Cleaning Hub web app (React 19 + TypeScript + Vite) and its Android wrapper (Capacitor 8). See the [root README](../README.md) for what it is and [../docs](../docs) for decisions, AI, backend and testing.

```bash
npm install
npm run dev        # dev server
npm run build      # type-check + production build to dist/
npm run lint       # oxlint
npm run bridge     # optional AI bridge to your own Claude Code (../docs/AI.md)
npx cap sync android && cd android && ./gradlew assembleDebug   # APK
```

Layout: `src/pages` (Public, Employee, Owner, Client, Shared, Docs), `src/components` (layouts, UI kit, AI chat), `src/lib` (store, payroll engine, dates, geofence, docs, AI providers and skills), `src/data` (website content, generated docs), `public/docs` (downloadable PDF/DOCX/MD/TXT of every doc).
