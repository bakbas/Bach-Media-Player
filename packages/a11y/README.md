# @bach/a11y

Accessibility utilities for Bach Media Player: keyboard shortcuts, focus trap, prefers-reduced-motion guard helpers.

```ts
import { installKeyboardShortcuts, trapFocus } from '@bach/a11y';

const player = document.querySelector('bach-player')!;
const uninstall = installKeyboardShortcuts(player);

// later, in your fullscreen handler:
const untrap = trapFocus(player);
// ...
untrap();
uninstall();
```

## Keyboard map

YouTube / Vimeo-compatible shortcuts (fires only when the player or one of its descendants is focused, never page-wide):

| Key | Action |
|---|---|
| Space / k | Toggle play/pause |
| m | Toggle mute |
| f | Toggle fullscreen |
| j / l | -10 s / +10 s |
| ← / → | -5 s / +5 s |
| ↑ / ↓ | Volume +5 % / -5 % |
| 0–9 | Jump to 0 %, 10 %, … 90 % of the duration |

Modifier keys (Ctrl/⌘/Alt) are passed through to the browser. Keystrokes in editable targets (`<input>`, `<textarea>`, `contenteditable`) are ignored unless `installKeyboardShortcuts(player, { ignoreEditable: false })`.

## License

MIT
