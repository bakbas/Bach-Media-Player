# @bach/tailwind

Tailwind preset plugin that exposes the public Bach Media Player CSS variable contract as Tailwind theme tokens. Works with Tailwind 3 and 4.

```bash
pnpm add @bach/tailwind
```

```ts
// tailwind.config.ts
import bach from '@bach/tailwind';

export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  presets: [bach()],
};
```

```html
<button class="bg-bach-accent text-bach-bg rounded-bach-radius px-bach-control-gap">
  Play
</button>
```

## What lands where

- **Colors** — every `--bach-color-*` token, exposed as `bg-bach-*` / `text-bach-*` etc., minus the `color-` prefix: `bach-bg`, `bach-fg`, `bach-accent`, `bach-muted`, `bach-progress-track`, `bach-progress-fill`, `bach-progress-buffer`, `bach-overlay-bg`.
- **Border radius** — `--bach-radius` → `rounded-bach-radius`.
- **Spacing** — every `--bach-*` length token that isn't `radius`, exposed as `p-bach-control-size`, `gap-bach-control-gap`, etc.
- **Font family** — `font-bach-family` (`--bach-font-family`).
- **Font size** — `text-bach-size` (`--bach-font-size`).

A unit test asserts every documented token is reachable from at least one Tailwind class, so adding a new variable to `@bach/core/theming` automatically widens the preset.

## License

MIT
