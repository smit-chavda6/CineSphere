import type { Language } from '@/types/tmdb';

/** Languages pinned to the top of every language picker, in this order. */
export const PINNED_LANGUAGES: { code: string; name: string }[] = [
  { code: 'hi', name: 'Hindi' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'kn', name: 'Kannada' },
  { code: 'bn', name: 'Bengali' },
  { code: 'mr', name: 'Marathi' },
  { code: 'en', name: 'English' },
  { code: 'ko', name: 'Korean' },
  { code: 'ja', name: 'Japanese' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
];

const PINNED_CODES = new Set(PINNED_LANGUAGES.map((l) => l.code));

/** All languages except pinned ones, alphabetical, with the "No Language" entry removed. */
export function otherLanguages(all: Language[]): { code: string; name: string }[] {
  return all
    .filter((l) => !PINNED_CODES.has(l.iso_639_1) && l.iso_639_1 !== 'xx')
    .map((l) => ({ code: l.iso_639_1, name: l.english_name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function languageName(code: string | null | undefined, all?: Language[]): string {
  if (!code) return 'Unknown';
  const pinned = PINNED_LANGUAGES.find((l) => l.code === code);
  if (pinned) return pinned.name;
  const found = all?.find((l) => l.iso_639_1 === code);
  if (found) return found.english_name;
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}
