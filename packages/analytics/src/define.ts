import { BachAnalyticsElement } from './element.js';

if (typeof customElements !== 'undefined' && !customElements.get('bach-analytics')) {
  customElements.define('bach-analytics', BachAnalyticsElement);
}
