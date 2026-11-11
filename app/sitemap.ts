import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/utils';

const ROUTES = [
  '',
  '/atlas',
  '/discover',
  '/library',
  '/recommend',
  '/recommend/mood',
  '/recommend/taste',
  '/recommend/swipe',
  '/recommend/time-fit',
  '/recommend/together',
  '/recommend/hidden-gems',
  '/recommend/decades',
  '/recommend/surprise',
  '/recommend/marathon',
  '/recommend/upcoming',
  '/recommend/for-you',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return ROUTES.map((r) => ({
    url: `${base}${r}`,
    changeFrequency: r === '' ? 'daily' : 'weekly',
    priority: r === '' ? 1 : 0.7,
  }));
}
