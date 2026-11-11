import type { Video } from '@/types/tmdb';

/** Prefers an official YouTube Trailer, then any Trailer, then a Teaser. Safe on server and client. */
export function pickTrailer(videos: Video[]): Video | null {
  const rank = (v: Video) => (v.type === 'Trailer' ? 0 : 2) + (v.official ? 0 : 1);
  return (
    videos
      .filter((v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'))
      .sort((a, b) => rank(a) - rank(b))[0] ?? null
  );
}
