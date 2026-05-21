import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://bach-media-player.dev',
  integrations: [
    starlight({
      title: 'Bach Media Player',
      description: 'Composable, themable, AI-native web media player.',
      social: {
        github: 'https://github.com/bakbas/Bach-Media-Player',
      },
      sidebar: [
        {
          label: 'Get started',
          items: [
            { label: 'Introduction', slug: 'index' },
            { label: 'Installation', slug: 'getting-started' },
          ],
        },
        {
          label: 'Theming baseline',
          items: [{ label: 'CSS variables, parts, applyTheme', slug: 'theming' }],
        },
        {
          label: 'Five signatures',
          items: [
            { label: 'Notasyon — AI captions', slug: 'captions' },
            { label: 'Hassasiyet — frame-accurate seek', slug: 'seek-frame' },
            { label: 'Polifoni — audio mix', slug: 'audio-mix' },
            { label: 'Akustik — GPU FX', slug: 'gpu-fx' },
            { label: 'Conducting — live director mode', slug: 'conducting' },
          ],
        },
        {
          label: 'Operating',
          items: [{ label: 'Releasing & hardening', slug: 'releasing' }],
        },
      ],
      customCss: ['./src/styles/global.css'],
    }),
  ],
});
