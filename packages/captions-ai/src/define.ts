import { BachCaptionsElement } from './element.js';

if (typeof customElements !== 'undefined' && !customElements.get('bach-captions')) {
  customElements.define('bach-captions', BachCaptionsElement);
}
