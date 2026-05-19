import { describe, expect, it, vi } from 'vitest';
import {
  type AnalyserNodeLike,
  type AudioContextLike,
  type AudioNodeLike,
  type AudioParamLike,
  type GainNodeLike,
  createMixer,
} from './mixer.js';

interface Recorder {
  gains: Set<FakeGain>;
  destinationConnections: AudioNodeLike[];
}

class FakeParam implements AudioParamLike {
  value = 1;
  setValueCurveCalls: Array<{ values: Float32Array; startTime: number; duration: number }> = [];
  setValueAtTimeCalls: Array<{ value: number; time: number }> = [];
  cancelCalls: number[] = [];
  setValueCurveAtTime(values: Float32Array, startTime: number, duration: number): void {
    this.setValueCurveCalls.push({ values, startTime, duration });
    this.value = values[values.length - 1] ?? this.value;
  }
  setValueAtTime(value: number, time: number): void {
    this.setValueAtTimeCalls.push({ value, time });
    this.value = value;
  }
  cancelScheduledValues(time: number): void {
    this.cancelCalls.push(time);
  }
}

class FakeNode implements AudioNodeLike {
  connections: AudioNodeLike[] = [];
  connect(target: AudioNodeLike): AudioNodeLike {
    this.connections.push(target);
    return target;
  }
  disconnect(): void {
    this.connections = [];
  }
}

class FakeGain extends FakeNode implements GainNodeLike {
  gain = new FakeParam();
  constructor(private readonly recorder: Recorder) {
    super();
    recorder.gains.add(this);
    this.gain.value = 1;
  }
}

class FakeAnalyser extends FakeNode implements AnalyserNodeLike {
  fftSize = 2048;
  smoothingTimeConstant = 0.7;
  filled?: Uint8Array;
  fillerByte = 64;
  get frequencyBinCount(): number {
    return this.fftSize / 2;
  }
  getByteFrequencyData(array: Uint8Array): void {
    array.fill(this.fillerByte);
    this.filled = array;
  }
}

function makeContext(): {
  context: AudioContextLike;
  recorder: Recorder;
  destination: FakeNode;
  analysers: FakeAnalyser[];
  setCurrentTime: (value: number) => void;
} {
  const destination = new FakeNode();
  const analysers: FakeAnalyser[] = [];
  let now = 0;
  const recorder: Recorder = { gains: new Set(), destinationConnections: [] };

  destination.connect = (target) => {
    recorder.destinationConnections.push(target);
    return target;
  };

  const context: AudioContextLike = {
    get currentTime() {
      return now;
    },
    get destination() {
      return destination;
    },
    createGain(): FakeGain {
      return new FakeGain(recorder);
    },
    createAnalyser(): FakeAnalyser {
      const a = new FakeAnalyser();
      analysers.push(a);
      return a;
    },
    createMediaElementSource(): AudioNodeLike {
      return new FakeNode();
    },
  };

  return {
    context,
    recorder,
    destination,
    analysers,
    setCurrentTime(value) {
      now = value;
    },
  };
}

describe('createMixer — graph topology', () => {
  it('wires master → analyser → destination', () => {
    const { context, analysers, destination } = makeContext();
    const mixer = createMixer({ context });
    expect(analysers).toHaveLength(1);
    const analyser = analysers[0] as unknown as FakeAnalyser;
    expect((mixer.master as unknown as FakeGain).connections).toContain(analyser);
    expect(analyser.connections).toContain(destination);
  });

  it('honours a custom fftSize', () => {
    const { context, analysers } = makeContext();
    createMixer({ context, fftSize: 512 });
    expect(analysers[0]?.fftSize).toBe(512);
  });
});

describe('addTrack / removeTrack', () => {
  it('connects source → trackGain → master', () => {
    const { context } = makeContext();
    const mixer = createMixer({ context });
    // Mock node.connect must return the target so chained
    // `source.connect(gain).connect(master)` lands on the gain.
    const node = {
      connect: vi.fn<(target: AudioNodeLike) => AudioNodeLike>((target) => target),
      disconnect: vi.fn(),
    };
    const handle = mixer.addTrack({ id: 'main', node, gain: 0.8 });
    expect(handle.id).toBe('main');
    expect(handle.gain.gain.value).toBe(0.8);
    expect(node.connect).toHaveBeenCalledWith(handle.gain);
    expect((handle.gain as unknown as FakeGain).connections).toContain(mixer.master);
  });

  it('throws when the id is taken', () => {
    const { context } = makeContext();
    const mixer = createMixer({ context });
    mixer.addTrack({ id: 'a', node: new FakeNode() });
    expect(() => mixer.addTrack({ id: 'a', node: new FakeNode() })).toThrow(/already registered/);
  });

  it('throws when neither node nor media is provided', () => {
    const { context } = makeContext();
    const mixer = createMixer({ context });
    expect(() => mixer.addTrack({ id: 'x' })).toThrow(/node.*media/);
  });

  it('throws when both node and media are provided', () => {
    const { context } = makeContext();
    const mixer = createMixer({ context });
    expect(() =>
      mixer.addTrack({
        id: 'x',
        node: new FakeNode(),
        media: {} as unknown as HTMLMediaElement,
      }),
    ).toThrow(/either.*not both/);
  });

  it('removeTrack disconnects and forgets the handle', () => {
    const { context } = makeContext();
    const mixer = createMixer({ context });
    const node = new FakeNode();
    mixer.addTrack({ id: 'main', node });
    expect(mixer.getTrack('main')).not.toBeNull();
    expect(mixer.removeTrack('main')).toBe(true);
    expect(mixer.getTrack('main')).toBeNull();
    expect(mixer.removeTrack('absent')).toBe(false);
  });
});

describe('crossfade', () => {
  it('pushes equal-power curves into both tracks and uses context.currentTime', () => {
    const { context, setCurrentTime } = makeContext();
    const mixer = createMixer({ context });
    mixer.addTrack({ id: 'a', node: new FakeNode() });
    mixer.addTrack({ id: 'b', node: new FakeNode() });
    setCurrentTime(12.5);
    mixer.crossfade('a', 'b', { durationSeconds: 2, resolution: 16 });
    const a = mixer.getTrack('a')?.gain.gain as FakeParam;
    const b = mixer.getTrack('b')?.gain.gain as FakeParam;
    expect(a.setValueCurveCalls).toHaveLength(1);
    expect(b.setValueCurveCalls).toHaveLength(1);
    expect(a.setValueCurveCalls[0]?.startTime).toBe(12.5);
    expect(a.setValueCurveCalls[0]?.duration).toBe(2);
    expect(a.setValueCurveCalls[0]?.values.length).toBe(16);
  });

  it('zero-duration crossfade snaps endpoints immediately', () => {
    const { context } = makeContext();
    const mixer = createMixer({ context });
    mixer.addTrack({ id: 'a', node: new FakeNode() });
    mixer.addTrack({ id: 'b', node: new FakeNode() });
    mixer.crossfade('a', 'b', { durationSeconds: 0, curve: 'linear' });
    const a = mixer.getTrack('a')?.gain.gain as FakeParam;
    const b = mixer.getTrack('b')?.gain.gain as FakeParam;
    expect(a.setValueCurveCalls).toHaveLength(0);
    expect(a.value).toBeCloseTo(0, 5);
    expect(b.value).toBeCloseTo(1, 5);
  });

  it('throws when either track is missing', () => {
    const { context } = makeContext();
    const mixer = createMixer({ context });
    mixer.addTrack({ id: 'a', node: new FakeNode() });
    expect(() => mixer.crossfade('a', 'ghost')).toThrow(/requires both/);
    expect(() => mixer.crossfade('ghost', 'a')).toThrow(/requires both/);
  });
});

describe('setGain / sampleSpectrum / dispose', () => {
  it('setGain cancels scheduled values and writes the new gain', () => {
    const { context } = makeContext();
    const mixer = createMixer({ context });
    const handle = mixer.addTrack({ id: 'a', node: new FakeNode() });
    mixer.setGain('a', 0.25);
    const param = handle.gain.gain as FakeParam;
    expect(param.cancelCalls).toHaveLength(1);
    expect(param.value).toBe(0.25);
  });

  it('sampleSpectrum returns a Uint8Array of frequencyBinCount length', () => {
    const { context, analysers } = makeContext();
    const mixer = createMixer({ context });
    const analyser = analysers[0];
    if (!analyser) throw new Error('expected analyser created');
    analyser.fillerByte = 99;
    const data = mixer.sampleSpectrum();
    expect(data.length).toBe(analyser.frequencyBinCount);
    expect(data[0]).toBe(99);
  });

  it('sampleSpectrum reuses a caller-provided buffer', () => {
    const { context, analysers } = makeContext();
    const mixer = createMixer({ context });
    const analyser = analysers[0];
    if (!analyser) throw new Error('expected analyser created');
    const buf = new Uint8Array(analyser.frequencyBinCount);
    expect(mixer.sampleSpectrum(buf)).toBe(buf);
  });

  it('dispose disconnects every node', () => {
    const { context } = makeContext();
    const mixer = createMixer({ context });
    const handle = mixer.addTrack({ id: 'a', node: new FakeNode() });
    mixer.dispose();
    expect((handle.gain as unknown as FakeGain).connections).toHaveLength(0);
    expect((mixer.master as unknown as FakeGain).connections).toHaveLength(0);
  });
});
