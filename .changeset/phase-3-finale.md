---
'@bach/core': patch
---

Phase 3 finale — docs scaffold and 0.3.0-alpha track.

Adds `apps/docs`, the Astro + Starlight documentation site, with pages
for every shipped surface (Notasyon, Hassasiyet) and preview pages for
the in-development signatures (Polifoni, Akustik, Conducting). Sidebar
groups: "Get started" (intro, installation), "Theming baseline" (CSS
variables, parts, applyTheme), and "Five signatures" (each capability).

No public-API changes — the patch bump on `@bach/core` is only there to
give the release pipeline a marker for the 0.3.0-alpha cut.
