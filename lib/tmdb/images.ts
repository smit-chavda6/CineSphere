export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export type ImageKind = 'poster' | 'backdrop' | 'profile' | 'logo';

/** Widths TMDB actually serves for each image kind. */
export const IMAGE_WIDTHS: Record<ImageKind, number[]> = {
  poster: [92, 154, 185, 342, 500, 780],
  backdrop: [300, 780, 1280],
  profile: [45, 185, 632],
  logo: [45, 92, 154, 185, 300, 500],
};

/** Smallest TMDB rendition that is at least `width` wide, or `original`. */
export function sizeFor(kind: ImageKind, width: number): string {
  const match = IMAGE_WIDTHS[kind].find((w) => w >= width);
  if (!match) return 'original';
  // TMDB names its largest profile rendition by height (h632), not width.
  if (kind === 'profile' && match === 632) return 'h632';
  return `w${match}`;
}

export function tmdbImage(path: string | null | undefined, size = 'w342'): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}
