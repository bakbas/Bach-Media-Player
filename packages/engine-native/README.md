# @bach/engine-native

Native `HTMLMediaElement` engine adapter for Bach Media Player.

Use this engine when the browser can play the stream directly — Safari / iOS for HLS (no MSE needed), Chrome / Firefox / Safari for progressive MP4 / WebM / Ogg.

```ts
import { createNativeEngine } from '@bach/engine-native';

const engine = createNativeEngine();
// pass it to <bach-player> via the engines registry (Sprint 4+)
```

## Where this fits

The codec negotiator (`selectEngine` in `@bach/core`) walks an ordered engine list. The native engine is normally placed **last** so that `@bach/engine-hls` (hls.js) and `@bach/engine-dash` (Shaka) win on browsers that support Media Source Extensions; native is the iOS / Safari fallback that lets HLS still play.

## Supported sources

- HLS via `.m3u8` URLs — only when `HTMLMediaElement.canPlayType('application/vnd.apple.mpegurl')` reports `maybe` or `probably` (i.e. Safari).
- Progressive `.mp4`, `.webm`, `.ogg` / `.ogv` based on `canPlayType`.

Anything else returns `false` from `canHandle` so the negotiator moves on.

## License

MIT
