import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { EB_Garamond, IM_Fell_English, IM_Fell_English_SC } from 'next/font/google';
import './globals.css';
import { AppProviders } from '@/components/atlas/AppProviders';
import { Atlas } from '@/components/atlas/Atlas';
import { SITE } from '@/config/site';
import { siteUrl } from '@/lib/utils';

// Old-map lettering: engraved small caps for names, Fell italic for places, Garamond for reading.
const display = IM_Fell_English_SC({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});
const serif = IM_Fell_English({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});
const sans = EB_Garamond({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s — ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.author }],
  creator: SITE.author,
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    title: SITE.name,
    description: SITE.description,
  },
  twitter: { card: 'summary_large_image', title: SITE.name, description: SITE.description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#e9dcbc',
  width: 'device-width',
  initialScale: 1,
};

/** Applies the saved chart theme before first paint, so a night chart never flashes daylight. */
const THEME_GUARD = `try{var s=JSON.parse(localStorage.getItem('cinesphere-ui')||'{}');if(s&&s.state&&s.state.theme==='night')document.documentElement.dataset.theme='night'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${serif.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_GUARD }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[300] focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
        >
          Skip to content
        </a>
        <AppProviders>
          {/* The whole site is one persistent stage; routes only carry metadata. */}
          <Suspense fallback={null}>
            <Atlas />
          </Suspense>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
