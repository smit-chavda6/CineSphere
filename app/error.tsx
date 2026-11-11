'use client';

import { useEffect } from 'react';

/** Route-level errors only affect metadata; the chart keeps running, so this stays out of the way. */
export default function ErrorPage({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return null;
}
