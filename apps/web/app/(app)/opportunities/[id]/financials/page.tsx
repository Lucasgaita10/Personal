'use client';
import { MetricCard } from '@/components/charts/MetricCard';
import { useOpportunity } from '@/components/opportunity/OpportunityContext';

function fmtMetric(name: string, m: any) {
  const unit = m.unit ?? '';
  const v = Number(m.value);
  if (unit === '%') return `${v.toFixed(1)}%`;
  if (unit === 'x') return `${v.toFixed(2)}x`;
  if (unit === '$') {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v.toLocaleString()}`;
  }
  return `${v}${unit ? ' ' + unit : ''}`;
}

const HIGHLIGHT_METRICS = ['cap_rate', 'irr', 'moic', 'dscr', 'occupancy', 'ltv', 'noi'];

export default function FinancialsPage() {
  const { opportunity, loading } = useOpportunity();
  if (loading) return <div className="p-6 text-sm text-sg-muted">Loading…</div>;

  const metrics = (opportunity?.metrics ?? []) as any[];
  const byName: Record<string, any> = {};
  for (const m of metrics) byName[m.name] = m;

  const targetIrr = opportunity?.targetIrr;
  const targetMoic = opportunity?.targetMoic;

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Going-in cap"
          value={byName.cap_rate ? fmtMetric('cap_rate', byName.cap_rate) : '—'}
        />
        <MetricCard
          label="Target IRR"
          value={targetIrr != null ? `${Number(targetIrr).toFixed(1)}%` : '—'}
        />
        <MetricCard
          label="Target MOIC"
          value={targetMoic != null ? `${Number(targetMoic).toFixed(2)}x` : '—'}
        />
        <MetricCard
          label="DSCR"
          value={byName.dscr ? fmtMetric('dscr', byName.dscr) : '—'}
        />
      </div>

      <div className="sg-card p-5">
        <div className="text-sm font-semibold tracking-tight mb-3">Extracted metrics</div>
        {metrics.length === 0 ? (
          <div className="text-sm text-sg-muted-light">
            No metrics extracted yet. Upload financial documents and run AI analysis to populate.
          </div>
        ) : (
          <table className="w-full text-sm">
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
                  <td className="py-2.5 capitalize">{String(m.name).replace(/_/g, ' ')}</td>
                  <td className="py-2.5 text-sg-muted">{m.period ?? '—'}</td>
                  <td className="py-2.5 text-right tabular-nums">{fmtMetric(m.name, m)}</td>
                  <td className="py-2.5 text-right tabular-nums text-sg-muted">
                    {m.confidence != null ? Number(m.confidence).toFixed(2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
