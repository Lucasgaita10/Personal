'use client';
import { useMemo, useState } from 'react';
import { Pill } from '@/components/ui/pill';
import { RiskHeatmap } from '@/components/charts/RiskHeatmap';
import { RiskCategoryIcon } from '@/components/opportunity/RiskCategoryIcon';

type Risk = {
  id: string;
  category: string;
  severity: string;
  title: string;
  description?: string | null;
  mitigation?: string | null;
};

type HeatmapRow = { category: string; severity: string; _count: { _all: number } };

const ALL = '__ALL__';
const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

export function RisksSection({
  risks,
  heatmapRows,
}: {
  risks: Risk[];
  heatmapRows: HeatmapRow[];
}) {
  const [category, setCategory] = useState<string>(ALL);
  const [severity, setSeverity] = useState<string>(ALL);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of risks) set.add(String(r.category).toUpperCase());
    return Array.from(set).sort();
  }, [risks]);

  const filtered = useMemo(() => {
    return risks.filter((r) => {
      if (category !== ALL && String(r.category).toUpperCase() !== category) return false;
      if (severity !== ALL && String(r.severity).toUpperCase() !== severity) return false;
      return true;
    });
  }, [risks, category, severity]);

  const selectClass =
    'h-8 rounded-md border border-sg-border bg-white px-2 text-xs text-sg-text ' +
    'focus:outline-none focus:ring-1 focus:ring-sg-primary';

  return (
    <div className="space-y-3">
      <div className="sg-card p-5">
        <RiskHeatmap data={heatmapRows as any} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-[11px] uppercase tracking-wider text-sg-muted">
            Category
          </label>
          <select
            className={selectClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value={ALL}>All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] uppercase tracking-wider text-sg-muted">
            Severity
          </label>
          <select
            className={selectClass}
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value={ALL}>All</option>
            {SEVERITY_ORDER.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {(category !== ALL || severity !== ALL) && (
          <button
            type="button"
            className="text-xs text-sg-muted underline hover:text-sg-text"
            onClick={() => {
              setCategory(ALL);
              setSeverity(ALL);
            }}
          >
            Clear filters
          </button>
        )}
        <div className="ml-auto text-xs text-sg-muted">
          Showing {filtered.length} of {risks.length}
        </div>
      </div>

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
            {filtered.length === 0 ? (
              <tr className="border-t border-sg-border">
                <td colSpan={3} className="py-6 px-4 text-center text-sg-muted italic">
                  No risks match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t border-sg-border align-top">
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-2">
                      <RiskCategoryIcon category={r.category} />
                      {r.category}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <Pill variant={`severity-${String(r.severity).toLowerCase()}` as any}>
                      {r.severity}
                    </Pill>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium">{r.title}</div>
                    {r.description && (
                      <div className="text-sg-muted">{r.description}</div>
                    )}
                    {r.mitigation && (
                      <div className="text-xs text-sg-muted mt-1">
                        <span className="uppercase tracking-wider text-[10px]">
                          Mitigation:
                        </span>{' '}
                        {r.mitigation}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
