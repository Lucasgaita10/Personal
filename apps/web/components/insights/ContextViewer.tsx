'use client';
import { useState, useEffect } from 'react';
import {
  FileText,
  BarChart3,
  Activity,
  Layers,
  ScrollText,
  Download,
  AlertTriangle,
  RefreshCcw,
  Target,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { ScenarioPanel } from '@/components/insights/ScenarioPanel';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { api } from '@/lib/api';

const TABS = [
  { key: 'verdict', label: 'AI Verdict', icon: Target },
  { key: 'reports', label: 'Reports', icon: ScrollText },
  { key: 'document', label: 'Document', icon: FileText },
  { key: 'metrics', label: 'Metrics', icon: BarChart3 },
  { key: 'scenarios', label: 'Scenarios', icon: Activity },
  { key: 'graph', label: 'Knowledge', icon: Layers },
];

export function ContextViewer({
  opportunityId,
  citation,
}: {
  opportunityId: string;
  citation?: { documentId: string; chunkId?: string; page?: number } | null;
}) {
  const [tab, setTab] = useState<string>('verdict');

  useEffect(() => {
    if (citation) setTab('document');
  }, [citation]);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="border-b border-sg-border flex overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'h-10 px-3 text-xs flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap',
                tab === t.key
                  ? 'border-sg-primary text-sg-primary font-medium'
                  : 'border-transparent text-sg-muted hover:text-sg-text',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-auto p-5">
        {tab === 'verdict' && <VerdictPane opportunityId={opportunityId} />}
        {tab === 'reports' && <ReportsHub opportunityId={opportunityId} />}
        {tab === 'document' && <DocumentPane citation={citation} />}
        {tab === 'metrics' && <MetricsPane opportunityId={opportunityId} />}
        {tab === 'scenarios' && <ScenarioPanel opportunityId={opportunityId} />}
        {tab === 'graph' && <KnowledgeGraphPane opportunityId={opportunityId} />}
      </div>
    </div>
  );
}

const VERDICT_META: Record<string, { label: string; icon: any; color: string }> = {
  PROCEED: { label: 'Proceed', icon: ThumbsUp, color: 'text-emerald-700' },
  PROCEED_WITH_CONDITIONS: {
    label: 'Proceed with conditions',
    icon: HelpCircle,
    color: 'text-amber-700',
  },
  REJECT: { label: 'Reject', icon: ThumbsDown, color: 'text-red-700' },
  NEED_MORE_INFO: { label: 'Need more info', icon: HelpCircle, color: 'text-sg-muted' },
};

function VerdictPane({ opportunityId }: { opportunityId: string }) {
  const [opp, setOpp] = useState<any | null>(null);
  useEffect(() => {
    api.opportunity(opportunityId).then(setOpp).catch(() => setOpp({}));
  }, [opportunityId]);

  if (!opp) return <div className="text-sm text-sg-muted">Loading…</div>;
  const verdict = opp.aiVerdict;
  if (!verdict) {
    return (
      <div className="text-sm text-sg-muted-light">
        No AI verdict yet. Run AI analysis on the <strong>Understanding</strong> tab to
        generate one.
      </div>
    );
  }
  const meta = VERDICT_META[verdict] ?? VERDICT_META.NEED_MORE_INFO;
  const Icon = meta.icon;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-5 w-5', meta.color)} />
        <span className="text-base font-semibold tracking-tight">{meta.label}</span>
        <Pill>v{opp.analysisVersion ?? 1}</Pill>
      </div>
      {opp.aiVerdictRationale && (
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {opp.aiVerdictRationale}
        </div>
      )}
      {Array.isArray(opp.aiTopReasonsFor) && opp.aiTopReasonsFor.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-700 mb-2">
            Reasons in favor
          </div>
          <ul className="space-y-1 text-sm">
            {opp.aiTopReasonsFor.map((r: string, i: number) => (
              <li key={i}>
                <span className="text-emerald-700">+ </span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
      {Array.isArray(opp.aiTopReasonsAgainst) && opp.aiTopReasonsAgainst.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-red-700 mb-2">
            Reasons against
          </div>
          <ul className="space-y-1 text-sm">
            {opp.aiTopReasonsAgainst.map((r: string, i: number) => (
              <li key={i}>
                <span className="text-red-700">− </span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
      {Array.isArray(opp.aiCriticalQuestions) && opp.aiCriticalQuestions.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-sg-primary mb-2">
            Critical questions for IC
          </div>
          <ol className="space-y-1 text-sm list-decimal list-inside">
            {opp.aiCriticalQuestions.map((q: string, i: number) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </div>
      )}
      {Array.isArray(opp.aiNextSteps) && opp.aiNextSteps.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-sg-primary mb-2">
            Next steps
          </div>
          <ul className="space-y-1 text-sm">
            {opp.aiNextSteps.map((s: string, i: number) => (
              <li key={i}>
                <ArrowRight className="h-3 w-3 inline mr-1 -mt-0.5" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
      {opp.aiMarketResearch && (
        <div className="border-t border-sg-border pt-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-sg-muted mb-2">
            Market research (verified via web)
          </div>
          <div className="text-sm leading-relaxed whitespace-pre-wrap text-sg-text">
            {opp.aiMarketResearch}
          </div>
        </div>
      )}
    </div>
  );
}

const REPORT_TYPES = [
  { type: 'IC_MEMO_LONG', label: 'IC Memo' },
  { type: 'EXECUTIVE_SUMMARY', label: 'Executive Summary' },
  { type: 'PRESENTATION_DECK', label: 'Presentation Deck' },
];

function ReportsHub({ opportunityId }: { opportunityId: string }) {
  const [reports, setReports] = useState<any[] | null>(null);
  const [opp, setOpp] = useState<any | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  async function load() {
    const [r, o] = await Promise.all([
      api.reports(opportunityId).catch(() => []),
      api.opportunity(opportunityId).catch(() => ({})),
    ]);
    setReports(r as any[]);
    setOpp(o);
  }

  useEffect(() => {
    load();
  }, [opportunityId]);

  async function regen(type: string) {
    setGenerating(type);
    try {
      await api.generateReport({ opportunityId, type });
      await load();
    } finally {
      setGenerating(null);
    }
  }

  if (reports === null) return <div className="text-sm text-sg-muted">Loading…</div>;

  const latest = (type: string) =>
    reports
      .filter((r) => r.type === type)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
  const currentVersion = opp?.analysisVersion ?? 1;

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold tracking-tight">Reports</div>
      <div className="text-xs text-sg-muted">
        AI-drafted memo, exec summary, and IC deck. Auto-incorporates the synthesis verdict.
      </div>
      {REPORT_TYPES.map((r) => {
        const rep = latest(r.type);
        const v = rep?.payload?.analysis_version;
        const stale = v != null && v < currentVersion;
        return (
          <div key={r.type} className="sg-card p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium flex items-center gap-2 min-w-0">
                <FileText className="h-3.5 w-3.5 text-sg-primary shrink-0" />
                <span className="truncate">{r.label}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {rep && (
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? ''}/v1/reports/${rep.id}/download`}
                    className="inline-flex items-center gap-1 text-xs text-sg-primary hover:underline"
                  >
                    <Download className="h-3 w-3" />
                  </a>
                )}
                <Button
                  variant={!rep || stale ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => regen(r.type)}
                  disabled={generating !== null}
                >
                  <RefreshCcw className="h-3 w-3" />
                  {generating === r.type
                    ? '…'
                    : rep
                      ? stale
                        ? 'Refresh'
                        : 'Re-gen'
                      : 'Generate'}
                </Button>
              </div>
            </div>
            {rep && (
              <div className="flex items-center gap-2 text-[11px] text-sg-muted">
                <span className="tabular-nums">
                  {new Date(rep.createdAt).toLocaleString()}
                </span>
                {v != null && <Pill>v{v}</Pill>}
                {stale && (
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <AlertTriangle className="h-3 w-3" /> stale
                  </span>
                )}
              </div>
            )}
            {rep?.payload?.executive_summary && r.type !== 'PRESENTATION_DECK' && (
              <div className="border-t border-sg-border pt-2 text-xs leading-relaxed whitespace-pre-wrap text-sg-text">
                {rep.payload.executive_summary}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DocumentPane({
  citation,
}: {
  citation?: { documentId: string; chunkId?: string; page?: number } | null;
}) {
  if (!citation) {
    return (
      <div className="text-sm text-sg-muted">
        Cite a document from a chat response to view it here.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="text-xs text-sg-muted">
        Document <span className="font-mono">{citation.documentId}</span> · page{' '}
        {citation.page ?? '—'}
      </div>
      <div className="sg-card-muted p-4 text-sm leading-relaxed">Cited passage preview.</div>
    </div>
  );
}

function MetricsPane({ opportunityId }: { opportunityId: string }) {
  const [opp, setOpp] = useState<any | null>(null);
  useEffect(() => {
    api.opportunity(opportunityId).then(setOpp).catch(() => setOpp({}));
  }, [opportunityId]);
  const metrics = opp?.metrics ?? [];
  return (
    <div className="space-y-2 text-sm">
      <div className="text-sm font-semibold tracking-tight">Extracted metrics</div>
      {metrics.length === 0 ? (
        <div className="text-xs text-sg-muted-light">
          No metrics yet. Run AI analysis on Understanding.
        </div>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {metrics.map((m: any) => (
              <tr key={m.id} className="border-t border-sg-border">
                <td className="py-1 capitalize">{String(m.name).replace(/_/g, ' ')}</td>
                <td className="py-1 text-right tabular-nums">
                  {Number(m.value).toLocaleString()}
                  {m.unit ?? ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function KnowledgeGraphPane({ opportunityId }: { opportunityId: string }) {
  return (
    <div className="text-sm text-sg-muted">
      Knowledge graph (entities & relationships) — coming.
    </div>
  );
}
