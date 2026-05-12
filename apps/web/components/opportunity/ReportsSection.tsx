'use client';
import { useEffect, useState } from 'react';
import {
  FileText,
  FileBarChart,
  Presentation,
  Download,
  RefreshCcw,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { useOpportunity } from '@/components/opportunity/OpportunityContext';
import { api } from '@/lib/api';

const REPORT_TYPES = [
  {
    type: 'IC_MEMO_LONG',
    title: 'IC Memo (long)',
    description: 'Institutional 12–18 page memorandum with full diligence.',
    icon: FileText,
  },
  {
    type: 'EXECUTIVE_SUMMARY',
    title: 'Executive Summary',
    description: '2–3 page principal-ready brief with decision and key risks.',
    icon: FileBarChart,
  },
  {
    type: 'PRESENTATION_DECK',
    title: 'Presentation Deck',
    description: 'Visual IC deck in Stone Gate template.',
    icon: Presentation,
  },
] as const;

const TYPE_LABEL: Record<string, string> = {
  IC_MEMO_LONG: 'IC Memo',
  EXECUTIVE_SUMMARY: 'Executive Summary',
  PRESENTATION_DECK: 'Deck',
};

export function ReportsSection() {
  const { opportunity, refresh } = useOpportunity();
  const [reports, setReports] = useState<any[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const opp = opportunity as any;
  const currentVersion = opp?.analysisVersion ?? 1;
  const hasAnalysis =
    !!opp?.thesis ||
    (opp?.risks?.length ?? 0) > 0 ||
    (opp?.gaps?.length ?? 0) > 0;

  async function loadReports() {
    if (!opp) return;
    try {
      const r = (await api.reports(opp.id)) as any[];
      setReports(r);
    } catch {
      // ignore
    }
  }
  useEffect(() => {
    loadReports();
  }, [opp?.id]);

  async function generate(type: string) {
    if (!opp) return;
    setGenerating(type);
    setError(null);
    try {
      await api.generateReport({ opportunityId: opp.id, type });
      await loadReports();
      await refresh();
    } catch (err: any) {
      setError(err.message ?? 'Generation failed');
    } finally {
      setGenerating(null);
    }
  }

  // Latest report per type
  const latestByType = new Map<string, any>();
  for (const r of reports) {
    const existing = latestByType.get(r.type);
    if (!existing || new Date(r.createdAt) > new Date(existing.createdAt)) {
      latestByType.set(r.type, r);
    }
  }

  return (
    <section id="reports" className="space-y-3">
      <div className="border-b border-sg-border pb-2">
        <div className="text-base font-semibold tracking-tight">Reports</div>
        <div className="text-xs text-sg-muted">
          AI-drafted memo, executive summary, and IC deck — generated from the analysis above.
          The CIO uses these as input for review.
        </div>
      </div>

      {!hasAnalysis ? (
        <div className="sg-card-muted p-5 text-sm text-sg-muted-light">
          Run the AI analysis above first — reports synthesize what the AI extracted.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {REPORT_TYPES.map((r) => {
            const Icon = r.icon;
            const latest = latestByType.get(r.type);
            const reportVersion = latest?.payload?.analysis_version ?? null;
            const isStale =
              latest && reportVersion != null && reportVersion < currentVersion;
            return (
              <div key={r.type} className="sg-card p-5 flex flex-col">
                <Icon className="h-5 w-5 text-sg-primary" />
                <div className="mt-2 text-sm font-semibold tracking-tight">{r.title}</div>
                <div className="mt-1 text-xs text-sg-muted flex-1">{r.description}</div>

                {latest && (
                  <div className="mt-3 text-xs text-sg-muted flex items-center gap-2 flex-wrap">
                    <Pill>v{latest.version ?? 1}</Pill>
                    {reportVersion != null && (
                      <span className="tabular-nums">
                        from analysis v{reportVersion}
                      </span>
                    )}
                    {isStale && (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <AlertTriangle className="h-3 w-3" /> stale
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => generate(r.type)}
                    disabled={generating !== null}
                    variant={isStale || !latest ? 'default' : 'outline'}
                  >
                    {generating === r.type ? (
                      'Generating…'
                    ) : isStale ? (
                      <>
                        <RefreshCcw className="h-3.5 w-3.5" /> Regenerate
                      </>
                    ) : latest ? (
                      <>
                        <RefreshCcw className="h-3.5 w-3.5" /> Refresh
                      </>
                    ) : (
                      'Generate'
                    )}
                  </Button>
                  {latest && (
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? ''}/v1/reports/${latest.id}/download`}
                      className="inline-flex items-center gap-1 text-xs text-sg-primary hover:underline"
                    >
                      <Download className="h-3 w-3" /> Download
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <div className="text-xs text-destructive">{error}</div>}

      {reports.length > 0 && (
        <div className="sg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-sg-border text-sm font-semibold tracking-tight">
            All versions
          </div>
          <table className="w-full text-sm">
            <thead className="bg-sg-surface text-xs text-sg-muted uppercase tracking-wider">
              <tr>
                <th className="text-left font-medium py-2 px-4">Type</th>
                <th className="text-left font-medium py-2 px-4">Generated</th>
                <th className="text-left font-medium py-2 px-4">Analysis</th>
                <th className="text-right font-medium py-2 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r: any) => {
                const v = r.payload?.analysis_version;
                const stale = v != null && v < currentVersion;
                return (
                  <tr key={r.id} className="border-t border-sg-border">
                    <td className="py-2.5 px-4">{TYPE_LABEL[r.type] ?? r.type}</td>
                    <td className="py-2.5 px-4 text-sg-muted">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4">
                      {v != null ? (
                        <Pill variant={stale ? ('severity-medium' as any) : 'default'}>
                          v{v} {stale ? '(stale)' : ''}
                        </Pill>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? ''}/v1/reports/${r.id}/download`}
                        className="inline-flex items-center gap-1 text-xs text-sg-primary hover:underline"
                      >
                        <Download className="h-3 w-3" /> Download
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
