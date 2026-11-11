'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { shouldRetry } from '@/lib/tmdb/browser';
import { useLibrary } from '@/store/library';
import { useUi } from '@/store/ui';

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            gcTime: 1000 * 60 * 30,
            retry: shouldRetry,
            retryDelay: (n) => Math.min(800 * 2 ** n, 5000),
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // Load persisted stores after mount so server and client HTML match.
  useEffect(() => {
    const unsub = useLibrary.persist.onFinishHydration(() =>
      useLibrary.setState({ hydrated: true }),
    );
    void useLibrary.persist.rehydrate();
    void useUi.persist.rehydrate();
    return unsub;
  }, []);

  // The chart theme lives on <html> so every layer (and the page background) follows it.
  const theme = useUi((s) => s.theme);
  useEffect(() => {
    // Read the store directly: on first mount it has just been rehydrated, while `theme` is still the default.
    const now = useUi.getState().theme;
    document.documentElement.dataset.theme = now;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', now === 'night' ? '#1e1711' : '#e9dcbc');
  }, [theme]);

  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </QueryClientProvider>
  );
}
