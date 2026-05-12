'use client';
import { Pill } from '@/components/ui/pill';
import { useOpportunity } from '@/components/opportunity/OpportunityContext';

const PRIO_TO_VARIANT: Record<string, any> = {
  BLOCKER: 'severity-critical',
  HIGH: 'severity-high',
  MEDIUM: 'severity-medium',
  LOW: 'severity-low',
};

export default function GapsPage() {
  const { opportunity, loading } = useOpportunity();
  if (loading) return <div className="p-6 text-sm text-sg-muted">Loading…</div>;

  const gaps = (opportunity?.gaps ?? []) as any[];
  const score = opportunity?.icReadinessScore;

  return (
    <div className="p-6 space-y-4">
      <div className="sg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold tracking-tight">IC Readiness Score</div>
            <div className="text-xs text-sg-muted">
              Computed from gaps, contradictions, and coverage
            </div>
          </div>
          <div className="text-3xl font-semibold tabular-nums tracking-tight">
            {score != null ? Number(score).toFixed(1) : '—'}
            <span className="text-sg-muted text-base">/10</span>
          </div>
        </div>
      </div>
      {gaps.length === 0 ? (
        <div className="sg-card-muted p-5 text-sm text-sg-muted-light">
          No gaps yet. Run AI analysis to identify diligence gaps from your uploaded documents.
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
                    <Pill variant={PRIO_TO_VARIANT[g.priority]}>{g.priority}</Pill>
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
    </div>
  );
}
