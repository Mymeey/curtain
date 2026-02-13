'use client';

import { ReactNode, useState, useEffect } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Delay mounting to ensure browser extensions have finished modifying DOM
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Show loading skeleton until fully client-side mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950" suppressHydrationWarning>
        <div className="animate-pulse p-4">
          <div className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded mb-4"></div>
          <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded mb-4"></div>
          <div className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
