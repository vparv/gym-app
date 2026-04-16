const YOUTUBE_DOMAINS = new Set(['youtube.com', 'm.youtube.com', 'www.youtube.com', 'youtu.be']);

export function getYouTubeVideoId(url: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (!YOUTUBE_DOMAINS.has(hostname)) {
    return null;
  }

  if (hostname === 'youtu.be') {
    return normalizeVideoId(parsedUrl.pathname.split('/').filter(Boolean)[0] ?? null);
  }

  if (parsedUrl.pathname === '/watch') {
    return normalizeVideoId(parsedUrl.searchParams.get('v'));
  }

  if (parsedUrl.pathname.startsWith('/embed/')) {
    return normalizeVideoId(parsedUrl.pathname.split('/')[2] ?? null);
  }

  if (parsedUrl.pathname.startsWith('/shorts/')) {
    return normalizeVideoId(parsedUrl.pathname.split('/')[2] ?? null);
  }

  if (parsedUrl.pathname.startsWith('/live/')) {
    return normalizeVideoId(parsedUrl.pathname.split('/')[2] ?? null);
  }

  return null;
}

export function getYouTubeEmbedUrl(url: string) {
  const videoId = getYouTubeVideoId(url);

  if (!videoId) {
    return null;
  }

  const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
  embedUrl.searchParams.set('autoplay', '1');
  embedUrl.searchParams.set('playsinline', '1');
  embedUrl.searchParams.set('rel', '0');

  return embedUrl.toString();
}

function normalizeVideoId(videoId: string | null) {
  if (!videoId) {
    return null;
  }

  return /^[A-Za-z0-9_-]{11}$/.test(videoId) ? videoId : null;
}
