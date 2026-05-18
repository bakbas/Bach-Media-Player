# Contributing to Bach Media Player

Bach is a one-maintainer project that aims to grow into a community-driven codebase. The contribution rules below are deliberately lightweight so that the first wave of contributors can land changes without ceremony.

## Prerequisites

- **Node.js** ≥ 20.11 (LTS 20 or 22).
- **pnpm** ≥ 9.0 — install via `corepack enable && corepack prepare pnpm@latest --activate`.
- **Git** ≥ 2.40 (lefthook needs modern hooks).

## Bootstrapping

```bash
git clone https://github.com/bakbas/Bach-Media-Player.git
cd Bach-Media-Player
pnpm install
pnpm exec playwright install --with-deps chromium firefox webkit
pnpm exec lefthook install
```

`pnpm install` runs `prepare` which installs lefthook git hooks (pre-commit: Biome check + typecheck on changed files).

## Day-to-day commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Run the playground with watch builds on every package. |
| `pnpm build` | Build every package via Turborepo (dual ESM+CJS + `.d.ts`). |
| `pnpm test` | Vitest unit suite across packages. |
| `pnpm test:browser` | Vitest browser mode component tests. |
| `pnpm test:e2e` | Playwright E2E (Chromium / Firefox / WebKit). |
| `pnpm coverage` | Coverage report (target ≥ 85 % per package). |
| `pnpm lint` | Biome check (`--write` to autofix). |
| `pnpm typecheck` | TypeScript noEmit across the monorepo. |
| `pnpm size` | size-limit gate on built bundles. |
| `pnpm changeset` | Record a version bump intention. |

## Branching

Default branch: `main`. Topic branches: `feat/<scope>-<short-name>`, `fix/<scope>-<short-name>`, `chore/<short-name>`. Cloud development happens on the per-session branch (e.g. `claude/research-video-player-Y21yI`) and is merged into `main` via PR.

## Commit style

[Conventional Commits](https://www.conventionalcommits.org/) with these scopes:

- `core`, `engine-hls`, `engine-dash`, `captions-ai`, `seek-frame`, `audio-mix`, `gpu-fx`, `ui`, `a11y`, `themes`, `tailwind`, `conduct`, `analytics`, `react`, `testing`, `playground`, `docs`, `e2e`, `repo`.

Example: `feat(core): add codec capability negotiator with MediaCapabilities fallback`.

Breaking changes: append `!` after the scope or add a `BREAKING CHANGE:` footer.

## Changesets

Every user-facing change in a published package needs a changeset:

```bash
pnpm changeset
```

Select the affected packages, bump type (`patch` / `minor` / `major`), and a one-line summary. CI fails on PRs that change `packages/**/src/**` without a changeset.

## Tests

- **Unit tests** live next to source: `src/foo.ts` ↔ `src/foo.test.ts`. Use Vitest with happy-dom unless you need a real browser.
- **Component tests** (Shadow DOM-sensitive) live in `*.browser.test.ts` and run via Vitest browser mode + Playwright provider.
- **E2E tests** live in `e2e/specs/`. Synthetic media fixtures live in `e2e/fixtures/` — only CC0 / self-generated assets, never copyrighted content.

Coverage gate is 85 % statements per package. PRs that drop below this number must justify it in the description.

## Bundle size

`@bach/core` must stay under 100 KB gzipped. Other packages have their own budgets in their `package.json` `size-limit` field. The size-limit job is a release blocker.

## Pull requests

- One feature per PR. Split unrelated changes.
- Fill out the PR template (auto-populated from `.github/pull_request_template.md`).
- Mark the PR as draft until CI is green.
- Request review only after self-review of the diff.

## Reporting bugs / asking questions

- **Security issues:** see [`SECURITY.md`](./SECURITY.md) — do not open public issues.
- **Bug reports:** GitHub Issues with reproduction (CodeSandbox, StackBlitz, or local repo).
- **Feature ideas / design discussion:** GitHub Discussions (enabled from Phase 3 onward).

## Code of Conduct

This project adopts the [Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Be excellent to each other; harassment, discrimination, and personal attacks earn an immediate ban.
