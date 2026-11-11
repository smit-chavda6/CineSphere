'use client';

import { useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Shared tab strip for capsule chapters. Number keys jump between them. */
export function Chapters<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest('input,textarea,select')) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= options.length) {
        onChange(options[n - 1].value);
        return;
      }
      // Left and right step through the chapters.
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.shiftKey) {
        const i = options.findIndex((o) => o.value === value);
        const next = options[i + (e.key === 'ArrowRight' ? 1 : -1)];
        if (next) {
          e.preventDefault();
          onChange(next.value);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, onChange, value]);

  return (
    <div
      role="tablist"
      aria-label="Chapters"
      className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto border-b border-ink/25 px-1"
    >
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            't-mono relative shrink-0 px-3 pb-3 pt-2 transition',
            value === o.value ? 'text-ink' : 'text-dim hover:text-ink',
          )}
        >
          <span className="mr-1.5 text-accent">{i + 1}</span>
          {o.label}
          {o.count !== undefined && <span className="ml-1.5 opacity-60">{o.count}</span>}
          {value === o.value && (
            <span className="absolute inset-x-2 -bottom-px h-[3px] bg-accent" aria-hidden />
          )}
        </button>
      ))}
    </div>
  );
}

/** Two-column capsule body: a fixed side column and a main column whose last child scrolls. */
export function CapsuleLayout({
  backdrop,
  side,
  children,
}: {
  backdrop?: ReactNode;
  side: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative h-full">
      {backdrop && (
        <div
          className="absolute inset-0 opacity-[0.22] grayscale sepia [mask-image:radial-gradient(ellipse_at_78%_18%,#000_0%,#000_25%,transparent_70%)]"
          aria-hidden
        >
          {backdrop}
        </div>
      )}
      <div className="fade-top relative h-full overflow-y-auto px-8 pb-12 pt-[5.5rem] sm:px-10 lg:grid lg:grid-cols-[minmax(210px,290px)_minmax(0,1fr)] lg:gap-12 lg:overflow-hidden lg:px-16 lg:pb-10">
        <aside className="no-scrollbar lg:min-h-0 lg:overflow-y-auto lg:pb-2">{side}</aside>
        <div className="mt-6 min-w-0 lg:mt-0 lg:flex lg:min-h-0 lg:flex-col">{children}</div>
      </div>
    </div>
  );
}

export function CapsuleSkeleton() {
  return (
    <CapsuleLayout side={<div className="skeleton mx-auto aspect-[2/3] w-44 lg:w-full" />}>
      <div role="status" aria-label="Loading" className="space-y-4">
        <div className="skeleton h-4 w-56" />
        <div className="skeleton h-[clamp(3rem,6vw,5rem)] w-4/5" />
        <div className="skeleton h-6 w-2/5" />
        <div className="skeleton h-40 w-full max-w-3xl" />
      </div>
    </CapsuleLayout>
  );
}
