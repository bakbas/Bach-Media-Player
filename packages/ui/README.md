# @bach/ui

Default Web Components controls for Bach Media Player: play / pause, scrubbable progress, volume, time display, fullscreen toggle, and a flex container.

```ts
import '@bach/core/define';
import '@bach/ui/define';
```

```html
<bach-player src="video.m3u8">
  <video slot="media" crossorigin></video>
  <bach-controls slot="controls">
    <bach-play-button></bach-play-button>
    <bach-progress></bach-progress>
    <bach-time></bach-time>
    <bach-volume></bach-volume>
    <bach-fullscreen-button></bach-fullscreen-button>
  </bach-controls>
</bach-player>
```

## Theming

Every control is fully restyleable via CSS variables (see [`THEMING.md`](../../THEMING.md) — Phase 5) and Shadow DOM parts. Stable part names:

- `chrome` (the `<bach-controls>` container)
- `play-button` (also covers the pause state)
- `progress-bar`, `progress-fill`, `progress-buffer`, `progress-thumb`, `timeline`
- `volume-button`, `volume-slider`, `volume-slider-fill`
- `time-display`
- `fullscreen-button`

Example:

```css
bach-player::part(play-button) {
  background: oklch(0.65 0.18 250);
  color: white;
}
```

## Headless mode

Each control finds its host via `closest('bach-player')` (with shadow-piercing fallback). If `<bach-player>` is in `headless` mode, the controls slot is hidden by default but the controls themselves still work outside the player — you can compose them in your own UI tree.

## License

MIT
