# Security Policy

## Supported versions

Until `1.0.0` ships, only the latest published `alpha` / `beta` is covered. After `1.0.0`, the latest minor and the previous minor receive security patches.

## Reporting a vulnerability

**Do not file public GitHub issues for security problems.** Use GitHub's [private security advisory flow](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) on this repository.

Expected response timeline:

- Acknowledgement within 72 hours.
- Triage and severity rating within 7 days.
- Fix or mitigation plan within 30 days for high-severity reports.

Credit is given in the published advisory unless the reporter prefers anonymity.

## Threat model

Bach Media Player runs in the user's browser. The three main attack surfaces are:

### 1. DRM key handling (Phase 1+)

- License responses and CDM messages are passed verbatim to the EME stack — they are not parsed, logged, or persisted.
- License server URLs are sourced from the page's HTML / JS and are treated as trusted by definition (same origin / page operator).
- We never embed or vend a content key. Reports of key-leak vectors in the EME orchestrator are critical-severity.

### 2. AI captions privacy (Phase 2)

- Audio frames stay inside the browser process. Worker code that handles audio is forbidden from importing networking APIs.
- The privacy assertion E2E test monitors all network activity during caption generation and fails on any outbound request that carries audio bytes.
- Model downloads are user-initiated via an opt-in dialog with explicit size disclosure. URLs are pinned by hash.

### 3. Conduct manifests (Phase 5) — the highest-risk subsystem

The conduct protocol lets a remote actor change every viewer's UI in real time. The sandbox is the security boundary.

**Invariants (enforced before apply):**

1. **Schema-strict parsing.** Unknown top-level keys, unknown CSS variable names, and unknown layout enum values are rejected. The parser is the security boundary, not the renderer.
2. **Per-type value regex.** Color, length, percentage, font-family, and enum values are matched against narrow regexes. Anything that contains `<`, `>`, `;`, `url(`, `expression(`, `script`, `style`, `data:`, `javascript:` is rejected.
3. **No raw HTML, no raw CSS strings, no JS.** A manifest cannot declare `--bach-custom-css`, an HTML fragment, or an event handler. Only the published variable / enum surface is reachable.
4. **Ed25519 signature verification.** Each manifest is verified against the broadcaster public key the viewer was configured with (`verify-key` attribute on `<bach-conduct>`). Signature mismatch → silent drop + `bach:conduct-rejected` event.
5. **Rate limiting.** Viewer drops manifests that arrive faster than `N` per second (configurable; default 10). Prevents flicker / seizure attacks via rapid colour swaps.
6. **Photosensitive epilepsy guard.** Optional `prefers-reduced-motion` aware mode caps the rate of background-color and contrast deltas.
7. **Fuzz testing.** The release pipeline runs ≥ 1000 randomly-mutated manifests against the parser; any non-rejection of a non-conforming input is a release blocker.

The reference relay (`examples/conduct-relay-cf/`) is illustrative only — operators must apply their own auth, abuse handling, and DDoS protection.

## Reporting in the open

If a reported issue turns out to be a known browser bug rather than a Bach bug, we will document it in `ROADMAP.md` and (where reasonable) ship a guard. Examples we've already considered:

- iOS WKWebView lying about HLS support → handled by `engine-native` fallback.
- WebGPU exposing GPU adapter strings → we never read them.
- WebCodecs surfacing decryption errors on partially-encrypted streams → we route through EME first.
