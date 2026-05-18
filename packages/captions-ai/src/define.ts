import { BachCaptionsConsentElement } from './consent-element.js';
import { BachCaptionsElement } from './element.js';

if (typeof customElements !== 'undefined') {
  if (!customElements.get('bach-captions')) {
    customElements.define('bach-captions', BachCaptionsElement);
  }
  if (!customElements.get('bach-captions-consent')) {
    customElements.define('bach-captions-consent', BachCaptionsConsentElement);
  }
}
