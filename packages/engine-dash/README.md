# @bach/engine-dash

DASH engine adapter for Bach Media Player, backed by [Shaka Player](https://github.com/shaka-project/shaka-player).

```bash
pnpm add @bach/engine-dash shaka-player
```

`shaka-player` is a peer dependency — you control the version, and when this engine is not used the bytes never reach your bundle.

## Usage

```ts
import * as shaka from 'shaka-player';
import { createDashEngine } from '@bach/engine-dash';

const engine = createDashEngine({ shaka });
```

The engine implements the `MediaEngine` interface from `@bach/core` — `canHandle`, `attach`, `load`, `destroy`, plus `on('ready' | 'durationchange' | 'progress' | 'error', ...)`. Internally it forwards Shaka's `loaded` and `error` events.

## License

MIT
