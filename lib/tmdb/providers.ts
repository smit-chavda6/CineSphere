/**
 * TMDB lists which services carry a film but only links to its own watch page.
 * This turns a provider into a link on the provider's own site: a search for the
 * film there, which lands on (or one click from) the title page. Unknown services
 * fall back to JustWatch for the viewer's region, which links straight out.
 */

type Builder = (q: string, region: string) => string;

const RULES: [RegExp, Builder][] = [
  [/netflix/i, (q) => `https://www.netflix.com/search?q=${q}`],
  [
    /amazon prime|prime video|amazon video/i,
    (q) => `https://www.primevideo.com/search/ref=atv_nb_sug?phrase=${q}`,
  ],
  [
    /hotstar|jiohotstar|disney\+ hotstar/i,
    (q) => `https://www.hotstar.com/in/explore?search_query=${q}`,
  ],
  [/jiocinema/i, (q) => `https://www.hotstar.com/in/explore?search_query=${q}`],
  [/disney plus|disney\+/i, (q) => `https://www.google.com/search?q=${q}+site%3Adisneyplus.com`],
  [/apple tv|itunes/i, (q) => `https://tv.apple.com/search?term=${q}`],
  [/google play/i, (q) => `https://play.google.com/store/search?q=${q}&c=movies`],
  [/youtube/i, (q) => `https://www.youtube.com/results?search_query=${q}+full+movie`],
  [/zee5/i, (q) => `https://www.zee5.com/search?q=${q}`],
  [/sony ?liv/i, (q) => `https://www.sonyliv.com/search?searchTerm=${q}`],
  [/mubi/i, (q) => `https://mubi.com/en/search/films?query=${q}`],
  [/hbo|max\b/i, (q) => `https://play.max.com/search?q=${q}`],
  [/hulu/i, (q) => `https://www.hulu.com/search?q=${q}`],
  [/paramount/i, (q) => `https://www.paramountplus.com/search/?q=${q}`],
  [/peacock/i, (q) => `https://www.peacocktv.com/search?q=${q}`],
  [/crunchyroll/i, (q) => `https://www.crunchyroll.com/search?q=${q}`],
  [/aha\b/i, (q) => `https://www.aha.video/search?q=${q}`],
  [/sun nxt/i, (q) => `https://www.sunnxt.com/search?q=${q}`],
  [/hoichoi/i, (q) => `https://www.hoichoi.tv/search?q=${q}`],
  [/eros/i, (q) => `https://erosnow.com/search?q=${q}`],
  [/lionsgate/i, (q) => `https://www.lionsgateplay.com/search?q=${q}`],
  [/plex/i, (q) => `https://watch.plex.tv/search?q=${q}`],
  [/tubi/i, (q) => `https://tubitv.com/search/${q}`],
  [/pluto/i, (q) => `https://pluto.tv/search/details?query=${q}`],
  [/rakuten/i, (q) => `https://www.rakuten.tv/search?q=${q}`],
  [/microsoft|xbox/i, (q) => `https://www.microsoft.com/en-us/search/shop/movies?q=${q}`],
  [/vudu|fandango/i, (q) => `https://www.vudu.com/content/movies/search?searchString=${q}`],
];

export function providerLink(
  provider: string,
  title: string,
  year: number | null,
  region: string,
): string {
  const q = encodeURIComponent(title);
  for (const [re, build] of RULES) if (re.test(provider)) return build(q, region);
  const withYear = encodeURIComponent(year ? `${title} ${year}` : title);
  return `https://www.justwatch.com/${region.toLowerCase()}/search?q=${withYear}`;
}
