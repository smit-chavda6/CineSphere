'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { useLibrary } from '@/store/library';
import { GENRES, GENRE_NAMES } from '@/config/genres';
import { featureQuery } from '@/lib/recommend/pipeline';
import { formatRuntime } from '@/lib/recommend/time';
import { EmptyNote, GRID, GridSkeleton, Room, Seg } from '@/components/ui/kit';
import { PosterTile } from '@/components/ui/Poster';
import { mapLimit, yearOf } from '@/lib/utils';
import type { MovieSnapshot } from '@/types/app';

type TabKey = 'watchlist' | 'seen' | 'rated' | 'not' | 'stats' | `list:${string}`;
type SortKey = 'added' | 'title' | 'year' | 'rating' | 'runtime';
interface Entry {
  movie: MovieSnapshot;
  at: number;
  extra?: string;
}

export function Shelf() {
  const lib = useLibrary();
  const [tab, setTab] = useState<TabKey>('watchlist');
  const [sort, setSort] = useState<SortKey>('added');
  const [genre, setGenre] = useState<number | ''>('');
  const [decade, setDecade] = useState<number | ''>('');
  const [newList, setNewList] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEnrichSeen();

  const entries = useMemo<Entry[]>(() => {
    const m = lib.movies;
    const from = (
      rec: Record<number, { at?: number; addedAt?: number }>,
      extra?: (id: number) => string | undefined,
    ): Entry[] =>
      Object.entries(rec)
        .map(([id, v]) => ({
          movie: m[Number(id)],
          at: v.at ?? v.addedAt ?? 0,
          extra: extra?.(Number(id)),
        }))
        .filter((x) => Boolean(x.movie));
    if (tab === 'watchlist')
      return from(lib.watchlist, (id) => lib.watchlist[id]?.tags.join(', ') || undefined);
    if (tab === 'seen') return from(lib.seen);
    if (tab === 'not') return from(lib.notInterested);
    if (tab === 'rated') return from(lib.ratings, (id) => '★'.repeat(lib.ratings[id]?.stars ?? 0));
    if (tab.startsWith('list:')) {
      const list = lib.lists.find((l) => l.id === tab.slice(5));
      return (list?.movieIds ?? [])
        .map((id, i) => ({ movie: m[id], at: i }))
        .filter((x) => Boolean(x.movie));
    }
    return [];
  }, [tab, lib.movies, lib.watchlist, lib.seen, lib.notInterested, lib.ratings, lib.lists]);

  const shown = useMemo(() => {
    let list = entries;
    if (genre !== '') list = list.filter((e) => e.movie.genre_ids.includes(genre));
    if (decade !== '')
      list = list.filter(
        (e) => Math.floor((yearOf(e.movie.release_date) ?? 0) / 10) * 10 === decade,
      );
    const by: Record<SortKey, (a: Entry, b: Entry) => number> = {
      added: (a, b) => b.at - a.at,
      title: (a, b) => a.movie.title.localeCompare(b.movie.title),
      year: (a, b) => (b.movie.release_date ?? '').localeCompare(a.movie.release_date ?? ''),
      rating: (a, b) => (b.movie.vote_average ?? 0) - (a.movie.vote_average ?? 0),
      runtime: (a, b) => (a.movie.runtime ?? 999) - (b.movie.runtime ?? 999),
    };
    return list.slice().sort(by[sort]);
  }, [entries, genre, decade, sort]);

  const decades = useMemo(
    () =>
      Array.from(
        new Set(
          entries
            .map((e) => Math.floor((yearOf(e.movie.release_date) ?? 0) / 10) * 10)
            .filter(Boolean),
        ),
      ).sort(),
    [entries],
  );

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(lib.exportData(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cinesphere-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importJson = async (file: File) => {
    try {
      const res = lib.importData(JSON.parse(await file.text()));
      setMessage(res.ok ? 'Imported — your lists were merged.' : res.error);
    } catch {
      setMessage('That file could not be read as JSON.');
    }
  };

  const tabs: { value: TabKey; label: string; count?: number }[] = [
    { value: 'watchlist', label: 'Watchlist', count: Object.keys(lib.watchlist).length },
    { value: 'seen', label: 'Seen', count: Object.keys(lib.seen).length },
    { value: 'rated', label: 'Rated', count: Object.keys(lib.ratings).length },
    { value: 'not', label: 'Not for me', count: Object.keys(lib.notInterested).length },
    ...lib.lists.map((l) => ({
      value: `list:${l.id}` as TabKey,
      label: l.name,
      count: l.movieIds.length,
    })),
    { value: 'stats', label: 'Stats' },
  ];
  const activeList = tab.startsWith('list:')
    ? lib.lists.find((l) => l.id === tab.slice(5))
    : undefined;
  const pickTab = (t: TabKey) => {
    setTab(t);
    setConfirmDelete(false);
    setRenaming(null);
  };

  return (
    <Room
      mark="Shelf · your library"
      title="Your shelf"
      lede="Everything you save lives in this browser. Export it to keep a copy or move it to another device."
      actions={
        <>
          <button type="button" className="btn btn-sm" onClick={exportJson}>
            <Download className="h-3.5 w-3.5" aria-hidden /> Export
          </button>
          <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" aria-hidden /> Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Import library JSON"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJson(f);
              e.target.value = '';
            }}
          />
        </>
      }
    >
      {!lib.hydrated ? (
        <GridSkeleton />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Seg label="Shelf sections" value={tab} onChange={pickTab} options={tabs} />
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newList.trim()) return;
                const id = lib.createList(newList);
                setNewList('');
                pickTab(`list:${id}`);
              }}
            >
              <label>
                <span className="sr-only">New list name</span>
                <input
                  className="field min-h-[36px] w-48"
                  placeholder="New list — e.g. Weekend"
                  value={newList}
                  onChange={(e) => setNewList(e.target.value)}
                />
              </label>
              <button type="submit" className="icon-btn h-9 w-9" aria-label="Create list">
                <Plus className="h-4 w-4" />
              </button>
            </form>
          </div>

          {message && (
            <p
              role="status"
              className="panel mt-4 flex items-center justify-between px-4 py-2.5 text-sm"
            >
              {message}
              <button type="button" aria-label="Dismiss" onClick={() => setMessage(null)}>
                <X className="h-4 w-4" />
              </button>
            </p>
          )}

          {activeList && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {renaming === activeList.id ? (
                <form
                  className="flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    lib.renameList(
                      activeList.id,
                      String(new FormData(e.currentTarget).get('name') ?? ''),
                    );
                    setRenaming(null);
                  }}
                >
                  <label>
                    <span className="sr-only">List name</span>
                    <input
                      name="name"
                      defaultValue={activeList.name}
                      className="field min-h-[36px]"
                      autoFocus
                    />
                  </label>
                  <button type="submit" className="btn-solid btn-sm">
                    Save
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setRenaming(activeList.id)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden /> Rename
                </button>
              )}
              {confirmDelete ? (
                <>
                  <span className="text-sm text-dim">
                    Delete “{activeList.name}”? The films stay on your shelf.
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm border-danger text-danger hover:bg-danger hover:text-white"
                    onClick={() => {
                      lib.deleteList(activeList.id);
                      pickTab('watchlist');
                    }}
                  >
                    Yes, delete
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Keep
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete list
                </button>
              )}
            </div>
          )}

          <div className="mt-7">
            {tab === 'stats' ? (
              <Stats />
            ) : (
              <>
                <div className="mb-6 flex flex-wrap gap-x-6 gap-y-3">
                  <Select label="Sort" value={sort} onChange={(v) => setSort(v as SortKey)}>
                    <option value="added">Recently added</option>
                    <option value="title">Title</option>
                    <option value="year">Release year</option>
                    <option value="rating">Rating</option>
                    <option value="runtime">Shortest first</option>
                  </Select>
                  <Select
                    label="Genre"
                    value={String(genre)}
                    onChange={(v) => setGenre(v ? Number(v) : '')}
                  >
                    <option value="">All genres</option>
                    {GENRES.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="Decade"
                    value={String(decade)}
                    onChange={(v) => setDecade(v ? Number(v) : '')}
                  >
                    <option value="">All decades</option>
                    {decades.map((d) => (
                      <option key={d} value={d}>
                        {d}s
                      </option>
                    ))}
                  </Select>
                </div>
                {shown.length === 0 ? (
                  <EmptyNote title="Empty shelf">
                    Save films from any poster or film and they land here.
                  </EmptyNote>
                ) : (
                  <ul className={GRID}>
                    {shown.map(({ movie, extra }) => (
                      <li key={movie.id}>
                        <PosterTile
                          movie={movie}
                          note={
                            (movie.runtime || extra) && (
                              <span className="flex gap-3 font-mono text-[10.5px]">
                                {movie.runtime ? <span>{formatRuntime(movie.runtime)}</span> : null}
                                {extra && <span className="text-accent">{extra}</span>}
                              </span>
                            )
                          }
                        >
                          <RemoveButton
                            tab={tab}
                            id={movie.id}
                            title={movie.title}
                            listId={activeList?.id}
                          />
                        </PosterTile>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </>
      )}
    </Room>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="t-mono text-dim">{label}</span>
      <select
        className="field min-h-[34px] w-auto text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function RemoveButton({
  tab,
  id,
  title,
  listId,
}: {
  tab: TabKey;
  id: number;
  title: string;
  listId?: string;
}) {
  const lib = useLibrary();
  const movie = lib.movies[id];
  const remove = () => {
    if (tab === 'watchlist') lib.removeFromWatchlist(id);
    else if (tab === 'seen') lib.setSeen(movie, false);
    else if (tab === 'rated') lib.rate(movie, 0);
    else if (tab === 'not') lib.clearNotInterested(id);
    else if (listId) lib.toggleInList(listId, movie);
  };
  return (
    <button
      type="button"
      onClick={remove}
      className="t-mono mt-1.5 text-[10px] text-dim underline-offset-4 hover:text-danger hover:underline"
      aria-label={`Remove ${title}`}
    >
      Remove
    </button>
  );
}

const countTop = <K extends string | number>(values: K[], n = 5) => {
  const m = new Map<K, number>();
  values.forEach((v) => m.set(v, (m.get(v) ?? 0) + 1));
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
};

function Stats() {
  const lib = useLibrary();
  const seen = Object.keys(lib.seen)
    .map((id) => lib.movies[Number(id)])
    .filter(Boolean);
  const minutes = seen.reduce((s, m) => s + (m.runtime ?? 0), 0);
  const known = seen.filter((m) => m.runtime).length;
  if (!seen.length)
    return (
      <EmptyNote title="No stats yet">Mark films as seen to unlock your viewing stats.</EmptyNote>
    );

  return (
    <div className="space-y-12">
      <div className="grid max-w-3xl grid-cols-2 gap-x-8">
        <div className="border-t-2 border-ink py-4">
          <p className="t-display text-[clamp(4rem,11vw,9rem)]">{seen.length}</p>
          <p className="t-mono mt-2 text-dim">Films seen</p>
        </div>
        <div className="border-t-2 border-accent py-4">
          <p className="t-display text-[clamp(4rem,11vw,9rem)] text-accent">
            {Math.round(minutes / 60)}
          </p>
          <p className="t-mono mt-2 text-dim">
            Hours watched{known < seen.length ? ` · runtime known for ${known}/${seen.length}` : ''}
          </p>
        </div>
      </div>
      <div className="grid gap-10 lg:grid-cols-3">
        <BarList
          title="Top genres"
          items={countTop(seen.flatMap((m) => m.genre_ids)).map(([g, c]) => [
            GENRE_NAMES[g] ?? `#${g}`,
            c,
          ])}
        />
        <BarList
          title="Top decades"
          items={countTop(
            seen.map((m) => Math.floor((yearOf(m.release_date) ?? 0) / 10) * 10).filter(Boolean),
          ).map(([d, c]) => [`${d}s`, c])}
        />
        <BarList
          title="Top directors"
          items={countTop(seen.flatMap((m) => (m.directors ?? []).map((d) => d.name)))}
        />
      </div>
    </div>
  );
}

function BarList({ title, items }: { title: string; items: [string, number][] }) {
  const max = Math.max(1, ...items.map(([, c]) => c));
  return (
    <div>
      <p className="t-mono mb-3 text-accent">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-dim">Not enough data yet.</p>
      ) : (
        <ul>
          {items.map(([label, count]) => (
            <li key={label} className="border-t border-ink/15 py-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[16px]">{label}</span>
                <span className="font-mono text-sm tabular-nums">{count}</span>
              </div>
              <div className="mt-1.5 h-[4px] bg-ink/10">
                <div className="h-full bg-ink" style={{ width: `${(count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Fills in runtime + directors for seen films saved from posters (which lack them). */
function useEnrichSeen() {
  const qc = useQueryClient();
  const hydrated = useLibrary((s) => s.hydrated);
  const ran = useRef(false);
  useEffect(() => {
    if (!hydrated || ran.current) return;
    ran.current = true;
    const { seen, movies, patchMovie } = useLibrary.getState();
    const missing = Object.keys(seen)
      .map(Number)
      .filter((id) => movies[id] && (movies[id].runtime == null || !movies[id].directors))
      .slice(0, 40);
    void mapLimit(missing, 4, async (id) => {
      const d = await qc.fetchQuery(featureQuery(id));
      patchMovie(id, {
        runtime: d.runtime,
        genre_ids: d.genres.map((g) => g.id),
        directors: (d.credits?.crew ?? [])
          .filter((c) => c.job === 'Director')
          .map((c) => ({ id: c.id, name: c.name })),
      });
    });
  }, [hydrated, qc]);
}
