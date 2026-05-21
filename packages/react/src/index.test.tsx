import { BachPlayerElement } from '@bach/core';
import { act, cleanup, render } from '@testing-library/react';
import { type RefObject, createRef } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BachPlayer, useBachPlayerState } from './index.js';

beforeAll(() => {
  if (!customElements.get('bach-player')) {
    customElements.define('bach-player', BachPlayerElement);
  }
});

afterEach(() => {
  cleanup();
});

describe('<BachPlayer />', () => {
  it('renders a <bach-player> element with the given src', () => {
    const { container } = render(<BachPlayer src="video.m3u8" skipDefine />);
    const el = container.querySelector('bach-player');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('src')).toBe('video.m3u8');
  });

  it('defaults to muted autoplay (the safe default)', () => {
    const { container } = render(<BachPlayer skipDefine />);
    const el = container.querySelector('bach-player');
    expect(el?.hasAttribute('muted')).toBe(true);
  });

  it('mirrors the headless attribute', () => {
    const { container } = render(<BachPlayer headless skipDefine />);
    const el = container.querySelector('bach-player');
    expect(el?.hasAttribute('headless')).toBe(true);
  });

  it('forwards the ref to the underlying Custom Element', () => {
    const ref = createRef<BachPlayerElement>();
    render(<BachPlayer ref={ref} skipDefine />);
    expect(ref.current).toBeInstanceOf(BachPlayerElement);
  });

  it('renders children as slotted content', () => {
    const { container } = render(
      <BachPlayer skipDefine>
        <video slot="media">
          <track kind="captions" />
        </video>
      </BachPlayer>,
    );
    expect(container.querySelector('bach-player > video[slot="media"]')).not.toBeNull();
  });
});

describe('useBachPlayerState', () => {
  function Probe({ playerRef }: { playerRef: RefObject<BachPlayerElement | null> }): JSX.Element {
    const paused = useBachPlayerState(playerRef, (s) => s.paused);
    return <span data-testid="paused">{String(paused)}</span>;
  }

  it('returns null before the ref is attached', () => {
    const ref = createRef<BachPlayerElement>();
    const { getByTestId } = render(<Probe playerRef={ref} />);
    expect(getByTestId('paused').textContent).toBe('null');
  });

  it('reads the current snapshot once the ref is attached', async () => {
    const ref = createRef<BachPlayerElement>();
    const { getByTestId } = render(
      <>
        <BachPlayer ref={ref} skipDefine>
          <video slot="media">
            <track kind="captions" />
          </video>
        </BachPlayer>
        <Probe playerRef={ref} />
      </>,
    );
    // useEffect runs the setHost; useSyncExternalStore re-reads the
    // snapshot on the next paint. The initial player state has
    // paused=true so we should observe that, not null.
    await act(async () => {
      // Force a re-paint so React flushes the post-effect re-render.
      await Promise.resolve();
    });
    expect(getByTestId('paused').textContent).toBe('true');
  });
});
