# @bach/themes

## 1.0.0

### Minor Changes

- 6d83fc5: Sprint 32 — Theme Universe foundations.

  New package `@bach/themes` ships five curated theme manifests as both
  a registry import and per-preset subpath exports so consumers who only
  want one preset pay just for that one.

  Presets:

  - `minimal`: quiet light theme. Docs / education default.
  - `cinematic`: deep blacks, gold accent, rounded chrome.
  - `broadcast`: high-contrast neutrals, compact red accent.
  - `terminal`: mono spaced, green-on-black phosphor.
  - `vintage`: sepia cream + amber accent, designed to pair with the
    `@bach/gpu-fx` vintage colour grade.

  Surface:

  - `import minimal from '@bach/themes/minimal'` — one preset, ~194 B
    brotli, no other presets included.
  - `import { BACH_THEMES, BACH_THEME_NAMES, getBachTheme } from
'@bach/themes'` — full registry for iterating presets.
  - Every preset is unit-tested against the real `@bach/core/
applyTheme` parser — zero rejections, every declared CSS variable
    lands. Catches a hostile string sneaking into a release before
    it ships.

  Numbers:

  - 8 unit tests (registry + 5 per-preset apply check).
  - 400+ unit tests across the monorepo.
  - Sizes (brotli): full index 595 B / 4 KB; single preset 194 B / 1 KB.

### Patch Changes

- Updated dependencies [6c39365]
- Updated dependencies [b942a5d]
- Updated dependencies [4c04e55]
  - @bach/core@0.1.0
