import { FakeMediaElement } from '@bach/testing';
import { describe, expect, it } from 'vitest';
import { createPlayerState } from './state.js';
import { bindVideoToState } from './video-binding.js';

describe('bindVideoToState', () => {
  it('syncs initial fields on bind', () => {
    const video = new FakeMediaElement({ duration: 120, initialTime: 5, buffered: [[0, 10]] });
    video.volume = 0.7;
    video.muted = true;
    video.readyState = 4;
    const state = createPlayerState();
    bindVideoToState(video, state);
    const snap = state.snapshot();
    expect(snap.duration).toBe(120);
    expect(snap.currentTime).toBe(5);
    expect(snap.volume).toBe(0.7);
    expect(snap.muted).toBe(true);
    expect(snap.readyState).toBe(4);
    expect(snap.buffered).toEqual([[0, 10]]);
  });

  it('updates state on durationchange and timeupdate', () => {
    const video = new FakeMediaElement();
    const state = createPlayerState();
    bindVideoToState(video, state);

    video.duration = 88;
    video.dispatch('durationchange');
    expect(state.duration.value).toBe(88);

    video.currentTime = 42;
    video.dispatch('timeupdate');
    expect(state.currentTime.value).toBe(42);
  });

  it('flips paused on play/pause events', async () => {
    const video = new FakeMediaElement();
    const state = createPlayerState();
    bindVideoToState(video, state);
    expect(state.paused.value).toBe(true);
    await video.play();
    expect(state.paused.value).toBe(false);
    video.pause();
    expect(state.paused.value).toBe(true);
  });

  it('returns an unbind function that detaches all listeners', () => {
    const video = new FakeMediaElement();
    const state = createPlayerState();
    const unbind = bindVideoToState(video, state);
    unbind();

    video.duration = 50;
    video.dispatch('durationchange');
    expect(state.duration.value).not.toBe(50);
  });
});
