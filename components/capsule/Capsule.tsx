'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, X } from 'lucide-react';
import { useUi } from '@/store/ui';
import { Go, go, lastPointer, type EntityKind } from '@/components/atlas/nav';
import type { TrailStop } from '@/components/atlas/Atlas';
import { Shore, shoreGeometry } from '@/components/atlas/Shore';
import { FilmCapsule } from './FilmCapsule';
import { PersonCapsule } from './PersonCapsule';
import { CollectionCapsule } from './CollectionCapsule';
import { cn } from '@/lib/utils';

interface Props {
  kind: EntityKind;
  id: number;
  trail: TrailStop[];
  onName: (href: string, label: string) => void;
  onClose: () => void;
  reduced: boolean;
}

/**
 * The projection room. A film, person or franchise opens over the chart like a
 * camera iris from wherever you pressed, lights down. Walking from film to person
 * to film leaves a trail along the top that you can step back along.
 */
export function Capsule({ kind, id, trail, onName, onClose, reduced }: Props) {
  const origin = useRef(lastPointer()).current;
  const root = useRef<HTMLDivElement>(null);
  const openSearch = useUi((s) => s.openSearch);
  const href = `/${kind}/${id}`;
  const name = useCallback((label: string) => onName(href, label), [href, onName]);

  useEffect(() => {
    root.current?.focus({ preventScroll: true });
  }, [href]);

  const previous = trail.length > 1 ? trail[trail.length - 2] : null;

  // Every film, person and franchise is its own island on the chart.
  const [vp, setVp] = useState({ w: 1440, h: 900 });
  useEffect(() => {
    const read = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);
  const shore = useMemo(() => shoreGeometry(vp.w, vp.h, href), [vp.w, vp.h, href]);

  // Backspace steps back along the trail (or back to the chart from the first stop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        e.target instanceof Element &&
        e.target.closest('input,textarea,select,[contenteditable]')
      )
        return;
      if (useUi.getState().searchOpen) return;
      e.preventDefault();
      if (previous) go(previous.href);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previous, onClose]);
  const at = `${origin.x}px ${origin.y}px`;

  return (
    <motion.div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={trail[trail.length - 1]?.label ?? 'Details'}
      tabIndex={-1}
      className="parchment absolute inset-0 z-50 text-ink outline-none"
      initial={reduced ? { opacity: 0 } : { clipPath: `circle(0% at ${at})` }}
      animate={reduced ? { opacity: 1 } : { clipPath: `circle(150% at ${at})` }}
      exit={{ opacity: 0, transition: { duration: 0.22 } }}
      transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1] }}
    >
      <Shore art={shore} show />
      <div
        key={href}
        className="fade-in absolute inset-0"
        style={{ clipPath: `path('${shore.land}')` }}
      >
        {kind === 'movie' ? (
          <FilmCapsule id={id} onName={name} />
        ) : kind === 'person' ? (
          <PersonCapsule id={id} onName={name} />
        ) : (
          <CollectionCapsule id={id} onName={name} />
        )}
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 p-[18px] sm:p-[20px]">
        {previous ? (
          <Go
            href={previous.href}
            className="hud pointer-events-auto grid h-11 w-11 shrink-0 place-items-center transition hover:bg-ink hover:text-paper"
            aria-label={`Back to ${previous.label}`}
            title={`Back to ${previous.label}`}
          >
            <ArrowLeft className="h-4 w-4" />
          </Go>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="hud pointer-events-auto grid h-11 w-11 shrink-0 place-items-center transition hover:bg-ink hover:text-paper"
            aria-label="Back to the chart"
            title="Back to the chart"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <nav
          aria-label="Trail"
          className="hud pointer-events-auto hidden h-11 min-w-0 items-center gap-1 overflow-hidden px-3 md:flex"
        >
          <button
            type="button"
            onClick={onClose}
            className="t-mono shrink-0 text-dim transition hover:text-accent"
          >
            Chart
          </button>
          {trail.map((s, i) => {
            const last = i === trail.length - 1;
            return (
              <span key={s.href} className="flex min-w-0 items-center gap-1">
                <span className="text-dim/60" aria-hidden>
                  /
                </span>
                {last ? (
                  <span className="t-mono max-w-[18rem] truncate text-accent" aria-current="page">
                    {s.label}
                  </span>
                ) : (
                  <Go
                    href={s.href}
                    className={cn(
                      't-mono max-w-[10rem] truncate text-dim transition hover:text-accent',
                      trail.length > 4 && i < trail.length - 3 && 'hidden xl:inline',
                    )}
                  >
                    {s.label}
                  </Go>
                )}
              </span>
            );
          })}
        </nav>
        <div className="pointer-events-auto ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => openSearch()}
            className="hud grid h-11 w-11 place-items-center transition hover:bg-ink hover:text-paper"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="hud t-mono flex h-11 items-center gap-2 px-3 transition hover:bg-ink hover:text-paper"
            aria-label="Close and return to the chart"
          >
            <X className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Close</span>
            <kbd className="hidden rounded-[2px] border border-current px-1 text-[10px] opacity-60 sm:inline">
              Esc
            </kbd>
          </button>
        </div>
      </header>
    </motion.div>
  );
}
