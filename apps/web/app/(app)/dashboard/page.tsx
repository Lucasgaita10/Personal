'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { MetricCard } from '@/components/charts/MetricCard';
import { RiskHeatmap } from '@/components/charts/RiskHeatmap';
import { Pill } from '@/components/ui/pill';
import { api } from '@/lib/api';

type Opportunity = {
  id: string;
  name: string;
  workflowStage: string;
  riskScore?: number | null;
  recommendation?: string | null;
  client?: { name: string } | null;
};

type HeatmapRow = { category: string; severity: string; _count: { _all: number } };

const STAGE_LABEL: Record<string, string> = {
  context: 'Context',
  'initial-screening': 'Initial Screening',
  understanding: 'Understanding',
  'cio-review': 'CIO Review',
  recommendation: 'Recommendation',
  monitoring: 'Monitoring',
};

type ClientOption = { id: string; name: string };

export default function DashboardPage() {
  const [opps, setOpps] = useState<Opportunity[] | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState<string>('');

  useEffect(() => {
    api
      .clients()
      .then((c) => setClients(c as ClientOption[]))
      .catch(() => setClients([]));
  }, []);

  useEffect(() => {
    setOpps(null);
    Promise.all([
      api.opportunities(clientId ? { clientId } : {}),
      api.riskHeatmap(clientId ? { clientId } : {}),
    ])
      .then(([os, h]) => {
        setOpps(os as Opportunity[]);
        setHeatmap(h as HeatmapRow[]);
      })
      .catch((err) => setError(err.message ?? 'Failed to load'));
  }, [clientId]);

  const activeClient = clients.find((c) => c.id === clientId);

  // Counts per workflow stage
  const stageCount = (key: string) =>
    (opps ?? []).filter((o) => o.workflowStage === key).length;

  // Decision-status counts (mutually exclusive)
  const list = opps ?? [];
  const underAssessment = list.filter(
    (o) => !o.recommendation || o.recommendation === 'NEED_MORE_INFO',
  ).length;
  const approved = list.filter((o) => o.recommendation === 'PROCEED').length;
  const approvedWithConditions = list.filter(
    (o) => o.recommendation === 'PROCEED_WITH_CONDITIONS',
  ).length;
  const rejected = list.filter((o) => o.recommendation === 'REJECT').length;

  return (
    <>
      <Topbar
        title="Investment Intelligence"
        subtitle={
          activeClient
            ? `Filtered to ${activeClient.name}`
            : 'Pipeline by workflow stage · AI alerts · risk heatmap'
        }
      />
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Filter bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="h-8 rounded border border-sg-border bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-sg-primary min-w-[220px]"
            >
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {clientId && (
              <button
                onClick={() => setClientId('')}
                className="text-xs text-sg-muted hover:text-sg-text underline-offset-2 hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>

          {error ? (
            <div className="sg-card p-3 text-xs text-destructive">{error}</div>
          ) : null}

          {/* Workflow funnel — light grey row */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-sg-muted mb-2">
              Workflow funnel
            </div>
            <div className="grid grid-cols-6 gap-3 p-3 rounded bg-sg-surface border border-sg-border">
              {(
                [
                  'context',
                  'initial-screening',
                  'understanding',
                  'cio-review',
                  'recommendation',
                  'monitoring',
                ] as const
              ).map((s, i) => (
                <Link key={s} href="/opportunities">
                  <div className="rounded p-3 bg-white/60 border border-transparent hover:border-sg-primary/40 hover:bg-white transition-colors cursor-pointer">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-sg-muted">
                      Step {i + 1}
                    </div>
                    <div className="mt-1 text-sm font-semibold tracking-tight">
                      {STAGE_LABEL[s]}
                    </div>
                    <div className="mt-2 text-2xl font-semibold tabular-nums">
                      {opps ? stageCount(s) : '—'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Decision status — orthogonal to the workflow funnel above */}
          <div className="grid grid-cols-4 gap-4">
            <MetricCard label="Under Assessment" value={opps ? underAssessment : '—'} />
            <MetricCard label="Approved" value={opps ? approved : '—'} />
            <MetricCard
              label="Approved with conditions"
              value={opps ? approvedWithConditions : '—'}
            />
            <MetricCard label="Rejected" value={opps ? rejected : '—'} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="sg-card p-5 col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold tracking-tight">Recent activity</div>
                  <div className="text-xs text-sg-muted">Latest pipeline updates</div>
                </div>
                <Link
                  href="/opportunities"
                  className="text-xs text-sg-primary hover:underline"
                >
                  View all →
                </Link>
              </div>
              {!opps ? (
                <div className="text-xs text-sg-muted">Loading…</div>
              ) : opps.length === 0 ? (
                <div className="text-xs text-sg-muted-light">
                  No opportunities yet. Create one from the Pipeline page.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-sg-muted uppercase tracking-wider">
                      <th className="text-left font-medium pb-2">Opportunity</th>
                      <th className="text-left font-medium pb-2">Stage</th>
                      <th className="text-right font-medium pb-2">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opps.slice(0, 8).map((o) => (
                      <tr key={o.id} className="border-t border-sg-border">
                        <td className="py-2.5">
                          <Link
                            href={`/opportunities/${o.id}/${o.workflowStage}`}
                            className="hover:text-sg-primary"
                          >
                            {o.name}
                          </Link>
                          {o.client?.name && (
                            <div className="text-[11px] text-sg-muted-light">
                              {o.client.name}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5">
                          <Pill>{STAGE_LABEL[o.workflowStage] ?? o.workflowStage}</Pill>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          {o.riskScore != null ? Number(o.riskScore).toFixed(1) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="sg-card p-5">
              <div className="text-sm font-semibold tracking-tight mb-1">Risk heatmap</div>
              <div className="text-xs text-sg-muted mb-4">
                Severity by category across pipeline
              </div>
              {heatmap.length === 0 ? (
                <div className="text-xs text-sg-muted-light">
                  Risks populate after running analysis on an opportunity.
                </div>
              ) : (
                <RiskHeatmap data={heatmap} />
              )}
            </div>
          </div>

          <div className="sg-card p-5">
            <div className="text-sm font-semibold tracking-tight mb-1">AI alerts</div>
            <div className="text-xs text-sg-muted mb-4">
              Generated by the orchestrator across opportunities
            </div>
            {(() => {
              const alerts = (opps ?? []).filter(
                (o) => (o.riskScore ?? 0) >= 7,
              );
              if (!opps) return <div className="text-xs text-sg-muted">Loading…</div>;
              if (alerts.length === 0)
                return (
                  <div className="text-xs text-sg-muted-light">
                    No high-risk alerts. Alerts appear when the AI flags items above 7.0 risk
                    score.
                  </div>
                );
              return (
                <ul className="space-y-2 text-sm">
                  {alerts.map((a) => (
                    <li key={a.id} className="flex items-start gap-3">
                      <Pill variant="severity-high">High</Pill>
                      <Link
                        href={`/opportunities/${a.id}/${a.workflowStage}`}
                        className="hover:text-sg-primary"
                      >
                        <strong>{a.name}</strong>
                        <span className="text-sg-muted">
                          {' '}
                          — risk score {Number(a.riskScore).toFixed(1)} ·{' '}
                          {STAGE_LABEL[a.workflowStage] ?? a.workflowStage}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        </div>
      </div>
    </>
  );
}
