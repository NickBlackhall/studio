---
name: verify
description: Build, run, and drive Make It Terrible in a headless browser to verify changes at the real surface (PWA/service-worker behavior, image loading, UI rendering).
---

# Verifying Make It Terrible

## Build + run (production)

`NODE_ENV=development` is exported globally in this Codespace, so always
force production:

```bash
NODE_ENV=production npm run build        # also regenerates public/sw.js (gitignored)
NODE_ENV=production npx next start -p 9100   # background it; ready in ~2s
```

`.env.local` exists and points at the live Supabase project — the main menu
renders without touching the DB; creating/joining rooms writes to the LIVE
database, so keep verification to read-only screens unless a live test room
is intended.

## Headless browser (no Playwright in the repo — it was removed)

Playwright browser binaries survive in `~/.cache/ms-playwright/`
(chromium build 1181 = playwright 1.54.x). Install the matching driver in
the scratchpad, NOT the repo:

```bash
cd <scratchpad> && npm i playwright-core@1.54.2
```

Then `const { chromium } = require('playwright-core'); chromium.launch()`
works with the cached browser. Use viewport 390x844 (app is phone-frame-locked).

## Gotchas that cost time

- **The app's own SW auto-registration does not fire in headless chromium**
  (works on real devices). Register manually in page context:
  `navigator.serviceWorker.register('/sw.js')`, then poll
  `caches.keys()` for `workbox-precache-*` and count entries.
- **Workbox precache install is all-or-nothing**: one 404 in the manifest
  makes the SW go `installing → redundant` silently, with zero caches
  created. If precache never fills, extract `url:"..."` entries from
  `public/sw.js` and fetch each (with `?__WB_REVISION__=` param) from page
  context to find the failing one. This is how the fatal
  `/_next/app-build-manifest.json` 404 (next-pwa + App Router bug) was found.
- Expected steady state: precache = 130 entries (97 art + chunks/fonts/icons),
  `navigator.serviceWorker.controller` truthy after reload.
- Good offline/flicker probe: `context.route(/\/(ui|backgrounds|textures)\//,
  r => r.abort())`, reload, then check every `img` has
  `complete && naturalWidth > 0` — proves art serves from SW cache.
- Three art filenames contain literal spaces (`/ui/judge badge v2.webp` etc.);
  curl needs them %-encoded, browsers handle them automatically.

## Flows worth driving

- `/` main menu: background poster + button art (fastest art surface).
- Art request shape: with `images.unoptimized: true` there must be ZERO
  `/_next/image` requests — everything raw `/ui/...`, `/backgrounds/...`,
  `/textures/...`.
