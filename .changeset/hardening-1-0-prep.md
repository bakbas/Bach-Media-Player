---
---

Sprint 40-41 — 1.0.0 hardening + release-gate plumbing.

Repo-level changes (no package versions bumped).

CI:
  - New `release-gate` workflow bundles lint, typecheck, build, every
    unit suite (including the conduct fuzz harness), an isolated rerun
    of the fuzz harness, and the size-limit budget into one
    release-blocking gate. Runs on every push to `main` and on PRs
    labelled `release-ready`.
  - New `codeql` workflow runs GitHub's `security-extended` query suite
    on every push, every PR, and weekly on Monday at 06:00 UTC.

Documentation:
  - New top-level `THEMING.md` — the public theming contract.
    Enumerates every `--bach-*` token (with accepted value grammar),
    every `::part()` name, every slot, headless mode, the runtime
    manifest schema, the Tailwind preset, and the stability promise.
  - New top-level `RELEASING.md` — release-blocking gates table and
    the 1.0.0 readiness checklist (frozen contracts, coverage gate,
    fuzz zero-leakage, axe-core clean, CodeQL clean, BrowserStack iOS
    nightly green, docs full content).
  - `apps/docs/src/content/docs/releasing.mdx` — same content on the
    docs site, wired into the sidebar under "Operating".
  - `README.md` links updated for `THEMING.md` and `RELEASING.md`.
  - `llms.txt` updated so AI vibe coders find the theming contract on
    the first hop and know about the release gate.

No public package surface changed.
