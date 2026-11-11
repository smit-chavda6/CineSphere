'use client';

import { useEffect, useRef, useState } from 'react';
import { Backpack, Blend, BookmarkPlus, Trash2, Users, X } from 'lucide-react';
import { useLibrary } from '@/store/library';
import { POCKET_MAX, useUi } from '@/store/ui';
import { FILM_MIME, droppedFilm } from '@/components/ui/Poster';
import { Frame, Pic } from '@/components/ui/kit';
import { Go, go } from './nav';
import { cn } from '@/lib/utils';

/**
 * The pocket: films you carry from place to place. Drag any poster onto it (or use
 * the backpack button on a poster), then pour them into the Blender or Together.
 */
export function Pocket() {
  const pocket = useUi((s) => s.pocket);
  const carry = useUi((s) => s.carry);
  const drop = useUi((s) => s.drop);
  const empty = useUi((s) => s.emptyPocket);
  const addToWatchlist = useLibrary((s) => s.addToWatchlist);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Light up as a drop target whenever a poster is being dragged anywhere.
  useEffect(() => {
    const start = (e: DragEvent) => e.dataTransfer?.types.includes(FILM_MIME) && setDragging(true);
    const end = () => {
      setDragging(false);
      setOver(false);
    };
    window.addEventListener('dragstart', start);
    window.addEventListener('dragend', end);
    window.addEventListener('drop', end);
    return () => {
      window.removeEventListener('dragstart', start);
      window.removeEventListener('dragend', end);
      window.removeEventListener('drop', end);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', key, true);
    };
  }, [open]);

  const leave = (href: string) => {
    setOpen(false);
    go(href);
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Pocket: ${pocket.length} film${pocket.length === 1 ? '' : 's'} carried`}
        onClick={() => setOpen((o) => !o)}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(FILM_MIME)) {
            e.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          const m = droppedFilm(e);
          if (!m) return;
          e.preventDefault();
          if (!pocket.some((p) => p.id === m.id)) carry(m);
          setOpen(true);
        }}
        className={cn(
          'hud t-mono relative flex h-11 items-center gap-2 px-3 shadow-print-sm transition',
          dragging &&
            'border-accent text-accent outline-dashed outline-2 outline-offset-2 outline-accent',
          over && 'bg-accent text-on-accent',
        )}
      >
        <Backpack className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">{dragging ? 'Drop to carry' : 'Pocket'}</span>
        {pocket.length > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] text-on-accent">
            {pocket.length}
          </span>
        )}
      </button>

      {open && (
        <Frame
          role="dialog"
          aria-label="Pocket"
          className="fade-in absolute right-0 top-[calc(100%+10px)] z-40 w-[min(22rem,calc(100vw-1.5rem))] shadow-print"
          inner="p-4"
        >
          <div className="flex items-baseline justify-between">
            <p className="t-display text-2xl">Pocket</p>
            <p className="t-mono text-dim">
              {pocket.length}/{POCKET_MAX} carried
            </p>
          </div>
          {pocket.length === 0 ? (
            <p className="t-place mt-3 text-lg leading-snug text-dim">
              Empty. Drag any poster up here, or press the backpack on a poster, and carry films
              between places.
            </p>
          ) : (
            <>
              <ul className="mt-3 grid grid-cols-5 gap-2">
                {pocket.map((m) => (
                  <li key={m.id} className="group relative">
                    <Go
                      href={`/movie/${m.id}`}
                      onClick={() => setOpen(false)}
                      className="relative block aspect-[2/3] overflow-hidden rounded-[2px] border border-ink/30"
                      title={m.title}
                    >
                      <Pic
                        path={m.poster_path}
                        kind="poster"
                        alt={`Poster of ${m.title}`}
                        sizes="64px"
                        title={m.title}
                      />
                    </Go>
                    <button
                      type="button"
                      aria-label={`Drop ${m.title}`}
                      onClick={() => drop(m.id)}
                      className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-ink bg-island opacity-0 transition hover:bg-accent hover:text-on-accent focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="btn-solid btn-sm"
                  onClick={() => leave('/recommend/taste')}
                >
                  <Blend className="h-3.5 w-3.5" aria-hidden /> Blend these
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => leave('/recommend/together')}
                >
                  <Users className="h-3.5 w-3.5" aria-hidden /> Watch together
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => pocket.forEach((m) => addToWatchlist(m))}
                >
                  <BookmarkPlus className="h-3.5 w-3.5" aria-hidden /> Save all
                </button>
                <button type="button" className="btn btn-sm" onClick={empty}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Empty
                </button>
              </div>
              <p className="mt-3 text-[12px] leading-snug text-dim">
                In the Blender and Together, press “Pour in pocket” to use these as picks.
              </p>
            </>
          )}
        </Frame>
      )}
    </div>
  );
}
