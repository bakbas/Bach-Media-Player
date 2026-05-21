# @bach/react

React wrapper around the `<bach-player>` Custom Element. Works with React 18 and 19; SSR-safe for the Next.js App Router because the `customElements.define` call is deferred to a client-side `useEffect`.

```bash
pnpm add @bach/react @bach/core react react-dom
```

```tsx
'use client';
import { type BachPlayerElement } from '@bach/core';
import { BachPlayer, useBachPlayerState } from '@bach/react';
import { useRef } from 'react';

export function Player() {
  const ref = useRef<BachPlayerElement>(null);
  const paused = useBachPlayerState(ref, (s) => s.paused);

  return (
    <BachPlayer ref={ref} src="video.m3u8" muted>
      <video slot="media" crossOrigin="anonymous" />
      <p>Status: {paused ? 'paused' : 'playing'}</p>
    </BachPlayer>
  );
}
```

## Surface

- `<BachPlayer src muted autoplay headless skipDefine />` — forwards every prop to the underlying Custom Element. `skipDefine` opts out of the lazy `@bach/core/define` import when you mount it yourself.
- `useBachPlayerState(ref, selector)` — `useSyncExternalStore`-backed subscription to a single slice of the player's signals state.
- `useBachPlayerSnapshot(ref)` — sugar that returns the full snapshot.

## Notes for Next.js App Router

`@bach/core/define` is loaded via `import('@bach/core/define')` inside a `useEffect`, so it never executes during server rendering. Either mark the host component `'use client'` or load `<BachPlayer />` inside `next/dynamic` with `ssr: false`.

## License

MIT
