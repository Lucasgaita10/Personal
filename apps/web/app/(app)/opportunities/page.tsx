'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Pill } from '@/components/ui/pill';
import { NewOpportunityDialog } from '@/components/opportunity/NewOpportunityDialog';
import { api } from '@/lib/api';

const STAGE_COLS: { key: string; label: string; sub: string }[] = [
  { key: 'context', label: 'Context', sub: 'Briefing & deal facts' },
  { key: 'initial-screening', label: 'Initial Screening', sub: 'Docs uploaded & classified' },
  { key: 'understanding', label: 'Understanding', sub: 'AI analysis complete' },
  { key: 'cio-review', label: 'CIO Review', sub: 'Chat / scenarios' },
  { key: 'recommendation', label: 'Recommendation', sub: 'IC memo & decision' },
  { key: 'monitoring', label: 'Monitoring', sub: 'Post-approval' },
];

type Opportunity = {
  id: string;
  name: string;
  sponsor: string | null;
  workflowStage: string;
  city?: string | null;
  country?: string | null;
  riskScore?: number | null;
  icReadinessScore?: number | null;
  recommendation?: string | null;
  client?: { id: string; name: string } | null;
};

export default function PipelinePage() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = (await api.opportunities()) as Opportunity[];
      setItems(data);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const decisionLabel = (rec?: string | null) =>
    rec === 'PROCEED'
      ? 'Approved'
      : rec === 'PROCEED_WITH_CONDITIONS'
        ? 'Approved (conditions)'
        : rec === 'REJECT'
          ? 'Rejected'
          : null;

  return (
    <>
      <Topbar title="Pipeline" subtitle="Opportunities by workflow stage" />
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-sg-muted">
            {loading ? 'Loading…' : `${items.length} opportunities`}
            {error ? ` · ${error}` : ''}
          </div>
          <NewOpportunityDialog onCreated={load} />
        </div>
        <div className="grid grid-cols-6 gap-3">
          {STAGE_COLS.map((col) => {
            const colItems = items.filter((o) => o.workflowStage === col.key);
            return (
              <div key={col.key} className="space-y-2 min-w-0">
                <div className="px-1">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-sg-muted flex items-center justify-between">
                    <span className="truncate">{col.label}</span>
                    <span className="text-sg-muted-light tabular-nums">{colItems.length}</span>
                  </div>
                  <div className="text-[10px] text-sg-muted-light truncate">{col.sub}</div>
                </div>
                <div className="space-y-2">
                  {colItems.map((o) => (
                    <Link key={o.id} href={`/opportunities/${o.id}/${o.workflowStage}`}>
                      <div className="sg-card p-3 hover:border-sg-primary/40 transition-colors cursor-pointer">
                        <div className="text-sm font-medium leading-tight">{o.name}</div>
                        {o.sponsor && (
                          <div className="text-xs text-sg-muted mt-1 truncate">
                            {o.sponsor}
                          </div>
                        )}
                        {(o.city || o.country) && (
                          <div className="text-[11px] text-sg-muted-light mt-0.5 truncate">
                            {[o.city, o.country].filter(Boolean).join(', ')}
                          </div>
                        )}
                        {o.client && (
                          <div className="text-[11px] text-sg-muted-light mt-0.5 truncate">
                            {o.client.name}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {decisionLabel(o.recommendation) && (
                            <Pill
                              variant={
                                o.recommendation === 'REJECT'
                                  ? ('severity-high' as any)
                                  : ('severity-low' as any)
                              }
                            >
                              {decisionLabel(o.recommendation)}
                            </Pill>
                          )}
                          {o.riskScore != null && (
                            <Pill>Risk {Number(o.riskScore).toFixed(1)}</Pill>
                          )}
                          {o.icReadinessScore != null && (
                            <Pill>IC {Number(o.icReadinessScore).toFixed(1)}</Pill>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                  {colItems.length === 0 && (
                    <div className="sg-card-muted p-3 text-xs text-sg-muted-light text-center">
                      No items
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
