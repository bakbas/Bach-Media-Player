# @bach/core

## 0.1.0

### Minor Changes

- 6c39365: Phase 1 alpha — MVP core + theming baseline.

  - `<bach-player>` Custom Element with signals state, codec negotiator
    (MediaCapabilities-driven), EME orchestrator (pure state machine),
    and video binding.
  - Three engine adapters as opt-in peer-dependency packages:
    `@bach/engine-native` (Safari/iOS HLS, progressive MP4/WebM),
    `@bach/engine-hls` (hls.js), `@bach/engine-dash` (Shaka).
  - `@bach/ui` Web Components controls: play, progress, volume, time,
    fullscreen, controls container. Stable `::part()` names + ARIA-
    correct + keyboard accessible.
  - `@bach/a11y` keyboard shortcut map (YouTube-style: Space/k, m, f,
    j/l, arrows, 0-9), focus-trap helpers for the fullscreen flow.
  - Theming baseline: 14 documented CSS variables, 14 stable parts,
    slot composition, `headless` attribute, runtime
    `player.applyTheme(themeJson)` with schema-strict validation —
    the same validator that will gate the Phase 5 conducting sandbox.
  - Apps/playground demo: HLS playback, 4 theme presets, free-form
    manifest editor, headless toggle, live state read-out.

### Patch Changes

- b942a5d: Phase 3 finale — docs scaffold and 0.3.0-alpha track.

  Adds `apps/docs`, the Astro + Starlight documentation site, with pages
  for every shipped surface (Notasyon, Hassasiyet) and preview pages for
  the in-development signatures (Polifoni, Akustik, Conducting). Sidebar
  groups: "Get started" (intro, installation), "Theming baseline" (CSS
  variables, parts, applyTheme), and "Five signatures" (each capability).

  No public-API changes — the patch bump on `@bach/core` is only there to
  give the release pipeline a marker for the 0.3.0-alpha cut.

- 4c04e55: Phase 5 finale — Theme Universe completed.

  Three closing pieces land together so the 0.5.0-beta cut covers the
  full Conducting + Theme Universe scope.

  - New package `@bach/tailwind` (424 B brotli / 2 KB budget): preset
    plugin exposing every documented Bach token as a Tailwind theme
    entry under the `bach-*` namespace. Works for both Tailwind 3 and 4. A unit test asserts every entry in `CSS_VARIABLE_TOKENS` is
    reachable from at least one Tailwind class, so adding a future
    variable to `@bach/core` automatically widens the preset.
  - New top-level `llms.txt`: ML-readable map of the project. Each
    package, signature, demo, and security doc is linked with one-line
    intent so vibe coders can find the right surface in a single
    prompt. Follows the emerging `llms.txt` convention.
  - Playground gains an "AI theme assist" panel: a free-form prompt
    becomes the exact Claude API request a model would receive —
    system prompt with the documented variable contract, anti-XSS
    guardrails, and an output-format constraint — rendered verbatim so
    consumers can paste it into their own Anthropic SDK call or a
    Workers AI gateway.
