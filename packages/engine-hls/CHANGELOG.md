# @bach/engine-hls

## 1.0.0

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

- Updated dependencies [6c39365]
- Updated dependencies [b942a5d]
- Updated dependencies [4c04e55]
  - @bach/core@0.1.0
