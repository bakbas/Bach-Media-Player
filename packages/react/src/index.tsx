import type { BachPlayerElement, PlayerStateSnapshot } from '@bach/core';
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

/**
 * `<BachPlayer />` — React 18+/19 wrapper around the `<bach-player>`
 * Custom Element. Two design choices, both deliberate:
 *
 *  1. We do NOT import `@bach/core/define` at module scope. Importing
 *     a side-effectful module from a React file breaks Next.js App
 *     Router because the module loads on the server too. Instead we
 *     defer the `customElements.define` call to a client-side
 *     `useEffect`, which never runs on the server. Consumers who do
 *     their own define (or who use a custom build) can pass
 *     `skipDefine` to opt out of the lazy import.
 *
 *  2. The `forwardRef` ref points at the underlying Custom Element so
 *     consumers can call `player.applyTheme(...)`, read `player.state`,
 *     etc. The hooks below give a more idiomatic React surface for
 *     the common cases.
 */

// Make `<bach-player>` JSX-typed. React 19 looks up intrinsics via
// `React.JSX`; module augmentation extends the type that both
// react/jsx-runtime and tsc resolve.
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'bach-player': React.DetailedHTMLProps<
        React.HTMLAttributes<BachPlayerElement>,
        BachPlayerElement
      > & {
        src?: string;
        autoplay?: boolean;
        muted?: boolean;
        headless?: boolean;
        theme?: string;
      };
    }
  }
}

export interface BachPlayerProps {
  src?: string;
  /** When omitted, `<BachPlayer>` autoplays muted (the safe default). */
  autoplay?: boolean;
  muted?: boolean;
  headless?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /**
   * Skip the lazy `@bach/core/define` import. Use this when you call
   * `customElements.define('bach-player', BachPlayerElement)` yourself
   * (e.g. from a global side-effect file).
   */
  skipDefine?: boolean;
}

export const BachPlayer = forwardRef<BachPlayerElement, BachPlayerProps>(
  function BachPlayer(props, ref) {
    const innerRef = useRef<BachPlayerElement>(null);
    useImperativeHandle(ref, () => innerRef.current as BachPlayerElement, []);

    useEffect(() => {
      if (props.skipDefine) return;
      if (typeof window === 'undefined') return;
      if (window.customElements?.get('bach-player')) return;
      void import('@bach/core/define');
    }, [props.skipDefine]);

    return (
      <bach-player
        ref={innerRef}
        {...(props.src !== undefined ? { src: props.src } : {})}
        {...(props.autoplay ? { autoplay: true } : {})}
        {...((props.muted ?? true) ? { muted: true } : {})}
        {...(props.headless ? { headless: true } : {})}
        {...(props.className !== undefined ? { className: props.className } : {})}
        {...(props.style !== undefined ? { style: props.style } : {})}
      >
        {props.children}
      </bach-player>
    );
  },
);

/**
 * Subscribe to a single slice of the player's signals state. Returns
 * the live value and re-renders the component whenever it changes.
 *
 *   const paused = useBachPlayerState(ref, (s) => s.paused);
 */
export function useBachPlayerState<T>(
  ref: RefObject<BachPlayerElement | null>,
  select: (snapshot: PlayerStateSnapshot) => T,
): T | null {
  const [host, setHost] = useState<BachPlayerElement | null>(null);

  useEffect(() => {
    setHost(ref.current);
  }, [ref]);

  const subscribe = (notify: () => void): (() => void) => {
    if (!host) return () => {};
    // Re-poll the snapshot whenever any signal in the state changes.
    // We piggyback on the host's bach:* events plus the underlying
    // `<video>` events so polling is cheap.
    const events = ['play', 'pause', 'timeupdate', 'volumechange', 'durationchange', 'ended'];
    const video = host.video;
    const handler = (): void => notify();
    if (video) for (const e of events) video.addEventListener(e, handler);
    return () => {
      if (video) for (const e of events) video.removeEventListener(e, handler);
    };
  };

  const getSnapshot = (): T | null => {
    if (!host) return null;
    return select(host.state.snapshot());
  };

  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

/**
 * Convenience hook that returns the whole state snapshot. Re-renders
 * on any state change — prefer the selective `useBachPlayerState` when
 * a single field is enough.
 */
export function useBachPlayerSnapshot(
  ref: RefObject<BachPlayerElement | null>,
): PlayerStateSnapshot | null {
  return useBachPlayerState(ref, (snapshot) => snapshot);
}
