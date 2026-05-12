'use client';
import { MetricCard } from '@/components/charts/MetricCard';
import { Pill } from '@/components/ui/pill';
import { useOpportunity } from '@/components/opportunity/OpportunityContext';
import { BriefingPanel } from '@/components/opportunity/BriefingPanel';
import { EditOpportunityDialog } from '@/components/opportunity/EditOpportunityDialog';

function fmtCurrency(v: number | null | undefined) {
  if (v == null) return '—';
  const n = Number(v);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export default function ContextPage() {
  const { opportunity, loading, error } = useOpportunity();
  if (loading) return <div className="p-6 text-sm text-sg-muted">Loading…</div>;
  if (error || !opportunity)
    return <div className="p-6 text-sm text-destructive">{error ?? 'Not found'}</div>;

  const o = opportunity;
  const equity = o.askingEquity != null ? `$${fmtCurrency(o.askingEquity)}` : '—';
  const totalCap = o.totalCapitalization != null ? `$${fmtCurrency(o.totalCapitalization)}` : '—';
  const targetIrr = o.targetIrr != null ? `${Number(o.targetIrr).toFixed(1)}%` : '—';
  const targetMoic = o.targetMoic != null ? `${Number(o.targetMoic).toFixed(2)}x` : '—';

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
          label="Hold period"
          value={o.holdPeriodYears ? `${o.holdPeriodYears} yrs` : '—'}
        />
      </div>

      <BriefingPanel />

      <div className="sg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold tracking-tight">Deal facts</div>
            <div className="text-xs text-sg-muted">
              Headline metadata — refine as more details surface
            </div>
          </div>
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
          <DealFact label="Client" value={o.client?.name ?? null} />
        </dl>
      </div>

      {o.client && (
        <div className="sg-card p-5">
          <div className="text-sm font-semibold tracking-tight mb-3">Client context</div>
          <div className="text-sm text-sg-text">
            This opportunity is being evaluated for{' '}
            <span className="font-medium">{o.client.name}</span>. Client mandate, briefing,
            and portfolio exposures flow into every AI run.
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill>Client linked</Pill>
          </div>
        </div>
      )}
    </div>
  );
}

function DealFact({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.16em] text-sg-muted">{label}</dt>
      <dd className="text-sg-text mt-0.5">
        {value ?? <span className="text-sg-muted-light">—</span>}
      </dd>
    </div>
  );
}
