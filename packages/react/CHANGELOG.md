# @bach/react

## 1.0.0

### Minor Changes

- b38a25d: Sprint 36-37 — `@bach/react` wrapper.

  New package shipping a React 18+/19 binding around the `<bach-player>`
  Custom Element. Three deliberate design choices:

  - SSR-safe for the Next.js App Router. `@bach/core/define` is loaded
    via `import('@bach/core/define')` inside a `useEffect`, so it
    never executes during server rendering. `skipDefine` lets
    consumers opt out when they call `customElements.define`
    themselves.
  - `<BachPlayer ref>` forwards to the underlying Custom Element so
    consumers can call `player.applyTheme(...)`, read `player.state`,
    and listen for `bach:*` CustomEvents directly.
  - `useBachPlayerState(ref, selector)` is the idiomatic React surface
    for the common case — a `useSyncExternalStore`-backed
    subscription that re-renders the consumer only when the selected
    slice changes. `useBachPlayerSnapshot(ref)` returns the full
    snapshot for callers that want everything.

  JSX module augmentation extends `react`'s JSX namespace so
  `<bach-player>` is fully typed alongside the React component.

  Numbers:

  - 7 unit tests (render, defaults, headless, ref forwarding,
    slotted content, hook initial null, hook snapshot after mount).
  - 410+ unit tests across the monorepo.
  - @bach/react size: 752 B brotli / 3 KB budget (react external).

### Patch Changes

- Updated dependencies [6c39365]
- Updated dependencies [b942a5d]
- Updated dependencies [4c04e55]
  - @bach/core@0.1.0
