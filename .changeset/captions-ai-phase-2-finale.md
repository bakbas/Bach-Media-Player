---
'@bach/captions-ai': minor
---

Phase 2 finale — playground integration + privacy E2E coverage.

The captions surface is now reachable from the public playground demo:

- `<bach-captions>` + `<bach-captions-consent>` mounted inside the
  player. The "Enable captions" button surfaces the dialog; accepting
  drives the progress bar to 100 % and feeds a deterministic demo
  transcript into the aligner. Reviewers can verify cue rendering and
  dedupe behaviour without downloading the 39 MB Whisper model.

Playwright suite gains four new specs:

- consent dialog opens on first prompt; denial persists to
  localStorage.
- accept flow drives progress, fills the transcript pane, advances the
  active cue as `currentTime` moves.
- the demo feed can be called twice — the aligner keeps only one of
  each duplicate segment.
- **privacy assertion** — the page is monitored throughout the
  captions flow and any request to a third-party host that uses an
  audio MIME type or an octet-stream POST body is flagged as a leak.
  The default fake-engine demo emits zero such requests; the test
  will fail loudly if a future change introduces a server round-trip.

This closes the `0.2.0-alpha` work for Phase 2 (Notasyon).
