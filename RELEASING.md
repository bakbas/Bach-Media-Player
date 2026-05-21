# Releasing Bach Media Player

Bach is released package-by-package via [changesets]. Every PR that
ships user-visible behaviour carries one or more `.changeset/*.md`
files; merging into `main` opens a "Version Packages" PR that bumps
versions and writes changelogs, and merging that PR publishes to npm.

[changesets]: https://github.com/changesets/changesets

## Cutting a release

1. Open the auto-generated **Version Packages** PR.
2. Confirm it includes every changeset since the last release.
3. Review the bumped versions — minor for features, patch for fixes,
   major for breaking changes (post-1.0 only).
4. Merge. The `release` workflow runs `pnpm release`, which builds
   every package then runs `changeset publish`.
5. Tag the matching GitHub release notes from the workflow output.

## Release-blocking gates

The `release-gate` workflow runs on every push to `main` and on PRs
labelled `release-ready`. A release cannot ship until every job is
green.

| Gate | What it asserts |
|---|---|
| `pnpm lint` | Biome lint and format checks pass. |
| `pnpm typecheck` | Every package's `tsc --noEmit` passes against the strict root tsconfig. |
| `pnpm build` | Every package builds dual ESM+CJS+`.d.ts`. |
| `pnpm test` | All unit suites pass — including the conduct fuzz harness (340+ payloads, zero leakage). |
| `pnpm --filter @bach/conduct test -- fuzz` | The fuzz harness is run again in isolation, so a noisy aggregate cannot hide a regression. |
| `pnpm size` | Every package stays within its size-limit budget (see each `package.json#size-limit`). |
| CodeQL `security-extended` | No new security findings from GitHub's hosted analysis. |
| Playwright E2E | Chromium / Firefox / WebKit smoke flows pass — including theming and headless mode demos. |

## 1.0.0 preparation

Before cutting `1.0.0`, the following must hold. Use this as a
literal checklist during the freeze.

- [ ] **Token contract frozen.** Every `--bach-*` variable in
      `THEMING.md` matches `packages/core/src/theming.ts`; no
      renames pending.
- [ ] **Part name contract frozen.** Same as above for `PART_NAMES`.
- [ ] **Slot contract frozen.** `<bach-player>` accepts only the slots
      documented in `THEMING.md`.
- [ ] **Public exports audited.** Every `index.ts` re-exports only the
      surface listed in the package README; no leaks.
- [ ] **`@bach/core` < 100 KB gzip.** Size-limit budget holds with
      every default-on feature enabled.
- [ ] **Coverage ≥ 85 %** for every package shipped to npm. Run
      `pnpm coverage` and inspect the HTML report.
- [ ] **Conduct fuzz suite zero leakage.** Run
      `pnpm --filter @bach/conduct test -- fuzz`; the run must end
      with `failures: 0`.
- [ ] **axe-core a11y audit clean** on the playground for every theme
      preset and for headless mode. Track open findings in
      `docs/a11y-audit.md`.
- [ ] **CodeQL clean.** No open `code-scanning` alerts in the
      `security` tab.
- [ ] **BrowserStack iOS nightly green.** Last seven runs must be
      passing — WebKit on Playwright is not enough on its own.
- [ ] **Docs full content.** Every package referenced by `FEATURES.md`
      has a corresponding page under `apps/docs/src/content/docs`.
      `llms.txt` regenerated from the live token contract.
- [ ] **CHANGELOG entries written by hand for any major migration.**
      `changeset` notes are enough for minor/patch; majors deserve
      a paragraph of upgrade guidance in the affected package's
      CHANGELOG.
- [ ] **No `0.x` pre-release tags floating.** Yank or promote.

Only after every box above is checked does the maintainer run:

```bash
pnpm changeset pre exit       # leave any pre-release line
pnpm changeset                 # author the final 1.0.0 changeset
pnpm changeset version         # bump versions, write changelog
git commit -am "chore: release 1.0.0"
pnpm release                   # build + publish
```

## Post-1.0 stability

After `1.0.0`:

- Any rename or removal in the lists in `THEMING.md` is a **major**
  bump for the affected package.
- Adding a token, part, or slot is a **minor** bump with a documented
  default.
- Loosening a regex in the theme parser (accepting more values) is a
  **minor** bump. Tightening it is **major** unless the previously
  accepted values were a security regression.
- The conduct wire protocol version (`bach.conduct.v1`) is fixed for
  the 1.x line. `v2` ships alongside `v1` with a deprecation window
  of at least one minor cycle.
