export interface SyntheticHlsOptions {
  segmentCount: number;
  segmentDuration: number;
  baseUri?: string;
  endlist?: boolean;
}

/**
 * Returns a deterministic HLS media playlist as a string. Useful in unit tests
 * where you want hls.js / the codec negotiator to see plausible bytes without
 * shipping fixture files. Phase 1 only emits VOD playlists; LL-HLS support
 * lands when the hybrid-latency item is picked up post-1.0.
 */
export function buildSyntheticHlsPlaylist(opts: SyntheticHlsOptions): string {
  const base = opts.baseUri ?? 'seg';
  const lines: string[] = [
    '#EXTM3U',
    '#EXT-X-VERSION:6',
    `#EXT-X-TARGETDURATION:${Math.ceil(opts.segmentDuration)}`,
    '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-PLAYLIST-TYPE:VOD',
  ];

  for (let i = 0; i < opts.segmentCount; i += 1) {
    lines.push(`#EXTINF:${opts.segmentDuration.toFixed(3)},`);
    lines.push(`${base}-${i.toString().padStart(5, '0')}.ts`);
  }

  if (opts.endlist !== false) lines.push('#EXT-X-ENDLIST');
  return `${lines.join('\n')}\n`;
}
