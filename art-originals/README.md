# Original art (pre-WebP)

The source PNG/JPG files for everything in `public/ui`, `public/backgrounds`, and
`public/textures`, kept at their original resolution and quality.

These are **not** referenced by the app and **not** served to players. They live
outside `public/` on purpose: anything under `public/` gets deployed, and the PWA
service worker used to precache all of it — which meant every player downloaded
~208 MB of art on their first visit.

The shipped art is the WebP alongside each original's old path (same name, `.webp`
extension), converted at quality 82 with dimensions unchanged. That took the art
from 204 MB to 33 MB with no visible quality loss.

## Regenerating the WebP files

If you re-export or replace a source image, drop it here and reconvert:

```js
// npx node -e with sharp (already a dependency via Next)
const sharp = require('sharp');
sharp('art-originals/ui/example.png')
  .webp({ quality: 82 })
  .toFile('public/ui/example.webp');
```

Keep the filename identical apart from the extension — the app references
`/ui/example.webp`, and `src/lib/assets.ts` maps database-stored avatar paths
(which still contain `.png`) onto the `.webp` files at render time.
