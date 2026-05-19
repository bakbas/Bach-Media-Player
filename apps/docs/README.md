# @bach/docs

Documentation site for Bach Media Player. Built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build).

```bash
pnpm --filter @bach/docs dev
# → http://127.0.0.1:4321

pnpm --filter @bach/docs build
pnpm --filter @bach/docs preview
# → http://127.0.0.1:4322
```

## Content

Pages live in `src/content/docs/*.mdx`. Sidebar groups are configured in `astro.config.mjs`.

Starlight ships dark mode, search, and search indexing out of the box — keep page intros short and use the `<Aside>` component for status banners (in-development packages especially).
