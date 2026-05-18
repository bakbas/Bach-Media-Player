export interface MediaEngineOptions {
  drm?: {
    keySystem: 'com.widevine.alpha' | 'com.apple.fps' | 'com.microsoft.playready.recommendation';
    licenseUrl: string;
  };
  startTime?: number;
}

export interface MediaEngineEvents {
  ready: () => void;
  error: (err: { code: number; message: string }) => void;
  durationchange: (duration: number) => void;
  progress: (buffered: ReadonlyArray<[number, number]>) => void;
}

export interface MediaEngine {
  readonly name: string;
  canHandle(src: string, mime?: string): Promise<boolean>;
  attach(video: HTMLVideoElement, opts: MediaEngineOptions): Promise<void>;
  load(src: string): Promise<void>;
  destroy(): Promise<void>;
  on<E extends keyof MediaEngineEvents>(event: E, handler: MediaEngineEvents[E]): () => void;
}
