'use client';

import { useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/tmdb/browser';
import { useFocus, useInView } from '@/lib/hooks';
import { blendedDiscover } from '@/lib/queries';
import { GENRES } from '@/config/genres';
import { PINNED_LANGUAGES } from '@/config/languages';
import { useLibrary } from '@/store/library';
import { EmptyNote, ErrorNote, GridSkeleton, Picker, Room } from '@/components/ui/kit';
import { PosterGrid } from '@/components/ui/Poster';
import type { MovieSummary, Paginated } from '@/types/tmdb';

const DECADES = Array.from({ length: 11 }, (_, i) => 1920 + i * 10);
/** "Low popularity" ceiling on TMDB's popularity metric. */
const POPULARITY_CEILING = 40;

export function Gems() {
  const [genre, setGenre] = useState('');
  const [lang, setLang] = useState('');
  const [decade, setDecade] = useState('');
  const seen = useLibrary((s) => s.seen);
  const { region, focus } = useFocus();

  const params = useMemo(() => {
    const p: Record<string, string> = {
      'vote_average.gte': '7.2',
      'vote_count.gte': '150',
      'vote_count.lte': '3000',
      sort_by: 'vote_average.desc',
      without_genres: '99,10770',
    };
    if (genre) p.with_genres = genre;
    if (lang) {
      p.with_original_language = lang;
      p['vote_count.gte'] = '60';
    }
    if (decade) {
      p['primary_release_date.gte'] = `${decade}-01-01`;
      p['primary_release_date.lte'] = `${Number(decade) + 9}-12-31`;
    }
    return p;
  }, [genre, lang, decade]);

  const q = useInfiniteQuery({
    queryKey: ['gems', params, focus, region],
    initialPageParam: 1,
    // Blends in hidden gems made in the viewer's region (local films have far fewer votes).
    queryFn: ({ pageParam, signal }) =>
      blendedDiscover(params, pageParam, { region, focus, voteScale: 0.3, signal }),
    getNextPageParam: (l) => (l.page < Math.min(l.total_pages, 500) ? l.page + 1 : undefined),
  });
  const sentinel = useInView<HTMLDivElement>(() => {
    if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
  }, Boolean(q.hasNextPage));
  const movies = Array.from(
    new Map((q.data?.pages.flatMap((p) => p.results) ?? []).map((m) => [m.id, m])).values(),
  ).filter((m) => m.popularity <= POPULARITY_CEILING && !seen[m.id]);

  return (
    <Room
      mark="Hidden Gems · loved, barely seen"
      title="Buried treasure"
      lede="Rated 7.2 and up by the few who found them. No blockbusters, nothing you have already seen."
    >
      <div className="grid max-w-3xl gap-5 sm:grid-cols-3">
        <Picker
          label="Genre"
          value={genre}
          onChange={setGenre}
          options={GENRES.map((g) => [String(g.id), g.name])}
        />
        <Picker
          label="Language"
          value={lang}
          onChange={setLang}
          options={PINNED_LANGUAGES.map((l) => [l.code, l.name])}
        />
        <Picker
          label="Decade"
          value={decade}
          onChange={setDecade}
          options={DECADES.map((d) => [String(d), `${d}s`])}
        />
      </div>
      <div className="mt-9">
        {q.isLoading ? (
          <GridSkeleton />
        ) : q.isError ? (
          <ErrorNote error={q.error} onRetry={() => q.refetch()} />
        ) : !movies.length && !q.hasNextPage ? (
          <EmptyNote title="No gems here">Try another decade or language.</EmptyNote>
        ) : (
          <PosterGrid movies={movies} />
        )}
      </div>
      <div ref={sentinel} className="mt-10 flex justify-center">
        {q.hasNextPage && (
          <button
            type="button"
            className="btn"
            onClick={() => q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
          >
            {q.isFetchingNextPage ? 'Digging…' : 'Dig deeper'}
          </button>
        )}
      </div>
    </Room>
  );
}
