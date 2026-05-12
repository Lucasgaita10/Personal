'use client';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Pill } from '@/components/ui/pill';
import { useOpportunity } from '@/components/opportunity/OpportunityContext';
import { AnalyzeButton } from '@/components/opportunity/AnalyzeButton';
import { MetricCard } from '@/components/charts/MetricCard';
import { RisksSection } from '@/components/opportunity/RisksSection';
import { FinancialsSection } from '@/components/opportunity/FinancialsSection';
import { MarketResearchSection } from '@/components/opportunity/MarketResearchSection';
import { ReportsSection } from '@/components/opportunity/ReportsSection';
import { AIRecommendationCard } from '@/components/opportunity/AIRecommendationCard';
import { QuadrantPanel } from '@/components/ui/quadrant-panel';
import { CollapsibleSection } from '@/components/opportunity/CollapsibleSection';

/** Bull/Base/Bear cases may come back as an array OR as a { points: [...] } object
 *  depending on the AI output. Normalize to a plain string array. */
function normalizeCase(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (value && typeof value === 'object' && Array.isArray((value as any).points)) {
    return (value as any).points.filter((v: any): v is string => typeof v === 'string');
  }
  return [];
}

const PRIO_VARIANT: Record<string, any> = {
  BLOCKER: 'severity-critical',
  HIGH: 'severity-high',
  MEDIUM: 'severity-medium',
  LOW: 'severity-low',
};

export default function UnderstandingPage() {
  const { opportunity, loading } = useOpportunity();
  if (loading) return <div className="p-6 text-sm text-sg-muted">Loading…</div>;
  if (!opportunity)
    return <div className="p-6 text-sm text-destructive">Not found</div>;

  const o = opportunity as any;
  const risks = (o.risks ?? []) as any[];
  const gaps = (o.gaps ?? []) as any[];
  const metrics = (o.metrics ?? []) as any[];
  const swot = o.swot as any | null;

  const hasAnything =
    !!o.thesis ||
    !!o.executiveSummary ||
    risks.length > 0 ||
    gaps.length > 0 ||
    metrics.length > 0;

  // Build the heatmap data
  const heatmapMap = new Map<string, number>();
  for (const r of risks) {
    const k = `${r.category}:${r.severity}`;
    heatmapMap.set(k, (heatmapMap.get(k) ?? 0) + 1);
  }
  const heatmapRows = Array.from(heatmapMap.entries()).map(([k, count]) => {
    const [category, severity] = k.split(':');
    return { category, severity, _count: { _all: count } };
  });

  return (
    <div className="p-6 space-y-8">
      {/* Run / Re-run CTA */}
      <AnalyzeButton />

      {!hasAnything && (
        <div className="sg-card-muted p-8 text-center text-sm text-sg-muted-light">
          No analysis yet. Upload documents in <strong>Initial Screening</strong>, then run the
          AI analysis above to generate the thesis, financials, risks, and gaps.
        </div>
      )}

      {/* ── Scores ── above the verdict: numerical snapshot first ─ */}
      {(o.opportunityScore != null ||
        o.riskScore != null ||
        o.confidenceScore != null ||
        o.icReadinessScore != null) && (
        <CollapsibleSection
          title="Scores"
          subtitle="Computed from the deep read"
          badge={
            <>
              <Pill>
                Opp {o.opportunityScore != null ? Number(o.opportunityScore).toFixed(1) : '—'}
              </Pill>
              <Pill>Risk {o.riskScore != null ? Number(o.riskScore).toFixed(1) : '—'}</Pill>
              <Pill>
                Conf {o.confidenceScore != null ? Number(o.confidenceScore).toFixed(1) : '—'}
              </Pill>
              <Pill>
                IC {o.icReadinessScore != null ? Number(o.icReadinessScore).toFixed(1) : '—'}
              </Pill>
            </>
          }
        >
          <div className="grid grid-cols-4 gap-4">
            <MetricCard
              label="Opportunity"
              value={
                o.opportunityScore != null
                  ? `${Number(o.opportunityScore).toFixed(1)} / 10`
                  : '—'
              }
              delta="risk-adjusted attractiveness"
              info={
                <>
                  <div className="font-semibold mb-1">Opportunity score</div>
                  How attractive this deal is on a <strong>risk-adjusted</strong> basis.
                  Considers thesis strength, market context, financial structure, and how the
                  deal fits the client mandate.
                  <ul className="mt-2 space-y-0.5 text-sg-muted">
                    <li>
                      <strong>10</strong> — exceptional; rare conviction trade
                    </li>
                    <li>
                      <strong>7–9</strong> — strong, IC-worthy
                    </li>
                    <li>
                      <strong>5–6</strong> — neutral; needs more diligence to push higher
                    </li>
                    <li>
                      <strong>0–4</strong> — risk-adjusted return doesn't justify the bet
                    </li>
                  </ul>
                  <div className="mt-2 text-sg-muted-light">
                    Set by the Thesis agent during analysis.
                  </div>
                </>
              }
            />
            <MetricCard
              label="Risk"
              value={o.riskScore != null ? `${Number(o.riskScore).toFixed(1)} / 10` : '—'}
              delta={`${risks.length} risks identified`}
              info={
                <>
                  <div className="font-semibold mb-1">Risk score</div>
                  The <strong>severity</strong> of risks identified by the Risk Analyst,
                  weighted by category and likelihood.
                  <ul className="mt-2 space-y-0.5 text-sg-muted">
                    <li>
                      <strong>10</strong> — multiple CRITICAL risks; existential
                    </li>
                    <li>
                      <strong>7–9</strong> — high; meaningful equity loss in adverse scenario
                    </li>
                    <li>
                      <strong>4–6</strong> — moderate; standard mitigation required
                    </li>
                    <li>
                      <strong>0–3</strong> — well de-risked
                    </li>
                  </ul>
                  <div className="mt-2 text-sg-muted-light">
                    Higher is worse. Reasons appear in the AI Recommendation card below.
                  </div>
                </>
              }
            />
            <MetricCard
              label="Confidence"
              value={
                o.confidenceScore != null
                  ? `${Number(o.confidenceScore).toFixed(1)} / 10`
                  : '—'
              }
              delta="diligence completeness"
              info={
                <>
                  <div className="font-semibold mb-1">Confidence score</div>
                  How <strong>complete</strong> the diligence basis is. Reflects the AI's
                  trust in the conclusion given the source documents available.
                  <ul className="mt-2 space-y-0.5 text-sg-muted">
                    <li>
                      <strong>9–10</strong> — comprehensive; full data room, audited
                      financials, market study
                    </li>
                    <li>
                      <strong>5–8</strong> — patchy; some artifacts missing or unverified
                    </li>
                    <li>
                      <strong>0–4</strong> — insufficient basis; treat all outputs as
                      indicative only
                    </li>
                  </ul>
                </>
              }
            />
            <MetricCard
              label="IC readiness"
              value={
                o.icReadinessScore != null
                  ? `${Number(o.icReadinessScore).toFixed(1)} / 10`
                  : '—'
              }
              delta={`${gaps.length} open gaps`}
              info={
                <>
                  <div className="font-semibold mb-1">IC readiness score</div>
                  Whether the diligence package is ready for{' '}
                  <strong>Investment Committee</strong> review. Computed from the gaps
                  identified by the Gap agent.
                  <ul className="mt-2 space-y-0.5 text-sg-muted">
                    <li>
                      <strong>9–10</strong> — all critical artifacts in; assumptions
                      independently validated
                    </li>
                    <li>
                      <strong>7–8</strong> — minor gaps; can IC with conditions
                    </li>
                    <li>
                      <strong>5–6</strong> — material gaps; close before IC
                    </li>
                    <li>
                      <strong>0–4</strong> — not IC-ready; insufficient basis
                    </li>
                  </ul>
                  <div className="mt-2 text-sg-muted-light">
                    Any <strong>BLOCKER</strong> gap caps the score at 4.
                  </div>
                </>
              }
            />
          </div>
        </CollapsibleSection>
      )}

      {/* AI Recommendation — the synthesis verdict with full rationale */}
      {(o.aiVerdict || o.aiVerdictRationale) && (
        <CollapsibleSection
          title="AI Recommendation"
          subtitle="The AI's holistic verdict"
          badge={
            <Pill
              variant={
                o.aiVerdict === 'PROCEED'
                  ? ('severity-low' as any)
                  : o.aiVerdict === 'REJECT'
                    ? ('severity-high' as any)
                    : ('severity-medium' as any)
              }
            >
              {(o.aiVerdict ?? '—').replace(/_/g, ' ')}
            </Pill>
          }
        >
          <AIRecommendationCard />
        </CollapsibleSection>
      )}

      {/* ── Thesis ─────────────────────────────────────────────── */}
      {(o.thesis || o.executiveSummary || swot) && (
        <CollapsibleSection
          id="thesis"
          title="Thesis"
          subtitle="Investment narrative · SWOT · scenarios"
          badge={
            <Pill>
              {swot
                ? `${(swot.strengths?.length ?? 0) + (swot.weaknesses?.length ?? 0) + (swot.opportunities?.length ?? 0) + (swot.threats?.length ?? 0)} SWOT items`
                : 'Thesis drafted'}
            </Pill>
          }
        >
          <div className="space-y-3">
          <div className="sg-card p-5 space-y-4">
            {o.executiveSummary && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-sg-muted mb-1">
                  Executive summary
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {o.executiveSummary}
                </div>
              </div>
            )}
            {o.thesis && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-sg-muted mb-1">
                  Thesis
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {o.thesis}
                </div>
              </div>
            )}
          </div>

          {/* SWOT — its own 4-quadrant row */}
          <div className="pt-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-sg-muted mb-2">
              SWOT
            </div>
            {swot ? (
              <div className="grid grid-cols-4 gap-3">
                <QuadrantPanel
                  variant="positive"
                  title="Strengths"
                  items={swot.strengths ?? []}
                />
                <QuadrantPanel
                  variant="caution"
                  title="Weaknesses"
                  items={swot.weaknesses ?? []}
                  bulletGlyph="−"
                />
                <QuadrantPanel
                  variant="forward"
                  title="Opportunities"
                  items={swot.opportunities ?? []}
                />
                <QuadrantPanel
                  variant="negative"
                  title="Threats"
                  items={swot.threats ?? []}
                  bulletGlyph="⚠"
                />
              </div>
            ) : (
              <div className="sg-card-muted p-5 text-xs text-sg-muted-light">
                Will populate after AI analysis.
              </div>
            )}
          </div>

          {(o.bullCase || o.baseCase || o.bearCase) && (
            <div className="pt-2 space-y-2">
              <div className="text-[10px] uppercase tracking-[0.16em] text-sg-muted">
                Scenarios
              </div>
              <ScenarioSet
                bear={normalizeCase(o.bearCase)}
                base={normalizeCase(o.baseCase)}
                bull={normalizeCase(o.bullCase)}
              />
            </div>
          )}
          </div>
        </CollapsibleSection>
      )}

      {/* ── Market Research ──────────────────────────────────────── */}
      {o.aiMarketResearch && (
        <CollapsibleSection
          id="market-research"
          title="Market Research"
          subtitle="Independent web-sourced check on the sponsor's market thesis"
          badge={(() => {
            const text = String(o.aiMarketResearch);
            const m = text.match(/\b(TAILWIND|NEUTRAL|HEADWIND)\b/);
            if (!m) return null;
            const v = m[1];
            const variant =
              v === 'TAILWIND'
                ? 'severity-low'
                : v === 'HEADWIND'
                ? 'severity-high'
                : 'default';
            return <Pill variant={variant as any}>{v}</Pill>;
          })()}
        >
          <MarketResearchSection research={String(o.aiMarketResearch)} />
        </CollapsibleSection>
      )}

      {/* ── Financials ─────────────────────────────────────────── */}
      <CollapsibleSection
        id="financials"
        title="Financials"
        subtitle="Underwriting analysis"
        badge={(() => {
          const v = (o.financialAnalysis as any)?.verdict;
          const variant =
            v === 'STRONG'
              ? 'severity-low'
              : v === 'MARGINAL'
              ? 'severity-medium'
              : v === 'WEAK'
              ? 'severity-high'
              : 'default';
          return (
            <>
              <Pill>
                {metrics.length} metric{metrics.length === 1 ? '' : 's'}
              </Pill>
              {v && <Pill variant={variant as any}>{v}</Pill>}
            </>
          );
        })()}
      >
        <FinancialsSection
          analysis={o.financialAnalysis ?? null}
          metrics={metrics as any}
          assumptions={(o.assumptions ?? []) as any}
        />
      </CollapsibleSection>

      {/* ── Risks ──────────────────────────────────────────────── */}
      <CollapsibleSection
        id="risks"
        title="Risks"
        subtitle="Identified by category + severity"
        badge={(() => {
          const critical = risks.filter((r: any) => r.severity === 'CRITICAL').length;
          const high = risks.filter((r: any) => r.severity === 'HIGH').length;
          return (
            <>
              <Pill>{risks.length} risk{risks.length === 1 ? '' : 's'}</Pill>
              {critical > 0 && (
                <Pill variant="severity-critical">{critical} critical</Pill>
              )}
              {high > 0 && <Pill variant="severity-high">{high} high</Pill>}
            </>
          );
        })()}
      >
        {risks.length === 0 ? (
          <div className="text-xs text-sg-muted-light italic py-2">
            No risks identified yet.
          </div>
        ) : (
          <RisksSection risks={risks as any} heatmapRows={heatmapRows as any} />
        )}
      </CollapsibleSection>

      {/* ── Gaps ───────────────────────────────────────────────── */}
      <CollapsibleSection
        id="gaps"
        title="Gaps"
        subtitle="Missing diligence items"
        badge={(() => {
          const blockers = gaps.filter((g: any) => g.priority === 'BLOCKER').length;
          return (
            <>
              <Pill>{gaps.length} gap{gaps.length === 1 ? '' : 's'}</Pill>
              {blockers > 0 && (
                <Pill variant="severity-critical">{blockers} blocker</Pill>
              )}
            </>
          );
        })()}
      >
        {gaps.length === 0 ? (
          <div className="text-xs text-sg-muted-light italic py-2">
            No gaps identified yet.
          </div>
        ) : (
          <div className="sg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-sg-surface text-xs text-sg-muted uppercase tracking-wider">
                <tr>
                  <th className="text-left font-medium py-2 px-4">Priority</th>
                  <th className="text-left font-medium py-2 px-4">Category</th>
                  <th className="text-left font-medium py-2 px-4">Gap</th>
                  <th className="text-left font-medium py-2 px-4">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {gaps.map((g) => (
                  <tr key={g.id} className="border-t border-sg-border align-top">
                    <td className="py-3 px-4">
                      <Pill variant={PRIO_VARIANT[g.priority]}>{g.priority}</Pill>
                    </td>
                    <td className="py-3 px-4 text-sg-muted">{g.category}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium">{g.title}</div>
                      <div className="text-sg-muted">{g.description}</div>
                      {g.rationale ? (
                        <div className="text-xs text-sg-muted-light mt-1">
                          <span className="uppercase tracking-wider text-[10px]">Why:</span>{' '}
                          {g.rationale}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 px-4">{g.recommendation ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>

      {/* ── Reports (memo / exec summary / deck) ─────────────────── */}
      <CollapsibleSection
        title="Reports"
        subtitle="IC memo · Executive summary · Presentation deck"
        badge={<Pill>3 templates</Pill>}
      >
        <ReportsSection />
      </CollapsibleSection>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-sg-border pb-2">
      <div className="text-base font-semibold tracking-tight">{title}</div>
      {subtitle && <div className="text-xs text-sg-muted">{subtitle}</div>}
    </div>
  );
}

/** Bull/Base/Bear unified scenario set. One panel, three columns separated by
 *  vertical dividers. Bear left → Base center (emphasized) → Bull right.
 *  No colored backgrounds — colors live only in the column header band. */
function ScenarioSet({
  bear,
  base,
  bull,
}: {
  bear: string[];
  base: string[];
  bull: string[];
}) {
  return (
    <div className="sg-card overflow-hidden">
      <div className="grid grid-cols-3 divide-x divide-sg-border">
        <ScenarioColumn
          tone="bear"
          icon={TrendingDown}
          title="Bear case"
          subtitle="Downside path"
          items={bear}
        />
        <ScenarioColumn
          tone="base"
          icon={Minus}
          title="Base case"
          subtitle="Central scenario"
          items={base}
        />
        <ScenarioColumn
          tone="bull"
          icon={TrendingUp}
          title="Bull case"
          subtitle="Upside path"
          items={bull}
        />
      </div>
    </div>
  );
}

function ScenarioColumn({
  tone,
  icon: Icon,
  title,
  subtitle,
  items,
}: {
  tone: 'bear' | 'base' | 'bull';
  icon: any;
  title: string;
  subtitle: string;
  items: string[];
}) {
  const headerBg =
    tone === 'bear' ? 'bg-red-50' : tone === 'bull' ? 'bg-emerald-50' : 'bg-sg-surface';
  const iconColor =
    tone === 'bear'
      ? 'text-red-700'
      : tone === 'bull'
        ? 'text-emerald-700'
        : 'text-sg-muted';
  return (
    <div className="flex flex-col">
      <div className={`px-4 py-3 border-b border-sg-border ${headerBg}`}>
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <div className="text-sm font-semibold tracking-tight">{title}</div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-sg-muted mt-0.5 ml-6">
          {subtitle}
        </div>
      </div>
      <div className="p-4 flex-1">
        {items.length === 0 ? (
          <div className="text-xs text-sg-muted-light italic">Not generated.</div>
        ) : (
          <ul className="space-y-2 text-sm leading-relaxed">
            {items.map((it, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="text-sg-muted-light flex-shrink-0 mt-0.5">•</span>
                <span className="text-sg-text">{it}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

