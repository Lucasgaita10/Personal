'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

export type OpportunityFull = {
  id: string;
  name: string;
  sponsor: string | null;
  propertyType: string | null;
  subType: string | null;
  geography: string | null;
  city: string | null;
  country: string | null;
  size: string | null;
  askingEquity: number | null;
  totalCapitalization: number | null;
  targetIrr: number | null;
  targetMoic: number | null;
  holdPeriodYears: number | null;
  stage: string;
  recommendation: string | null;
  opportunityScore: number | null;
  riskScore: number | null;
  confidenceScore: number | null;
  icReadinessScore: number | null;
  thesis: string | null;
  executiveSummary: string | null;
  client: { id: string; name: string } | null;
  documents: any[];
  metrics: any[];
  risks: any[];
  gaps: any[];
  scenarios: any[];
  reports: any[];
};

type Ctx = {
  opportunity: OpportunityFull | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const OpportunityCtx = createContext<Ctx | null>(null);

export function OpportunityProvider({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const [opportunity, setOpportunity] = useState<OpportunityFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // Don't flip loading=true on subsequent refreshes — that replaces the
    // whole page with "Loading…" and resets scroll. Initial fetch already
    // starts with loading=true from useState, and we clear it once below.
    setError(null);
    try {
      const data = (await api.opportunity(id)) as OpportunityFull;
      setOpportunity(data);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <OpportunityCtx.Provider value={{ opportunity, loading, error, refresh }}>
      {children}
    </OpportunityCtx.Provider>
  );
}

export function useOpportunity(): Ctx {
  const ctx = useContext(OpportunityCtx);
  if (!ctx) throw new Error('useOpportunity must be used within OpportunityProvider');
  return ctx;
}
