'use client';

import { useEffect, useRef, useState } from 'react';
import { Moon, Settings2, Sun } from 'lucide-react';
import { REGIONS, regionName } from '@/config/regions';
import { FOCUS_OPTIONS, type Focus } from '@/lib/focus';
import { useLibrary } from '@/store/library';
import { useUi } from '@/store/ui';
import { Frame } from '@/components/ui/kit';
import { Credit } from './Credit';
import { cn } from '@/lib/utils';

/**
 * Region, which films to suggest, and day or night chart, gathered behind one
 * button on phones and tablets (wide screens show them inline in the top bar).
 */
export function Settings() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const region = useLibrary((s) => s.region);
  const setRegion = useLibrary((s) => s.setRegion);
  const focus = useUi((s) => s.focus);
  const setFocus = useUi((s) => s.setFocus);
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', key, true);
    };
  }, [open]);

  return (
    <div ref={root} className="relative lg:hidden">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Settings: region, films and day or night"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'hud t-mono flex h-11 items-center gap-2 px-3 shadow-print-sm transition',
          open && 'bg-ink text-paper',
        )}
      >
        <Settings2 className="h-4 w-4" aria-hidden />
        <span>{region}</span>
      </button>
      {open && (
        <Frame
          role="dialog"
          aria-label="Settings"
          className="fade-in absolute right-0 top-[calc(100%+10px)] z-40 w-[min(19rem,calc(100vw-2.5rem))] shadow-print"
          inner="space-y-4 p-4"
        >
          <label className="block">
            <span className="t-mono text-dim">Your region</span>
            <select className="field" value={region} onChange={(e) => setRegion(e.target.value)}>
              {REGIONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="t-mono text-dim">Films to suggest</legend>
            <div className="mt-2 grid gap-1.5">
              {FOCUS_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={focus === o.value}
                  onClick={() => setFocus(o.value as Focus)}
                  className={cn('btn btn-sm !justify-start', focus === o.value && 'btn-on')}
                >
                  {o.label(regionName(region))}
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <p className="t-mono text-dim">Chart</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                aria-pressed={theme === 'day'}
                onClick={() => setTheme('day')}
                className={cn('btn btn-sm', theme === 'day' && 'btn-on')}
              >
                <Sun className="h-3.5 w-3.5" aria-hidden /> Day
              </button>
              <button
                type="button"
                aria-pressed={theme === 'night'}
                onClick={() => setTheme('night')}
                className={cn('btn btn-sm', theme === 'night' && 'btn-on')}
              >
                <Moon className="h-3.5 w-3.5" aria-hidden /> Night
              </button>
            </div>
          </div>
          <Credit className="border-t border-ink/30 pt-3 text-center" />
        </Frame>
      )}
    </div>
  );
}
