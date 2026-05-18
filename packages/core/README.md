# @bach/core

The orchestrator package: `<bach-player>` Custom Element, signals state, codec capability negotiator, EME orchestrator, plugin host, and theming contract (CSS variables + `::part()` names).

> **Sprint 0 scaffold.** Only the type contracts and state primitives are implemented; the element renders a Shadow DOM skeleton without engine wiring. Real playback lands in Sprint 1–3 (see [`ROADMAP.md`](../../ROADMAP.md)).

## Install

```bash
pnpm add @bach/core
```

## Usage

```ts
import '@bach/core/define';
```

```html
<bach-player src="video.m3u8">
  <video slot="media" crossorigin></video>
</bach-player>
```

## Theming surface

The full list of CSS variables and `::part()` names is exported as `CSS_VARIABLE_TOKENS` and `PART_NAMES` from this package. These names are **public API** and bound by semver after `1.0.0`.

## Headless mode

```html
<bach-player headless src="video.m3u8">
  <video slot="media"></video>
</bach-player>
```

The default chrome is hidden; consumer code reads `player.state` for everything.

## License

MIT
