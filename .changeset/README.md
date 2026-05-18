# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets). Each user-facing change in a published `@bach/*` package needs a changeset file alongside the code change.

Create one with:

```bash
pnpm changeset
```

The CLI walks you through:

1. Selecting which packages changed.
2. Choosing the bump type (`patch` / `minor` / `major`).
3. Writing a one-line summary that ships in the changelog.

CI will fail PRs that modify `packages/**/src/**` without a changeset (unless the touched packages are listed in `config.json`'s `ignore` array).
