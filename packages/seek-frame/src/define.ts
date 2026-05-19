import { BachSeekFrameElement } from './element.js';

if (typeof customElements !== 'undefined' && !customElements.get('bach-seek-frame')) {
  customElements.define('bach-seek-frame', BachSeekFrameElement);
}
