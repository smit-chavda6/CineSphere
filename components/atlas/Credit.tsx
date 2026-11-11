import { SITE } from '@/config/site';
import { cn } from '@/lib/utils';

/** The maker's credit, like an engraver's signature in the corner of a map sheet. */
export function Credit({ className }: { className?: string }) {
  return (
    <p className={cn('t-place text-[15px] text-dim', className)}>
      Made by <span className="text-ink">{SITE.author}</span>
    </p>
  );
}
