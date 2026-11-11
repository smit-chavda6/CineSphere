/**
 * Parses free-form durations into minutes:
 * "1h 40m", "1 hr 40 min", "100", "100m", "2h", "2.5 hours", "1:40", "2" (hours).
 */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  const clock = s.match(/^(\d{1,2}):(\d{2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]) || null;

  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    // Bare small numbers are hours ("2"), bigger ones are minutes ("100").
    const minutes = n <= 12 ? n * 60 : n;
    return minutes > 0 ? Math.round(minutes) : null;
  }

  const h = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/);
  const m = s.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/);
  if (!h && !m) return null;
  const total = Math.round((h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0));
  return total > 0 ? total : null;
}

export function formatRuntime(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}
