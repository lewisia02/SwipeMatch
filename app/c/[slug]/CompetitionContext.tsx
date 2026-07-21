'use client';

import { createContext, useContext } from 'react';

interface CompetitionContextValue {
  slug: string;
  title: string;
}

const CompetitionContext = createContext<CompetitionContextValue | null>(null);

export function CompetitionProvider({
  slug,
  title,
  children,
}: CompetitionContextValue & { children: React.ReactNode }) {
  return (
    <CompetitionContext.Provider value={{ slug, title }}>{children}</CompetitionContext.Provider>
  );
}

export function useCompetition(): CompetitionContextValue {
  const value = useContext(CompetitionContext);
  if (!value) {
    throw new Error('useCompetitionはCompetitionProviderの配下でのみ使用できます');
  }
  return value;
}
