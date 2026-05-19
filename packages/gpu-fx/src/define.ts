import { BachGpuFxElement } from './element.js';

if (typeof customElements !== 'undefined' && !customElements.get('bach-gpu-fx')) {
  customElements.define('bach-gpu-fx', BachGpuFxElement);
}
