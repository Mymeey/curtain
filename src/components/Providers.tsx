'use client';

import { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

// This component is loaded with ssr: false, so no hydration mismatch possible
export default function Providers({ children }: ProvidersProps) {
  return <>{children}</>;
}
