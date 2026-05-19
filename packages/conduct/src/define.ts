import { BachConductElement } from './element.js';

if (typeof customElements !== 'undefined' && !customElements.get('bach-conduct')) {
  customElements.define('bach-conduct', BachConductElement);
}
