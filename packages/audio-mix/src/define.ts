import { BachAudioMixElement, BachAudioTrackElement } from './element.js';

if (typeof customElements !== 'undefined') {
  if (!customElements.get('bach-audio-mix')) {
    customElements.define('bach-audio-mix', BachAudioMixElement);
  }
  if (!customElements.get('bach-audio-track')) {
    customElements.define('bach-audio-track', BachAudioTrackElement);
  }
}
