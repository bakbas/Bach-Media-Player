import type { PlayerState } from './state.js';

export interface BachPluginHost {
  readonly element: HTMLElement;
  readonly state: PlayerState;
  emit(event: string, detail?: unknown): void;
  on(event: string, handler: (event: CustomEvent) => void): () => void;
}

export interface BachPlugin {
  readonly id: string;
  install(host: BachPluginHost): void;
  uninstall(): void;
}
