'use client';

import Image, { type ImageLoaderProps } from 'next/image';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Compass, KeyRound, RotateCcw, Star, X } from 'lucide-react';
import { TMDB_IMAGE_BASE, sizeFor, type ImageKind } from '@/lib/tmdb/images';
import { ApiError } from '@/lib/tmdb/browser';
import { cn } from '@/lib/utils';

/* ---------------------------------------------------------------- Pic */

interface PicProps {
  path: string | null | undefined;
  kind: ImageKind;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
  /** Printed on the hatched placeholder when there is no artwork. */
  title?: string;
}

const loaders: Record<ImageKind, (p: ImageLoaderProps) => string> = {
  poster: ({ src, width }) => `${TMDB_IMAGE_BASE}/${sizeFor('poster', width)}${src}`,
  backdrop: ({ src, width }) => `${TMDB_IMAGE_BASE}/${sizeFor('backdrop', width)}${src}`,
  profile: ({ src, width }) => `${TMDB_IMAGE_BASE}/${sizeFor('profile', width)}${src}`,
  logo: ({ src, width }) => `${TMDB_IMAGE_BASE}/${sizeFor('logo', width)}${src}`,
};

/** TMDB artwork through next/image, using TMDB's own sized renditions. */
export function Pic({
  path,
  kind,
  alt,
  fill = true,
  width,
  height,
  sizes,
  priority,
  className,
  title,
}: PicProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [path]);

  if (!path || failed) {
    return (
      <div
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={cn('hatch flex items-end p-2.5', fill && 'absolute inset-0', className)}
        style={fill ? undefined : { width, height }}
      >
        {title && (
          <span className="t-display line-clamp-4 text-[clamp(0.9rem,1.6vw,1.3rem)] leading-[0.95] text-ink/45">
            {title}
          </span>
        )}
      </div>
    );
  }
  return (
    <Image
      loader={loaders[kind]}
      src={path}
      alt={alt}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes={sizes}
      priority={priority}
      draggable={false}
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  );
}

/* ---------------------------------------------------------------- Stars */

/** Accessible 1–5 star input. Choosing the current value clears it. */
export function Stars({
  value,
  onChange,
  label = 'Your rating',
}: {
  value: number;
  onChange: (n: number) => void;
  label?: string;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex items-center"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          tabIndex={value ? (value === n ? 0 : -1) : n === 1 ? 0 : -1}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(value === n ? 0 : n)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault();
              e.stopPropagation();
              onChange(Math.min(5, value + 1));
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault();
              e.stopPropagation();
              onChange(Math.max(0, value - 1));
            }
          }}
          className="grid h-10 w-8 place-items-center"
        >
          <Star
            className={cn(
              'h-5 w-5 transition',
              n <= shown ? 'fill-accent text-accent' : 'text-ink/30',
            )}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Seg */

/** Segmented control. */
export function Seg<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  label: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'no-scrollbar inline-flex max-w-full overflow-x-auto rounded-[3px] border border-ink/30',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            't-mono min-h-[36px] shrink-0 whitespace-nowrap border-l border-ink/20 px-3.5 transition first:border-l-0',
            value === o.value ? 'bg-ink text-paper' : 'text-ink/70 hover:bg-ink/10 hover:text-ink',
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={cn('ml-1.5', value === o.value ? 'text-paper/60' : 'text-accent')}>
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Sheet */

/** Bottom sheet for small screens. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    setTimeout(() => panel.current?.focus(), 0);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80]">
          <motion.div
            className="absolute inset-0 bg-ink/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 320 }}
            className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[10px] border-t border-ink bg-island p-5 pb-10 focus:outline-none"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="t-display text-3xl">{title}</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={onClose}
                aria-label={`Close ${title}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ---------------------------------------------------------------- Cartouche frame */

const GEMS: CSSProperties[] = [
  { left: 0, top: 0 },
  { left: '100%', top: 0 },
  { left: 0, top: '100%' },
  { left: '100%', top: '100%' },
];

/** The map's title-block frame: a double rule with a diamond at each corner. Used across the site. */
export function Frame({
  children,
  className,
  inner,
  glass,
  as: Tag = 'div',
  ...rest
}: {
  children: ReactNode;
  className?: string;
  inner?: string;
  glass?: boolean;
  as?: 'div' | 'header' | 'section' | 'aside';
} & Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'>) {
  return (
    <Tag className={cn('cartouche', glass && 'cartouche-glass', className)} {...rest}>
      {GEMS.map((p, i) => (
        <span key={i} className="cartouche-gem" style={p} aria-hidden />
      ))}
      <div className={cn('cartouche-inner', inner)}>{children}</div>
    </Tag>
  );
}

/** The striped scale bar from the map cartouche, as a small ornament. */
export function ScaleBar({
  label = 'Scale · 1 : 24 fps',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn('w-36', className)} aria-hidden>
      <div className="cartouche-scale">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} />
        ))}
      </div>
      <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-dim">{label}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- States */

export const GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-x-4 gap-y-7 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]';

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading" className={GRID}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton aspect-[2/3] w-full" aria-hidden />
      ))}
    </div>
  );
}

export function ReelSkeleton({ w = 'w-36' }: { w?: string }) {
  return (
    <div role="status" aria-label="Loading" className="flex gap-3 overflow-hidden">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className={cn('skeleton aspect-[2/3] shrink-0', w)} aria-hidden />
      ))}
    </div>
  );
}

/** Error note. A missing API key gets its own set-up instructions. */
export function ErrorNote({
  error,
  message,
  onRetry,
  className,
}: {
  error?: unknown;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  if (error instanceof ApiError && error.code === 'missing_key')
    return <SetupNote className={className} />;
  const text =
    message ?? (error instanceof Error ? error.message : 'Something went wrong. Please try again.');
  return (
    <div
      role="alert"
      className={cn(
        'panel flex flex-col items-start gap-4 border-danger/50 p-6 sm:flex-row sm:items-center',
        className,
      )}
    >
      <AlertTriangle className="h-6 w-6 shrink-0 text-danger" aria-hidden />
      <p className="flex-1 text-[15px]">{text}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyNote({
  title,
  children,
  className,
}: {
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Frame
      className={cn('mx-auto max-w-2xl', className)}
      inner="flex flex-col items-center gap-2 px-6 py-10 text-center"
    >
      <Compass className="h-6 w-6 text-accent" aria-hidden />
      <p className="t-display text-3xl">{title}</p>
      {children && <div className="max-w-md text-[15px] text-dim">{children}</div>}
    </Frame>
  );
}

export function SetupNote({ className }: { className?: string }) {
  return (
    <Frame as="section" className={cn('max-w-xl', className)} inner="p-6" aria-labelledby="setup">
      <KeyRound className="h-6 w-6 text-accent" aria-hidden />
      <h2 id="setup" className="t-display mt-3 text-3xl">
        Connect the movie database
      </h2>
      <ol className="mt-4 space-y-2 text-sm text-dim">
        <li>
          1. Create a free key at{' '}
          <a
            className="text-accent underline underline-offset-4"
            href="https://www.themoviedb.org/settings/api"
            target="_blank"
            rel="noopener noreferrer"
          >
            themoviedb.org/settings/api
          </a>
        </li>
        <li>
          2. Add{' '}
          <code className="bg-ink/10 px-1.5 py-0.5 font-mono text-[12px] text-ink">
            TMDB_API_KEY=…
          </code>{' '}
          to{' '}
          <code className="bg-ink/10 px-1.5 py-0.5 font-mono text-[12px] text-ink">.env.local</code>
        </li>
        <li>3. Restart the dev server. The key never leaves the server.</li>
      </ol>
    </Frame>
  );
}

/* ---------------------------------------------------------------- Form bits */

export function Picker({
  label,
  value,
  onChange,
  options,
  any = 'Any',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  any?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="t-mono text-dim">{label}</span>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{any}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Accessible dual-thumb range built from two native range inputs. */
export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  label,
  format = (n) => String(n),
}: {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  label: string;
  format?: (n: number) => string;
}) {
  const [lo, hi] = value;
  const pct = (n: number) => ((n - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] text-dim">{label}</span>
        <span className="font-mono text-[13px] tabular-nums">
          {format(lo)} <span className="text-dim">→</span> {format(hi)}
        </span>
      </div>
      <div className="range-dual">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-ink/30" />
        <div
          className="absolute top-1/2 h-[3px] -translate-y-1/2 bg-accent"
          style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          aria-label={`${label} minimum`}
          aria-valuetext={format(lo)}
          onChange={(e) => onChange([Math.min(Number(e.target.value), hi), hi])}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          aria-label={`${label} maximum`}
          aria-valuetext={format(hi)}
          onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo)])}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Room frame */

/** The standard frame of a place: a title block and a scrolling body. */
export function Room({
  mark,
  title,
  lede,
  actions,
  children,
  className,
}: {
  /** Small label above the title, e.g. "B1 · Moods". */
  mark: string;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  // Arriving at a place for the first time always starts at the top, unless you have
  // already scrolled yourself (the browser sometimes restores an old offset).
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let touched = false;
    const mark = () => (touched = true);
    el.addEventListener('wheel', mark, { passive: true });
    el.addEventListener('touchstart', mark, { passive: true });
    el.addEventListener('keydown', mark);
    const timers = [0, 400, 1200, 2500].map((t) =>
      setTimeout(() => {
        if (!touched && el.scrollTop > 0) el.scrollTop = 0;
      }, t),
    );
    return () => {
      timers.forEach(clearTimeout);
      el.removeEventListener('wheel', mark);
      el.removeEventListener('touchstart', mark);
      el.removeEventListener('keydown', mark);
    };
  }, []);

  return (
    <section
      ref={ref}
      className={cn(
        'fade-top absolute inset-0 overflow-y-auto overscroll-contain px-7 pb-28 pt-[5.5rem] sm:px-10 lg:px-16',
        className,
      )}
    >
      <Frame
        as="header"
        className="mb-6 sm:mb-8"
        inner="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 px-5 py-4 sm:gap-y-4 sm:px-8 sm:py-6"
      >
        <div className="min-w-0">
          <p className="t-mono text-accent">{mark}</p>
          <h1 className="t-display mt-2 text-balance text-[clamp(2.5rem,5.8vw,5.2rem)]">{title}</h1>
          {lede && (
            <p className="t-place mt-2 max-w-2xl text-[clamp(1.05rem,1.6vw,1.35rem)] leading-snug text-dim">
              {lede}
            </p>
          )}
        </div>
        <div className="flex flex-col items-start gap-4 sm:items-end">
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          <ScaleBar className="hidden md:block" />
        </div>
      </Frame>
      {children}
    </section>
  );
}
