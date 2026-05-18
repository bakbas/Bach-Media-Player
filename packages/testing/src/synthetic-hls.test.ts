import { describe, expect, it } from 'vitest';
import { buildSyntheticHlsPlaylist } from './synthetic-hls.js';

describe('buildSyntheticHlsPlaylist', () => {
  it('emits a VOD playlist with the requested number of segments', () => {
    const playlist = buildSyntheticHlsPlaylist({ segmentCount: 3, segmentDuration: 6 });
    expect(playlist).toContain('#EXTM3U');
    expect(playlist).toContain('#EXT-X-PLAYLIST-TYPE:VOD');
    expect(playlist).toContain('seg-00000.ts');
    expect(playlist).toContain('seg-00002.ts');
    expect(playlist).toContain('#EXT-X-ENDLIST');
    expect(playlist.match(/#EXTINF:/g)).toHaveLength(3);
  });

  it('omits the endlist when requested (live-style playlist)', () => {
    const playlist = buildSyntheticHlsPlaylist({
      segmentCount: 2,
      segmentDuration: 4,
      endlist: false,
    });
    expect(playlist).not.toContain('#EXT-X-ENDLIST');
  });

  it('honours a custom baseUri', () => {
    const playlist = buildSyntheticHlsPlaylist({
      segmentCount: 1,
      segmentDuration: 2,
      baseUri: 'https://cdn.example.com/c',
    });
    expect(playlist).toContain('https://cdn.example.com/c-00000.ts');
  });
});
