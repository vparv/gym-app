import { describe, expect, it } from 'vitest';

import { getYouTubeEmbedUrl, getYouTubeVideoId } from './youtube';

describe('getYouTubeVideoId', () => {
  it('parses youtu.be share links with extra params', () => {
    expect(getYouTubeVideoId('https://youtu.be/b8fYnZ-usP0?si=example123')).toBe('b8fYnZ-usP0');
  });

  it('parses standard watch links', () => {
    expect(getYouTubeVideoId('https://www.youtube.com/watch?v=vqQ9ok0dEgk&t=12s')).toBe(
      'vqQ9ok0dEgk'
    );
  });

  it('parses embed links', () => {
    expect(getYouTubeVideoId('https://www.youtube.com/embed/p2t9daxLpB8')).toBe('p2t9daxLpB8');
  });

  it('rejects non-youtube urls', () => {
    expect(getYouTubeVideoId('https://example.com/watch?v=vqQ9ok0dEgk')).toBeNull();
  });
});

describe('getYouTubeEmbedUrl', () => {
  it('builds an autoplaying inline embed url', () => {
    expect(getYouTubeEmbedUrl('https://youtu.be/b8fYnZ-usP0')).toBe(
      'https://www.youtube.com/embed/b8fYnZ-usP0?autoplay=1&playsinline=1&rel=0'
    );
  });
});
