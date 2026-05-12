'use client';
import { Pill } from '@/components/ui/pill';
import { RiskHeatmap } from '@/components/charts/RiskHeatmap';
import { useOpportunity } from '@/components/opportunity/OpportunityContext';

export default function RisksPage() {
  const { opportunity, loading } = useOpportunity();

  if (loading) return <div className="p-6 text-sm text-sg-muted">Loading…</div>;
  const risks = (opportunity?.risks ?? []) as any[];

  // Heatmap data: count by category × severity
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
    <div className="p-6 space-y-6">
      <div className="sg-card p-5">
        <div className="text-sm font-semibold tracking-tight mb-3">Risk heatmap</div>
        {risks.length === 0 ? (
          <div className="text-xs text-sg-muted-light">
            No risks yet. Run AI analysis after uploading documents to populate.
          </div>
        ) : (
          <RiskHeatmap data={heatmapRows as any} />
        )}
      </div>
      {risks.length > 0 && (
        <div className="sg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sg-surface text-xs text-sg-muted uppercase tracking-wider">
              <tr>
                <th className="text-left font-medium py-2 px-4">Category</th>
                <th className="text-left font-medium py-2 px-4">Severity</th>
                <th className="text-left font-medium py-2 px-4">Risk</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r) => (
                <tr key={r.id} className="border-t border-sg-border align-top">
                  <td className="py-3 px-4">{r.category}</td>
                  <td className="py-3 px-4">
                    <Pill variant={`severity-${String(r.severity).toLowerCase()}` as any}>
                      {r.severity}
                    </Pill>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium">{r.title}</div>
                    <div className="text-sg-muted">{r.description}</div>
                    {r.mitigation && (
                      <div className="text-xs text-sg-muted mt-1">
                        <span className="uppercase tracking-wider text-[10px]">Mitigation:</span>{' '}
                        {r.mitigation}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
