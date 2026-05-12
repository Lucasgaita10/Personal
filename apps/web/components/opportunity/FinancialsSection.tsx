'use client';
import { useState } from 'react';
import { Brain, RefreshCw } from 'lucide-react';
import { Pill } from '@/components/ui/pill';
import { Button } from '@/components/ui/button';
import { useOpportunity } from '@/components/opportunity/OpportunityContext';
import { api } from '@/lib/api';

// Prisma Decimal columns arrive as strings over JSON, so `value` is widened.
type Metric = {
  id: string;
  name: string;
  value: number | string | null;
  unit?: string | null;
  period?: string | null;
  confidence?: number | string | null;
};

type Assumption = {
  id: string;
  name: string;
  value: number | string | null;
  unit?: string | null;
  description?: string | null;
  isWeak: boolean;
  rationale?: string | null;
};

type HeadlineMetric = { name: string; value: string; interpretation: string };
type Sensitivity = {
  variable: string;
  base_case?: string;
  breakpoint?: string;
  impact?: string;
};
type WeakCallout = {
  name: string;
  sponsor_value?: string;
  rationale: string;
  severity?: 'HIGH' | 'MEDIUM' | 'LOW' | string;
};

export type FinancialAnalysis = {
  verdict?: 'STRONG' | 'MARGINAL' | 'WEAK' | 'INSUFFICIENT_DATA' | string;
  verdict_rationale?: string;
  analysis?: string;
  headline_metrics?: HeadlineMetric[];
  sensitivity?: Sensitivity[];
  weak_assumption_callouts?: WeakCallout[];
};

function VerdictPill({ verdict }: { verdict?: string }) {
  if (!verdict) return null;
  const map: Record<string, { label: string; cls: string }> = {
    STRONG: {
      label: 'STRONG',
      cls: 'bg-emerald-600 text-white border-emerald-600',
    },
    MARGINAL: {
      label: 'MARGINAL',
      cls: 'bg-amber-400 text-amber-950 border-amber-400',
    },
    WEAK: {
      label: 'WEAK',
      cls: 'bg-red-600 text-white border-red-600',
    },
    INSUFFICIENT_DATA: {
      label: 'INSUFFICIENT DATA',
      cls: 'bg-sg-surface text-sg-muted border-sg-border',
    },
  };
  const v = map[verdict] ?? {
    label: verdict,
    cls: 'bg-sg-surface text-sg-muted border-sg-border',
  };
  return (
    <span
      className={
        'inline-flex items-center px-3 h-7 rounded-full text-xs font-medium border ' +
        v.cls
      }
    >
      {v.label}
    </span>
  );
}

function fmtValue(m: { value: number | string | null; unit?: string | null }) {
  if (m.value == null) return '—';
  // Prisma's Decimal serializes as a string over JSON — coerce.
  const n = typeof m.value === 'number' ? m.value : Number(m.value);
  if (!Number.isFinite(n)) return String(m.value);
  const u = (m.unit || '').toLowerCase();
  if (u === '%' || u === 'pct' || u === 'percent') {
    const v = Math.abs(n) < 1.5 ? n * 100 : n;
    return `${v.toFixed(2)}%`;
  }
  if (u === 'x' || u === 'multiple') return `${n.toFixed(2)}x`;
  if (u === 'bps') return `${n} bps`;
  if (u === '$' || u === 'usd' || u === 'gbp' || u === 'eur' || u === 'sar') {
    const sign =
      u === '$' || u === 'usd'
        ? '$'
        : u === 'gbp'
        ? '£'
        : u === 'eur'
        ? '€'
        : 'SAR ';
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${sign}${(n / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}${(n / 1_000).toFixed(1)}K`;
    return `${sign}${n.toLocaleString()}`;
  }
  return `${n.toLocaleString()}${m.unit ? ` ${m.unit}` : ''}`;
}

function severityClass(sev?: string) {
  switch ((sev || '').toUpperCase()) {
    case 'HIGH':
      return 'bg-red-700 border-red-700 text-white';
    case 'MEDIUM':
      return 'bg-amber-300 border-amber-300 text-amber-950';
    case 'LOW':
      return 'bg-emerald-200 border-emerald-200 text-emerald-900';
    default:
      return 'bg-sg-surface border-sg-border text-sg-muted';
  }
}

export function FinancialsSection({
  analysis,
  metrics,
  assumptions,
}: {
  analysis?: FinancialAnalysis | null;
  metrics: Metric[];
  assumptions: Assumption[];
}) {
  const { opportunity, refresh } = useOpportunity();
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);

  const hasAnalysis = Boolean(
    analysis &&
      (analysis.verdict ||
        analysis.analysis ||
        (analysis.headline_metrics?.length ?? 0) > 0 ||
        (analysis.sensitivity?.length ?? 0) > 0 ||
        (analysis.weak_assumption_callouts?.length ?? 0) > 0),
  );

  // Re-run is only meaningful when prior risks/gaps/thesis exist to feed in.
  const o = opportunity as any;
  const canRerun = Boolean(
    o?.id &&
      ((o.risks?.length ?? 0) > 0 ||
        (o.gaps?.length ?? 0) > 0 ||
        !!o.thesis),
  );

  async function rerunFinancialsOnly() {
    if (!o?.id) return;
    setRerunning(true);
    setRerunError(null);
    try {
      const result: any = await api.analyzeFinancialOnly(o.id);
      // Surface any partial failures returned by the agent layer (e.g.
      // financial_analyst or synthesis raised) — otherwise the UI would
      // silently look like nothing happened.
      const errs = result?.agent_errors as Record<string, string> | undefined;
      if (errs && Object.keys(errs).length > 0) {
        setRerunError(
          'Re-run completed with errors: ' +
            Object.entries(errs)
              .map(([k, v]) => `${k}: ${String(v).slice(0, 120)}`)
              .join(' · '),
        );
      }
      await refresh();
    } catch (err: any) {
      setRerunError(err?.message ?? 'Re-run failed');
    } finally {
      setRerunning(false);
    }
  }

  const paragraphs = (analysis?.analysis || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const weakAssumptions = assumptions.filter((a) => a.isWeak);
  const otherAssumptions = assumptions.filter((a) => !a.isWeak);

  if (!hasAnalysis && metrics.length === 0 && assumptions.length === 0) {
    return (
      <div className="text-xs text-sg-muted-light italic py-2">
        No financial analysis yet. Run the AI analysis to populate.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Re-run financials action header */}
      {canRerun && (
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="text-xs text-sg-muted">
            {rerunning
              ? 'Re-running financial analysis + verdict… ~30s'
              : 'Iterating on prompts or want a refreshed read? Skip the parallel agents.'}
            {rerunError && (
              <span className="ml-2 text-destructive">{rerunError}</span>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={rerunFinancialsOnly}
            disabled={rerunning}
          >
            {rerunning ? (
              <>
                <Brain className="h-3.5 w-3.5 animate-pulse" />
                Running…
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Re-run financials
              </>
            )}
          </Button>
        </div>
      )}

      {/* Verdict + rationale */}
      {hasAnalysis && (analysis?.verdict || analysis?.verdict_rationale) && (
        <div className="sg-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[11px] uppercase tracking-wider text-sg-muted">
              Financial Verdict
            </span>
            <VerdictPill verdict={analysis?.verdict} />
          </div>
          {analysis?.verdict_rationale && (
            <p className="text-sm text-sg-text leading-relaxed">
              {analysis.verdict_rationale}
            </p>
          )}
        </div>
      )}

      {/* Headline metrics with interpretation */}
      {analysis?.headline_metrics && analysis.headline_metrics.length > 0 && (
        <div className="sg-card p-5">
          <div className="text-[11px] uppercase tracking-wider text-sg-muted mb-3">
            Headline metrics
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analysis.headline_metrics.map((m, i) => (
              <div
                key={`${m.name}-${i}`}
                className="border border-sg-border rounded-md p-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-sg-text">
                    {m.name}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {m.value}
                  </span>
                </div>
                {m.interpretation && (
                  <div className="text-xs text-sg-muted mt-1.5 leading-snug">
                    {m.interpretation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Narrative analysis */}
      {paragraphs.length > 0 && (
        <div className="sg-card p-5">
          <div className="text-[11px] uppercase tracking-wider text-sg-muted mb-3">
            Analysis
          </div>
          <div className="space-y-3 text-sm text-sg-text leading-relaxed">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      )}

      {/* Sensitivity */}
      {analysis?.sensitivity && analysis.sensitivity.length > 0 && (
        <div className="sg-card p-5">
          <div className="text-[11px] uppercase tracking-wider text-sg-muted mb-3">
            Sensitivity — what breaks the deal
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analysis.sensitivity.map((s, i) => (
              <div
                key={`${s.variable}-${i}`}
                className="border border-sg-border rounded-md overflow-hidden flex flex-col"
              >
                {/* Header: variable name + base case chip */}
                <div className="flex items-start justify-between gap-3 px-3 py-2.5 bg-sg-surface border-b border-sg-border">
                  <span className="text-sm font-semibold text-sg-text leading-snug">
                    {s.variable}
                  </span>
                  {s.base_case && (
                    <span className="shrink-0 inline-flex items-center px-2 h-5 rounded-full text-[10px] font-medium border border-sg-border bg-white text-sg-muted">
                      Base: <span className="ml-1 tabular-nums text-sg-text">{s.base_case}</span>
                    </span>
                  )}
                </div>

                {/* Breakpoint scenario */}
                {s.breakpoint && (
                  <div className="px-3 py-2.5 text-xs leading-relaxed text-sg-text border-l-2 border-red-600 bg-red-50/30">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-red-700 mb-1">
                      Breakpoint
                    </div>
                    {s.breakpoint}
                  </div>
                )}

                {/* Impact */}
                {s.impact && (
                  <div className="px-3 py-2 text-xs text-sg-muted border-t border-sg-border mt-auto">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-sg-muted">
                      Impact
                    </span>{' '}
                    <span className="text-sg-text">{s.impact}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weak assumption callouts (from the analyst, prose-rationale) */}
      {analysis?.weak_assumption_callouts &&
        analysis.weak_assumption_callouts.length > 0 && (
          <div className="sg-card p-5">
            <div className="text-[11px] uppercase tracking-wider text-sg-muted mb-3">
              Weak-assumption callouts
            </div>
            <div className="space-y-3">
              {analysis.weak_assumption_callouts.map((c, i) => (
                <div
                  key={`${c.name}-${i}`}
                  className="border border-sg-border rounded-md p-3"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-medium text-sm">{c.name}</span>
                    {c.sponsor_value && (
                      <span className="text-xs tabular-nums text-sg-muted">
                        sponsor: {c.sponsor_value}
                      </span>
                    )}
                    <span
                      className={
                        'ml-auto inline-flex items-center px-2 h-5 rounded-full text-[10px] font-medium border ' +
                        severityClass(c.severity)
                      }
                    >
                      {(c.severity || 'MEDIUM').toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-sg-muted leading-snug">
                    {c.rationale}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Full metric extraction — evidence layer */}
      {metrics.length > 0 && (
        <details className="sg-card p-5">
          <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-sg-muted">
            All extracted metrics ({metrics.length})
          </summary>
          <table className="w-full text-sm mt-3">
            <thead className="text-xs text-sg-muted uppercase tracking-wider">
              <tr>
                <th className="text-left font-medium py-2">Metric</th>
                <th className="text-left font-medium py-2">Period</th>
                <th className="text-right font-medium py-2">Value</th>
                <th className="text-right font-medium py-2">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.id} className="border-t border-sg-border">
                  <td className="py-2.5 capitalize">
                    {String(m.name).replace(/_/g, ' ')}
                  </td>
                  <td className="py-2.5 text-sg-muted">{m.period ?? '—'}</td>
                  <td className="py-2.5 text-right tabular-nums">
                    {fmtValue(m)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-sg-muted">
                    {m.confidence != null ? Number(m.confidence).toFixed(2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {/* Full assumption list — evidence layer */}
      {assumptions.length > 0 && (
        <details className="sg-card p-5">
          <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-sg-muted">
            All assumptions ({assumptions.length}
            {weakAssumptions.length > 0
              ? ` · ${weakAssumptions.length} flagged weak`
              : ''}
            )
          </summary>
          <div className="mt-3 space-y-2">
            {[...weakAssumptions, ...otherAssumptions].map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-2 text-sm border-t border-sg-border pt-2 first:border-t-0 first:pt-0"
              >
                {a.isWeak && (
                  <Pill variant="severity-high" className="shrink-0">
                    WEAK
                  </Pill>
                )}
                <div className="flex-1">
                  <div className="font-medium capitalize">
                    {String(a.name).replace(/_/g, ' ')}{' '}
                    <span className="text-sg-muted font-normal">
                      = {fmtValue(a)}
                    </span>
                  </div>
                  {a.description && (
                    <div className="text-xs text-sg-muted">{a.description}</div>
                  )}
                  {a.rationale && (
                    <div className="text-xs text-sg-muted italic mt-0.5">
                      {a.rationale}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
