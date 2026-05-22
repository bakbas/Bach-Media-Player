# @bach/tailwind

## 1.0.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [6c39365]
- Updated dependencies [b942a5d]
- Updated dependencies [4c04e55]
  - @bach/core@0.1.0
