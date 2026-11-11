import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCollection, getMovie, getPerson } from '@/lib/tmdb/api';
import { safe } from '@/lib/tmdb/server';
import { tmdbImage } from '@/lib/tmdb/images';
import { siteUrl, yearOf } from '@/lib/utils';

/**
 * Every address resolves here. The interface itself lives in the root layout
 * (`<Atlas />`) and never unmounts; this route only supplies what a crawler or a
 * link preview needs for the address that was loaded: metadata and JSON-LD.
 */

export const revalidate = 3600;

const PLACES: Record<string, { title: string; description: string }> = {
  discover: {
    title: 'Archive',
    description:
      'Filter every film by genre, year, rating, runtime, language, streaming service, cast, crew and more.',
  },
  library: { title: 'Shelf', description: 'Your watchlist, seen list, ratings and custom lists.' },
  atlas: { title: 'The chart', description: 'Every way to find a film, laid out as one map.' },
  recommend: {
    title: 'The chart',
    description:
      'Mood picker, taste blender, swipe mode, watch together, hidden gems and more ways to find a film.',
  },
  search: { title: 'Search', description: 'Search films, people, franchises and themes.' },
  'recommend/mood': {
    title: 'Moods',
    description:
      'Each mood is a recipe of genres, themes and a quality bar. Add your time and language if you like.',
  },
  'recommend/for-you': {
    title: 'For You',
    description: 'A feed built from your watchlist, ratings and swipes.',
  },
  'recommend/taste': {
    title: 'Blender',
    description: 'Blend three to ten favourite films into one taste profile.',
  },
  'recommend/swipe': {
    title: 'Swipe',
    description: 'Right to like, left to skip. The deck learns as you go.',
  },
  'recommend/together': {
    title: 'Together',
    description: 'One film that two to six people will all enjoy.',
  },
  'recommend/time-fit': {
    title: 'Time Fit',
    description: 'Only films that fit the time you have.',
  },
  'recommend/hidden-gems': {
    title: 'Hidden Gems',
    description: 'Brilliant films hardly anyone has seen.',
  },
  'recommend/decades': { title: 'Time Machine', description: 'The best of any decade or year.' },
  'recommend/surprise': { title: 'Dice', description: 'One random pick. Roll again.' },
  'recommend/marathon': {
    title: 'Marathons',
    description: 'Franchises in release order, with runtime and progress.',
  },
  'recommend/upcoming': { title: 'Calendar', description: 'What is releasing, week by week.' },
};

type Params = { params: { slug?: string[] } };

const entityId = (raw?: string) => {
  const id = Number((raw ?? '').split('-')[0]);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const slug = params.slug ?? [];
  const path = slug.join('/');
  if (!slug.length) return { alternates: { canonical: '/' } };

  const id = entityId(slug[1]);
  if (slug[0] === 'movie' && id) {
    const m = await safe(getMovie(id));
    if (!m) return { title: 'Film' };
    const year = yearOf(m.release_date);
    const title = `${m.title}${year ? ` (${year})` : ''}`;
    const description = (
      m.overview ||
      m.tagline ||
      `Cast, trailer and where to watch ${m.title}.`
    ).slice(0, 160);
    const image = tmdbImage(m.backdrop_path, 'w1280') ?? tmdbImage(m.poster_path, 'w780');
    return {
      title,
      description,
      alternates: { canonical: `/movie/${m.id}` },
      openGraph: {
        title,
        description,
        type: 'video.movie',
        images: image ? [{ url: image, width: 1280, height: 720, alt: title }] : [],
      },
      twitter: { card: 'summary_large_image', title, description, images: image ? [image] : [] },
    };
  }
  if (slug[0] === 'person' && id) {
    const p = await safe(getPerson(id));
    if (!p) return { title: 'Person' };
    const img = tmdbImage(p.profile_path, 'h632');
    return {
      title: p.name,
      description: (p.biography || `${p.name} — filmography and where to start.`).slice(0, 160),
      alternates: { canonical: `/person/${p.id}` },
      openGraph: { title: p.name, type: 'profile', images: img ? [img] : [] },
    };
  }
  if (slug[0] === 'collection' && id) {
    const c = await safe(getCollection(id));
    if (!c) return { title: 'Franchise' };
    const img = tmdbImage(c.backdrop_path, 'w1280');
    return {
      title: c.name,
      description: (c.overview || `Every film in ${c.name}, in release order.`).slice(0, 160),
      alternates: { canonical: `/collection/${c.id}` },
      openGraph: { title: c.name, images: img ? [img] : [] },
    };
  }

  const place = PLACES[path];
  if (place)
    return {
      ...place,
      alternates: { canonical: `/${path}` },
      robots: path === 'search' ? { index: false } : undefined,
    };
  return { title: 'Uncharted waters', robots: { index: false } };
}

export default async function Page({ params }: Params) {
  const slug = params.slug ?? [];
  // Stray asset requests (favicon.ico, *.map…) should 404 instead of rendering the app.
  if (slug.some((s) => s.includes('.'))) notFound();

  if (slug[0] !== 'movie') return null;
  const id = entityId(slug[1]);
  const m = id ? await safe(getMovie(id)) : null;
  if (!m) return null;

  const director = m.credits?.crew.find((c) => c.job === 'Director');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: m.title,
    url: `${siteUrl()}/movie/${m.id}`,
    image: tmdbImage(m.poster_path, 'w780') ?? undefined,
    datePublished: m.release_date || undefined,
    description: m.overview || undefined,
    genre: m.genres.map((g) => g.name),
    director: director ? { '@type': 'Person', name: director.name } : undefined,
    aggregateRating: m.vote_count
      ? {
          '@type': 'AggregateRating',
          ratingValue: m.vote_average.toFixed(1),
          bestRating: 10,
          ratingCount: m.vote_count,
        }
      : undefined,
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
    />
  );
}
