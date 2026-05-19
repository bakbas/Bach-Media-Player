# @bach/conduct

The **Conducting** signature — live director mode for Bach Media Player. A livestreamer changes every viewer's UI in real time by pushing signed theme manifests through a WebSocket relay. The viewer verifies each manifest with Ed25519, runs it through rate / replay / reduced-motion guards, and hands it to `<bach-player>.applyTheme()` — which already enforces the schema sandbox from Phase 1.

> **Phase 5 / Sprint 28-30.** This slice ships the wire protocol, signing, guards, viewer controller, and the `<bach-conduct>` element. The broadcaster SDK and director SPA (`apps/director`) land in Sprint 31.

## Quick start (viewer)

```bash
pnpm add @bach/conduct
```

```ts
import '@bach/core/define';
import '@bach/conduct/define';
```

```html
<bach-player>
  <video slot="media"></video>
  <bach-conduct
    channel="wss://stream.example/conduct/abc"
    verify-key="base64url-encoded-Ed25519-public-key"
  ></bach-conduct>
</bach-player>
```

The element will dispatch:

- `bach:conduct-applied` — every accepted manifest, with `{ result, frame }`.
- `bach:conduct-rejected` — every dropped frame, with `{ reason, frame }`.

## Security model

1. **Schema sandbox** (inherited from `@bach/core/applyTheme`). Manifests can only set documented CSS variables and layout enum values; arbitrary HTML / script / CSS is rejected at the parser, not the renderer.
2. **Ed25519 signature** over the canonical-JSON form of the manifest. The viewer recomputes the canonical string before verifying so reordering keys does not affect the signature.
3. **Sequence guard** drops replays and out-of-order frames.
4. **Rate limiter** (default 10 manifests/s) defends against strobe / flicker attacks.
5. **`prefers-reduced-motion` damper** clamps colour deltas when the host signals reduced motion.
6. **Fuzz suite** (Sprint 31) — 1000+ malicious manifests, XSS leakage must remain at zero.

## License

MIT
