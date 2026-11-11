'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { personQuery } from '@/lib/queries';
import { Go } from '@/components/atlas/nav';
import { ErrorNote, Frame, GRID, Pic, Seg } from '@/components/ui/kit';
import { PosterTile } from '@/components/ui/Poster';
import { CapsuleLayout, CapsuleSkeleton, Chapters } from './parts';
import { formatDate, yearOf } from '@/lib/utils';
import type { MovieSummary } from '@/types/tmdb';

type Chapter = 'start' | 'known' | 'films' | 'bio';
type Credit = MovieSummary & { role: 'Acting' | 'Directing' | 'Writing'; detail: string };
type Role = 'All' | 'Acting' | 'Directing' | 'Writing';

export function PersonCapsule({ id, onName }: { id: number; onName: (label: string) => void }) {
  const q = useQuery(personQuery(id));
  const p = q.data;
  const [chapter, setChapter] = useState<Chapter>('start');

  useEffect(() => {
    if (p) onName(p.name);
  }, [p, onName]);

  const { credits, unique, startHere, knownFor } = useMemo(() => {
    const cast = p?.movie_credits?.cast ?? [];
    const crew = p?.movie_credits?.crew ?? [];
    const credits: Credit[] = [
      ...cast.map((c) => ({ ...c, role: 'Acting' as const, detail: c.character })),
      ...crew
        .filter((c) => c.department === 'Directing' || c.department === 'Writing')
        .map((c) => ({ ...c, role: c.department as 'Directing' | 'Writing', detail: c.job })),
    ];
    const unique = Array.from(
      new Map([...cast, ...crew].map((m) => [m.id, m as MovieSummary])).values(),
    );
    return {
      credits,
      unique,
      startHere: unique
        .filter((m) => m.vote_count >= 300)
        .sort((a, b) => b.vote_average - a.vote_average)
        .slice(0, 5),
      knownFor: unique
        .slice()
        .sort((a, b) => b.vote_count - a.vote_count)
        .slice(0, 18),
    };
  }, [p]);

  if (q.isLoading) return <CapsuleSkeleton />;
  if (q.isError || !p) {
    return (
      <div className="grid h-full place-items-center p-8">
        <ErrorNote error={q.error} onRetry={() => q.refetch()} className="max-w-xl" />
      </div>
    );
  }

  const facts: [string, string][] = [
    ['Born', p.birthday ? formatDate(p.birthday) : '—'],
    ...(p.place_of_birth ? ([['From', p.place_of_birth]] as [string, string][]) : []),
    ...(p.deathday ? ([['Died', formatDate(p.deathday)]] as [string, string][]) : []),
    ['Known for', p.known_for_department],
  ];

  return (
    <CapsuleLayout
      side={
        <>
          <div className="relative mx-auto aspect-[3/4] w-44 overflow-hidden rounded-[4px] border border-ink/40 shadow-[6px_6px_0_rgb(0_0_0/0.6)] sm:w-52 lg:w-full">
            <Pic
              path={p.profile_path}
              kind="profile"
              alt={`Photo of ${p.name}`}
              sizes="290px"
              priority
              title={p.name}
            />
          </div>
          <dl className="mt-6 border-t border-ink/20">
            {facts.map(([k, v]) => (
              <div
                key={k}
                className="grid grid-cols-[5.5rem_1fr] gap-3 border-b border-ink/15 py-2 text-[14px]"
              >
                <dt className="t-mono pt-0.5 text-dim">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </>
      }
    >
      <Frame as="header" className="shrink-0" inner="px-5 py-4 sm:px-7 sm:py-5">
        <p className="t-mono text-accent">
          {p.known_for_department} · {unique.length} films
        </p>
        <h1 className="t-display mt-3 text-balance text-[clamp(2.4rem,5.6vw,5.25rem)] lg:line-clamp-2">
          {p.name}
        </h1>
      </Frame>

      <div className="mt-5">
        <Chapters
          value={chapter}
          onChange={setChapter}
          options={[
            { value: 'start', label: 'Start here' },
            { value: 'known', label: 'Known for' },
            { value: 'films', label: 'Filmography', count: unique.length },
            { value: 'bio', label: 'Biography' },
          ]}
        />
      </div>

      <div
        key={chapter}
        className="fade-in mt-5 pr-1 [overflow-anchor:none] lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
      >
        {chapter === 'start' &&
          (startHere.length ? (
            <>
              <p className="t-place mb-4 text-xl text-dim">
                Their five best-rated films — the quickest way in.
              </p>
              <ol className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-4 gap-y-7 px-1 pt-1">
                {startHere.map((m, i) => (
                  <li key={m.id}>
                    <PosterTile movie={m} rank={i + 1} priority />
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="text-dim">Not enough rated films yet — try the filmography.</p>
          ))}

        {chapter === 'known' && (
          <ul className={`${GRID} px-1 pt-1`}>
            {knownFor.map((m) => (
              <li key={m.id}>
                <PosterTile movie={m} />
              </li>
            ))}
          </ul>
        )}

        {chapter === 'films' && <Filmography credits={credits} />}

        {chapter === 'bio' &&
          (p.biography ? (
            <p className="max-w-3xl whitespace-pre-line text-[17px] leading-relaxed text-ink/90">
              {p.biography}
            </p>
          ) : (
            <p className="text-dim">No biography has been written yet.</p>
          ))}
      </div>
    </CapsuleLayout>
  );
}

function Filmography({ credits }: { credits: Credit[] }) {
  const [role, setRole] = useState<Role>('All');
  const [sort, setSort] = useState<'year' | 'popularity'>('year');
  const roles = (['All', 'Acting', 'Directing', 'Writing'] as Role[]).filter(
    (r) => r === 'All' || credits.some((c) => c.role === r),
  );

  const rows = useMemo(() => {
    const merged = new Map<number, Credit & { details: string[] }>();
    for (const c of credits.filter((c) => role === 'All' || c.role === role)) {
      const cur = merged.get(c.id);
      if (cur) cur.details.push(c.detail || c.role);
      else merged.set(c.id, { ...c, details: [c.detail || c.role] });
    }
    return Array.from(merged.values()).sort((a, b) =>
      sort === 'year'
        ? (b.release_date || '9999').localeCompare(a.release_date || '9999')
        : b.popularity - a.popularity,
    );
  }, [credits, role, sort]);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Seg
          label="Filter by role"
          value={role}
          onChange={setRole}
          options={roles.map((r) => ({ value: r, label: r }))}
        />
        <Seg
          label="Sort filmography"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'year', label: 'By year' },
            { value: 'popularity', label: 'By popularity' },
          ]}
        />
        <span className="t-mono ml-auto text-dim">{rows.length} credits</span>
      </div>
      <ul className="border-t border-ink/20">
        {rows.map((c) => (
          <li key={c.id}>
            <Go
              href={`/movie/${c.id}`}
              className="group grid grid-cols-[3.5rem_1fr_auto] items-baseline gap-4 border-b border-ink/15 py-2.5 sm:grid-cols-[4rem_1fr_1fr_auto]"
            >
              <span className="font-mono text-[13px] tabular-nums text-dim group-hover:text-accent">
                {yearOf(c.release_date) ?? 'TBA'}
              </span>
              <span className="truncate text-[16px] font-medium transition-transform duration-300 ease-expo group-hover:translate-x-1.5">
                {c.title}
              </span>
              <span className="t-place hidden truncate text-[16px] text-dim sm:block">
                {c.details.filter(Boolean).join(' · ')}
              </span>
              <span className="flex items-center gap-2 font-mono text-[12px] tabular-nums text-dim">
                {c.vote_count > 0 && `★ ${c.vote_average.toFixed(1)}`}
                <ArrowUpRight
                  className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100"
                  aria-hidden
                />
              </span>
            </Go>
          </li>
        ))}
      </ul>
    </>
  );
}
