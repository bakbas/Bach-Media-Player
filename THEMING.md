# Theming Bach Media Player

Bach is theme-first. Every surface a viewer sees is either a CSS custom
property the host page can rewrite, a `::part()` you can fully restyle,
or a slot you can replace with your own component. Headless mode drops
the chrome entirely so a framework UI can wrap the engine directly.

This document is the public contract. Anything listed here is covered by
semver: removing a token, a part name, or a slot is a breaking change.

## Four ways to style

| Surface | Power | When to reach for it |
|---|---|---|
| **CSS variables** | Tweak colours, radii, sizes via tokens. | 80 % of cases. AI assistants, designers, vibe coders. |
| **`::part()` selectors** | Fully restyle a control. | You want a square play button instead of a round one. |
| **Slot replacement** | Swap a whole control block. | You ship custom progress, captions, settings UI. |
| **Headless mode** | Render zero chrome; consume state directly. | React/Vue/Svelte teams that already own the UI. |

## CSS variable tokens

Every Bach token starts with `--bach-*`. Override them on `:root`, on
the `<bach-player>` element, or anywhere in the cascade above the player.
They are also exported from `@bach/themes` for typed consumption.

| Token | Type | Description |
|---|---|---|
| `--bach-color-bg` | color | Player chrome background. |
| `--bach-color-fg` | color | Primary foreground / icon colour. |
| `--bach-color-accent` | color | Brand accent — progress fill, focus rings, active states. |
| `--bach-color-muted` | color | Secondary text and inactive icons. |
| `--bach-radius` | length | Corner radius shared by buttons, chips, panels. |
| `--bach-control-size` | length | Hit-target edge length for tappable controls. |
| `--bach-control-gap` | length | Gap between adjacent controls in the chrome. |
| `--bach-progress-track` | color | Progress bar track (unfilled portion). |
| `--bach-progress-fill` | color | Progress bar fill (played portion). |
| `--bach-progress-buffer` | color | Progress bar buffered indicator. |
| `--bach-font-family` | font-family | Player typography stack. |
| `--bach-font-size` | length | Base font size for time displays and labels. |
| `--bach-overlay-bg` | color | Translucent overlay background (loading, error, menus). |
| `--bach-overlay-blur` | length | Backdrop-filter blur radius for overlays. |

### Accepted value formats

The parser used by `applyTheme()` and the conducting sandbox enforces the
type column. Anything outside is rejected silently.

- **color:** `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`/`rgba()`, `oklch()`,
  `color-mix()`, `currentcolor`, `transparent`. Hex notation with leading
  `#`, function notation with parentheses only — no expression syntax.
- **length:** integer or decimal, optional unit `px | rem | em | % | vh | vw`.
- **font-family:** word characters, spaces, commas, hyphens, single or
  double quotes. No `url()` references — fonts must be loaded via the
  page's stylesheet.

Forbidden in every value (the security boundary):
`<`, `>`, `{`, `}`, `;`, `url(`, `expression(`, `javascript:`, `data:`,
`@import`, `@charset`.

## `::part()` map

```css
bach-player::part(chrome)              /* outer chrome container */
bach-player::part(play-button)         /* play CTA */
bach-player::part(pause-button)        /* pause CTA */
bach-player::part(progress-bar)        /* progress bar root */
bach-player::part(progress-thumb)      /* drag thumb */
bach-player::part(timeline)            /* timeline frame strip */
bach-player::part(volume-slider)       /* volume slider */
bach-player::part(volume-button)       /* volume mute toggle */
bach-player::part(caption-overlay)     /* caption layer */
bach-player::part(caption-cue)         /* a single cue line */
bach-player::part(settings-menu)       /* settings popover */
bach-player::part(fullscreen-button)   /* fullscreen toggle */
bach-player::part(pip-button)          /* picture-in-picture toggle */
bach-player::part(time-display)        /* currentTime / duration */
```

Use parts for property-level overrides. Need to replace the whole block?
Use slots.

## Slots

```html
<bach-player src="show.m3u8">
  <video slot="media" crossorigin></video>          <!-- replace media element -->
  <bach-controls slot="controls"></bach-controls>   <!-- replace control bar -->
  <bach-captions slot="captions"></bach-captions>   <!-- replace caption layer -->
  <div slot="overlay">Custom HUD</div>              <!-- arbitrary overlay -->
</bach-player>
```

Each slot accepts any element. Bach does not inspect or sanitise slotted
content beyond the standard custom-element lifecycle — it is yours.

## Headless mode

```html
<bach-player headless src="show.m3u8"></bach-player>
```

`headless` skips chrome rendering entirely. State and the controller API
remain available; pair it with `@bach/react`, your own React/Vue/Svelte
components, or vanilla JavaScript that reads state via signals.

## Theme manifests

Bach also accepts a JSON theme manifest at runtime:

```ts
import { applyTheme } from '@bach/core';

applyTheme(player, {
  version: 1,
  cssVariables: {
    '--bach-color-accent': 'oklch(0.7 0.2 250)',
    '--bach-radius': '12px',
  },
  layout: 'cinematic',
});
```

The manifest schema is strict: unknown top-level keys, unknown variable
names, mistyped values, or any token in the forbidden list above causes
the value to land in `result.rejected` instead of being applied. The
function never throws and never partially applies a malformed manifest.

`@bach/conduct` uses the same parser to apply broadcaster-pushed themes
to every connected viewer — the parser is the security boundary, and
the fuzz harness in `packages/conduct/src/fuzz.ts` proves it against
340+ malicious payloads.

## Tailwind preset

```js
// tailwind.config.js
import bach from '@bach/tailwind';

export default {
  presets: [bach()],
};
```

The preset registers every Bach token as a Tailwind colour / spacing /
font utility, so `bg-bach-accent` resolves to `var(--bach-color-accent)`
without further wiring.

## AI hints — `llms.txt`

The repo root ships an `llms.txt` map for AI vibe coders. It enumerates
every package, every CSS variable, every part name, and links the
relevant docs. Feed it to an assistant and ask "make a neon synthwave
theme" — the resulting manifest will satisfy the parser on the first
try.

## Five curated themes

`@bach/themes` exports five drop-in presets, each tree-shakable on its
own import path:

- `@bach/themes/minimal` — quiet greys, sharp corners, system font.
- `@bach/themes/cinematic` — wide letterboxed chrome, warm accent.
- `@bach/themes/broadcast` — news-room layout, high-contrast progress.
- `@bach/themes/terminal` — monospace, phosphor green, square corners.
- `@bach/themes/vintage` — sepia chrome, rounded corners, serif type.

```html
<link rel="stylesheet" href="https://unpkg.com/@bach/themes/cinematic.css" />
<bach-player src="show.m3u8" theme="cinematic"></bach-player>
```

## Stability promise

Up to `1.0.0` the token names, part names, and slot names listed here
may rename with a minor bump. After `1.0.0` they are frozen — renames
require a major bump. The accepted value grammar may widen (additive)
but never narrow. New tokens and parts arrive with a minor bump and a
documented default.
