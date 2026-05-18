import { BachControlsElement } from './controls.js';
import { BachFullscreenButtonElement } from './fullscreen-button.js';
import { BachPlayButtonElement } from './play-button.js';
import { BachProgressElement } from './progress.js';
import { BachTimeElement } from './time.js';
import { BachVolumeElement } from './volume.js';

if (typeof customElements !== 'undefined') {
  const define = (name: string, ctor: CustomElementConstructor): void => {
    if (!customElements.get(name)) customElements.define(name, ctor);
  };
  define('bach-controls', BachControlsElement);
  define('bach-play-button', BachPlayButtonElement);
  define('bach-progress', BachProgressElement);
  define('bach-volume', BachVolumeElement);
  define('bach-time', BachTimeElement);
  define('bach-fullscreen-button', BachFullscreenButtonElement);
}
