---
---

Playground: skin gallery + the real `@bach/themes` presets.

`apps/playground` now consumes `@bach/themes` as a workspace dep so the
demo themes are literally the published presets, not playground-only
look-alikes.

New on the live demo:

  - **Skin gallery** — one card per preset (`minimal`, `cinematic`,
    `broadcast`, `terminal`, `vintage`, plus a custom `neon`). Each
    card shows the bg / fg / accent swatches pulled straight from the
    manifest, a one-line description, and an Apply button. The active
    skin highlights in both the gallery and the manifest button row.
  - **Auto-cycle skins** — walks every preset on a 2-second tick so a
    reviewer can see the chrome re-skin in place without clicking
    each card.
  - Manifest button row expanded from 4 to 6 entries — the five
    curated presets in their canonical order plus the `neon`
    `oklch()` showcase.

No public package surface changed.
