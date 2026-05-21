# @bach/playground

Interactive Vite playground used to develop, demo, and E2E-test Bach Media Player. Not published.

**Live:** [bakbas.github.io/Bach-Media-Player](https://bakbas.github.io/Bach-Media-Player/) — built and deployed by the `Pages` workflow on every push to `main`.

```bash
pnpm --filter @bach/playground dev
# → http://127.0.0.1:5173

pnpm --filter @bach/playground build
pnpm --filter @bach/playground preview
# → http://127.0.0.1:4173
```

## What's in it

- `<bach-player>` loading a public Mux HLS test stream, with every default UI control slotted into `<bach-controls>`.
- **Sample source picker** — switch between five publicly hosted test streams (HLS Tears of Steel, HLS PTS-shift, Apple BipBop, MP4 Big Buck Bunny, MP4 Sintel) to see HLS adapter + native engine selection live.
- Four theme presets — Default, Cinematic, Minimal, Neon — that exercise the four documented value shapes and the three layout enum values.
- Free-form manifest editor: paste any `theme.json` and `applyTheme()` returns a precise per-key diagnostic in the output panel. The same parser is the security boundary for the Phase 5 conducting protocol.
- Headless toggle: flips the `headless` attribute on the player, hiding the default controls slot while leaving state queryable.
- Live state read-out so it is obvious which signals are wired.

## E2E tests

Run from the repo root:

```bash
pnpm test:e2e
```

Playwright builds and previews this app, then drives Chromium / Firefox / WebKit through the flows in `e2e/specs/playground.spec.ts`.
