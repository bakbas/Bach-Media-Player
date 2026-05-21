---
---

Live playground on GitHub Pages.

`master` push now builds `apps/playground` and deploys it to
`https://bakbas.github.io/Bach-Media-Player/`. Visitors land on the
real `<bach-player>` element wired through `@bach/engine-hls` +
`@bach/engine-native`, with:

  - **Sample source picker** — five publicly hosted demo streams:
    HLS Tears of Steel (Mux), HLS PTS-shift test, Apple BipBop
    multi-bitrate, MP4 Big Buck Bunny, MP4 Sintel. The picker tells
    you which engine resolved the source so the adapter switch is
    visible.
  - Five theme presets — Default, Cinematic, Minimal, Neon, plus
    a paste-your-own-manifest editor that surfaces the parser's
    per-key diagnostic.
  - GPU FX preset chain — Cinematic, Broadcast, Vintage, Minimal,
    Off. The pipeline spec is printed verbatim so reviewers see the
    same data structure the WebGPU runtime consumes.
  - AI captions consent + transcript demo (no network bytes leave
    the device).
  - AI theme assist — builds the exact Claude API request a model
    would receive, including the documented CSS variable contract.
  - Headless mode toggle + live state read-out.

No public package surface changed. The Vite `base` now reads from
`VITE_BASE` so the same build artefact works locally (`/`) and under
the repo subpath on Pages (`/Bach-Media-Player/`).
