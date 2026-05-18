import { BachPlayerElement } from '@bach/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { BachCaptionsElement } from './element.js';

beforeAll(() => {
  if (!customElements.get('bach-player')) {
    customElements.define('bach-player', BachPlayerElement);
  }
  if (!customElements.get('bach-captions')) {
    customElements.define('bach-captions', BachCaptionsElement);
  }
});

function makePlayer(): { player: BachPlayerElement; captions: BachCaptionsElement } {
  document.body.innerHTML = '<bach-player><video slot="media"></video></bach-player>';
  const player = document.querySelector('bach-player') as BachPlayerElement;
  const captions = document.createElement('bach-captions') as BachCaptionsElement;
  player.appendChild(captions);
  return { player, captions };
}

describe('<bach-captions>', () => {
  it('renders the active segment text', async () => {
    const { player, captions } = makePlayer();
    captions.setSegments([
      { start: 0, end: 2, text: 'first line' },
      { start: 2, end: 4, text: 'second line' },
    ]);
    player.state.currentTime.value = 1;
    await Promise.resolve();
    expect(captions.shadowRoot?.querySelector('.cue')?.textContent).toBe('first line');
    player.state.currentTime.value = 3;
    await Promise.resolve();
    expect(captions.shadowRoot?.querySelector('.cue')?.textContent).toBe('second line');
  });

  it('clears the cue when no segment is active', async () => {
    const { player, captions } = makePlayer();
    captions.setSegments([{ start: 0, end: 1, text: 'a' }]);
    player.state.currentTime.value = 5;
    await Promise.resolve();
    expect(captions.shadowRoot?.querySelector('.cue')?.textContent).toBe('');
  });

  it('exposes part="caption-cue" for external styling', () => {
    const { captions } = makePlayer();
    expect(captions.shadowRoot?.querySelector('[part="caption-cue"]')).not.toBeNull();
  });

  it('deduplicates overlapping segments via the aligner', () => {
    const { captions } = makePlayer();
    captions.setSegments([{ start: 28, end: 30, text: 'hello world' }]);
    captions.setSegments([{ start: 28.1, end: 30.1, text: 'Hello world!' }]);
    expect(captions.segments).toHaveLength(1);
  });

  it('reset() empties retained segments', () => {
    const { captions } = makePlayer();
    captions.setSegments([{ start: 0, end: 1, text: 'a' }]);
    captions.reset();
    expect(captions.segments).toHaveLength(0);
  });

  it('injects a <track kind="captions"> into the host video', () => {
    const { player } = makePlayer();
    const track = player.querySelector('video > track');
    expect(track?.getAttribute('kind')).toBe('captions');
  });

  it('removes the injected track on disconnect', () => {
    const { player, captions } = makePlayer();
    expect(player.querySelector('video > track')).not.toBeNull();
    captions.remove();
    expect(player.querySelector('video > track')).toBeNull();
  });
});
