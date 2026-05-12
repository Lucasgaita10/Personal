'use client';
import { MetricCard } from '@/components/charts/MetricCard';
import { Pill } from '@/components/ui/pill';
import { useOpportunity } from '@/components/opportunity/OpportunityContext';
import { BriefingPanel } from '@/components/opportunity/BriefingPanel';
import { EditOpportunityDialog } from '@/components/opportunity/EditOpportunityDialog';

function fmtCurrency(v: number | null | undefined, currency = 'USD') {
  if (v == null) return '—';
  const n = Number(v);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export default function OpportunityOverviewPage() {
  const { opportunity, loading, error } = useOpportunity();

  if (loading) return <div className="p-6 text-sm text-sg-muted">Loading…</div>;
  if (error || !opportunity)
    return <div className="p-6 text-sm text-destructive">{error ?? 'Not found'}</div>;

  const o = opportunity;
  const equity = o.askingEquity != null ? `$${fmtCurrency(o.askingEquity)}` : '—';
  const totalCap = o.totalCapitalization != null ? `$${fmtCurrency(o.totalCapitalization)}` : '—';
  const targetIrr = o.targetIrr != null ? `${Number(o.targetIrr).toFixed(1)}%` : '—';
  const targetMoic = o.targetMoic != null ? `${Number(o.targetMoic).toFixed(2)}x` : '—';

  const swot = (o as any).swot as
    | { strengths?: string[]; weaknesses?: string[]; opportunities?: string[]; threats?: string[] }
    | null;

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Asking equity" value={equity} delta={`of ${totalCap} total cap`} />
        <MetricCard
          label="Target IRR"
          value={targetIrr}
          delta={o.holdPeriodYears ? `${o.holdPeriodYears}y hold` : '—'}
        />
        <MetricCard label="Target MOIC" value={targetMoic} delta="net of fees" />
        <MetricCard
          label="IC readiness"
          value={
            o.icReadinessScore != null ? `${Number(o.icReadinessScore).toFixed(1)} / 10` : '—'
          }
          delta={`${o.gaps?.length ?? 0} open gap${(o.gaps?.length ?? 0) === 1 ? '' : 's'}`}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="sg-card p-5 col-span-2 space-y-3">
          <div className="text-sm font-semibold tracking-tight">Investment thesis</div>
          {o.thesis ? (
            <div className="text-sm leading-relaxed text-sg-text whitespace-pre-wrap">
              {o.thesis}
            </div>
          ) : (
            <div className="text-sm text-sg-muted-light">
              No thesis yet. Upload documents and run AI analysis to generate one.
            </div>
          )}
          {o.executiveSummary ? (
            <>
              <div className="text-sm font-semibold tracking-tight pt-2">Executive summary</div>
              <div className="text-sm leading-relaxed text-sg-text whitespace-pre-wrap">
                {o.executiveSummary}
              </div>
            </>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            {o.propertyType ? <Pill>{o.propertyType}</Pill> : null}
            {o.subType ? <Pill>{o.subType}</Pill> : null}
            {o.geography ? <Pill>{o.geography}</Pill> : null}
            {o.client ? <Pill>{o.client.name}</Pill> : null}
          </div>
        </div>
        <div className="sg-card p-5">
          <div className="text-sm font-semibold tracking-tight mb-3">SWOT snapshot</div>
          {swot ? (
            <ul className="space-y-2 text-xs">
              {(swot.strengths ?? []).slice(0, 2).map((s, i) => (
                <li key={`s${i}`}>
                  <span className="text-emerald-700 font-semibold">S</span> {s}
                </li>
              ))}
              {(swot.weaknesses ?? []).slice(0, 2).map((s, i) => (
                <li key={`w${i}`}>
                  <span className="text-amber-700 font-semibold">W</span> {s}
                </li>
              ))}
              {(swot.opportunities ?? []).slice(0, 2).map((s, i) => (
                <li key={`o${i}`}>
                  <span className="text-sg-primary font-semibold">O</span> {s}
                </li>
              ))}
              {(swot.threats ?? []).slice(0, 2).map((s, i) => (
                <li key={`t${i}`}>
                  <span className="text-red-700 font-semibold">T</span> {s}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-sg-muted-light">
              No SWOT yet. Will populate after AI analysis.
            </div>
          )}
        </div>
      </div>

      <BriefingPanel />

      <div className="sg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold tracking-tight">Deal facts</div>
          <EditOpportunityDialog />
        </div>
        <dl className="grid grid-cols-3 gap-y-3 gap-x-6 text-sm">
          <DealFact label="Sponsor" value={o.sponsor} />
          <DealFact label="Property type" value={o.propertyType} />
          <DealFact label="Sub-type" value={o.subType} />
          <DealFact label="Geography" value={o.geography} />
          <DealFact label="City" value={o.city} />
          <DealFact label="Country" value={o.country} />
          <DealFact label="Size" value={o.size} />
          <DealFact label="Units" value={(o as any).units ?? null} />
          <DealFact label="Unit mix" value={(o as any).unitMix ?? null} />
          <DealFact label="Vintage" value={(o as any).vintageYear ?? null} />
          <DealFact label="Hold period" value={o.holdPeriodYears ? `${o.holdPeriodYears} yrs` : null} />
          <DealFact label="Client" value={o.client?.name ?? null} />
        </dl>
      </div>
    </div>
  );
}

function DealFact({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.16em] text-sg-muted">{label}</dt>
      <dd className="text-sg-text mt-0.5">{value ?? <span className="text-sg-muted-light">—</span>}</dd>
    </div>
  );
}
