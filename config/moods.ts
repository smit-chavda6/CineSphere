import { G } from './genres';
import type { SortKey } from '@/lib/tmdb/discover';

/**
 * Mood → discovery recipe. This is the single place to tune moods.
 *
 * - withGenres are OR-ed ("any of"); withoutGenres are always excluded.
 * - keywords are TMDB keyword *names*; they are resolved to ids at runtime via
 *   /search/keyword, so the config survives keyword-id changes. Keyword matches are
 *   ranked first; if they are too few, genre-only results fill the rest.
 */
export interface MoodConfig {
  id: string;
  label: string;
  emoji: string;
  blurb: string;
  /** Two CSS colours for the tile gradient. */
  hue: [string, string];
  withGenres: number[];
  withoutGenres?: number[];
  keywords?: string[];
  minRating: number;
  minVotes: number;
  sort: SortKey;
}

export const MOODS: MoodConfig[] = [
  {
    id: 'feel-good',
    label: 'Feel-good',
    emoji: '☀️',
    blurb: 'Warm, light, leaves you smiling.',
    hue: ['#fde68a', '#f472b6'],
    withGenres: [G.comedy, G.family, G.music],
    withoutGenres: [G.horror, G.thriller, G.war, G.crime],
    keywords: ['feel-good', 'friendship', 'hope', 'small town'],
    minRating: 6.8,
    minVotes: 500,
    sort: 'popularity',
  },
  {
    id: 'mind-bending',
    label: 'Mind-bending',
    emoji: '🌀',
    blurb: 'Twists, loops and unreliable reality.',
    hue: ['#67e8f9', '#a78bfa'],
    withGenres: [G.scifi, G.mystery, G.thriller],
    keywords: ['time travel', 'plot twist', 'dream', 'parallel world', 'time loop', 'nonlinear timeline'],
    minRating: 7.0,
    minVotes: 800,
    sort: 'rating',
  },
  {
    id: 'make-me-cry',
    label: 'Make me cry',
    emoji: '💧',
    blurb: 'Bring tissues. Seriously.',
    hue: ['#93c5fd', '#818cf8'],
    withGenres: [G.drama, G.romance],
    withoutGenres: [G.horror, G.comedy],
    keywords: ['tearjerker', 'grief', 'terminal illness', 'loss of loved one', 'sacrifice'],
    minRating: 7.0,
    minVotes: 500,
    sort: 'rating',
  },
  {
    id: 'edge-of-seat',
    label: 'Edge of my seat',
    emoji: '⚡',
    blurb: 'Tension you can feel in your knees.',
    hue: ['#fca5a5', '#fb923c'],
    withGenres: [G.thriller, G.action, G.crime],
    withoutGenres: [G.family, G.animation],
    keywords: ['suspense', 'cat and mouse', 'heist', 'manhunt', 'hostage'],
    minRating: 6.8,
    minVotes: 800,
    sort: 'popularity',
  },
  {
    id: 'laugh',
    label: 'Laugh out loud',
    emoji: '😂',
    blurb: 'Pure comedy, no homework.',
    hue: ['#fef08a', '#4ade80'],
    withGenres: [G.comedy],
    withoutGenres: [G.horror, G.war],
    keywords: ['parody', 'slapstick comedy', 'satire', 'buddy comedy', 'spoof'],
    minRating: 6.5,
    minVotes: 500,
    sort: 'popularity',
  },
  {
    id: 'romantic',
    label: 'Romantic',
    emoji: '💞',
    blurb: 'Butterflies guaranteed.',
    hue: ['#f9a8d4', '#fb7185'],
    withGenres: [G.romance],
    withoutGenres: [G.horror],
    keywords: ['romantic comedy', 'first love', 'love at first sight', 'falling in love'],
    minRating: 6.7,
    minVotes: 400,
    sort: 'popularity',
  },
  {
    id: 'scary',
    label: 'Scary',
    emoji: '👻',
    blurb: 'Lights off. Don’t look behind you.',
    hue: ['#a3a3a3', '#7c3aed'],
    withGenres: [G.horror],
    keywords: ['supernatural horror', 'haunted house', 'slasher', 'possession', 'found footage'],
    minRating: 6.3,
    minVotes: 400,
    sort: 'popularity',
  },
  {
    id: 'inspiring',
    label: 'Inspiring',
    emoji: '🚀',
    blurb: 'True stories and underdogs.',
    hue: ['#fcd34d', '#34d399'],
    withGenres: [G.drama, G.history],
    withoutGenres: [G.horror],
    keywords: ['based on true story', 'biography', 'sports', 'underdog', 'overcoming adversity'],
    minRating: 7.2,
    minVotes: 500,
    sort: 'rating',
  },
  {
    id: 'chill',
    label: 'Chill / Comfort',
    emoji: '🍵',
    blurb: 'Cosy, gentle, low stakes.',
    hue: ['#a7f3d0', '#7dd3fc'],
    withGenres: [G.comedy, G.animation, G.family],
    withoutGenres: [G.horror, G.thriller, G.war, G.crime],
    keywords: ['slice of life', 'coming of age', 'cozy', 'friendship'],
    minRating: 6.8,
    minVotes: 300,
    sort: 'rating',
  },
  {
    id: 'epic',
    label: 'Epic adventure',
    emoji: '🗺️',
    blurb: 'Big worlds, bigger journeys.',
    hue: ['#fdba74', '#38bdf8'],
    withGenres: [G.adventure, G.fantasy, G.action],
    keywords: ['epic', 'quest', 'sword and sorcery', 'space opera', 'mythology'],
    minRating: 7.0,
    minVotes: 1000,
    sort: 'popularity',
  },
  {
    id: 'dark',
    label: 'Dark & gritty',
    emoji: '🌑',
    blurb: 'Morally grey and beautifully bleak.',
    hue: ['#64748b', '#ef4444'],
    withGenres: [G.crime, G.thriller, G.drama],
    withoutGenres: [G.family, G.animation, G.comedy],
    keywords: ['neo-noir', 'gangster', 'corruption', 'revenge', 'psychological thriller'],
    minRating: 7.0,
    minVotes: 500,
    sort: 'rating',
  },
  {
    id: 'family',
    label: 'Family night',
    emoji: '🍿',
    blurb: 'Something everyone on the sofa will love.',
    hue: ['#86efac', '#fde047'],
    withGenres: [G.family, G.animation],
    withoutGenres: [G.horror, G.thriller, G.crime, G.war],
    keywords: ['family', 'animals', 'talking animals'],
    minRating: 6.5,
    minVotes: 300,
    sort: 'popularity',
  },
];
