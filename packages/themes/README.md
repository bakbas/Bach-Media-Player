# @bach/themes

Curated theme presets for Bach Media Player. Five hand-tuned manifests that ship straight into `player.applyTheme()` — or feed straight into the Conducting protocol from `@bach/conduct`.

```bash
pnpm add @bach/themes
```

## Subpath imports (tree-shake friendly)

```ts
import minimal from '@bach/themes/minimal';
import cinematic from '@bach/themes/cinematic';
import broadcast from '@bach/themes/broadcast';
import terminal from '@bach/themes/terminal';
import vintage from '@bach/themes/vintage';

player.applyTheme(cinematic);
```

When you import a single subpath the others are dropped at bundle time — each preset is just a JSON-shaped object so it brotlis to a few hundred bytes.

## Registry import

```ts
import { BACH_THEMES, BACH_THEME_NAMES, getBachTheme } from '@bach/themes';

for (const name of BACH_THEME_NAMES) {
  console.log(name, BACH_THEMES[name].cssVariables?.['--bach-color-accent']);
}

const theme = getBachTheme('vintage');
if (theme) player.applyTheme(theme);
```

## The five presets

| Name | Mood |
|---|---|
| `minimal` | Quiet light theme. Docs / education. |
| `cinematic` | Deep blacks, gold accent, rounded chrome. |
| `broadcast` | High-contrast neutrals, compact red accent. |
| `terminal` | Mono spaced, green-on-black phosphor. |
| `vintage` | Sepia cream + amber accent, pairs with the `@bach/gpu-fx` vintage grade. |

Every preset passes `@bach/core/applyTheme` with zero rejections — the unit suite asserts this so a stray hostile substring can never sneak into a release.

## License

MIT
