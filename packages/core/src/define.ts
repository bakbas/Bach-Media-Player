import { BachPlayerElement } from './element.js';

if (typeof customElements !== 'undefined' && !customElements.get('bach-player')) {
  customElements.define('bach-player', BachPlayerElement);
}
