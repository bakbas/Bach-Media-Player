# @bach/engine-hls

HLS engine adapter for Bach Media Player, backed by [hls.js](https://github.com/video-dev/hls.js).

```bash
pnpm add @bach/engine-hls hls.js
```

`hls.js` is a peer dependency — you control the version, and when this engine is not used the bytes never reach your bundle.

## Usage

```ts
import Hls from 'hls.js';
import { createHlsEngine } from '@bach/engine-hls';

const engine = createHlsEngine({ Hls });
```

The engine implements the `MediaEngine` interface from `@bach/core` — `canHandle`, `attach`, `load`, `destroy`, plus `on('ready' | 'durationchange' | 'progress' | 'error', ...)`. Internally it forwards `MANIFEST_PARSED`, `LEVEL_LOADED`, and fatal `ERROR` events from hls.js.

## On Safari / iOS

`Hls.isSupported()` returns `false` because WKWebView lacks MSE. The codec negotiator should fall through to `@bach/engine-native`, which lets `<video>` handle the `.m3u8` directly.

## License

MIT
