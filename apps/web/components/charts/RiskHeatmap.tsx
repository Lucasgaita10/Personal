'use client';
import { cn } from '@/lib/cn';
import { RiskCategoryIcon } from '@/components/opportunity/RiskCategoryIcon';

const CATEGORIES = [
  'SPONSOR',
  'LEVERAGE',
  'MARKET',
  'CONCENTRATION',
  'LEGAL',
  'CONSTRUCTION',
  'TENANT',
  'REFINANCE',
  'REGULATORY',
  'ESG',
] as const;
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export function RiskHeatmap({
  data,
}: {
  data: { category: string; severity: string; _count: { _all: number } }[];
}) {
  const map = new Map<string, number>();
  for (const r of data) map.set(`${r.category}:${r.severity}`, r._count._all);

  const cell = (count: number, sev: string) => {
    if (!count) return 'bg-sg-surface text-sg-muted-light';
    if (sev === 'CRITICAL') return 'bg-red-700 text-white';
    if (sev === 'HIGH') return 'bg-red-300 text-red-900';
    if (sev === 'MEDIUM') return 'bg-amber-200 text-amber-900';
    return 'bg-emerald-100 text-emerald-900';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs table-fixed">
        <colgroup>
          <col className="w-44" />
          {SEVERITIES.map((s) => (
            <col key={s} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="text-left text-sg-muted font-medium pr-2 py-1">Category</th>
            {SEVERITIES.map((s) => (
              <th key={s} className="text-left text-sg-muted font-medium px-2 py-1">
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CATEGORIES.map((cat) => (
            <tr key={cat} className="border-t border-sg-border">
              <td className="pr-2 py-1.5 text-sg-text">
                <span className="inline-flex items-center gap-2">
                  <RiskCategoryIcon category={cat} />
                  {cat}
                </span>
              </td>
              {SEVERITIES.map((s) => {
                const count = map.get(`${cat}:${s}`) ?? 0;
                return (
                  <td key={s} className="px-1 py-1">
                    <div
                      className={cn(
                        'h-7 rounded grid place-items-center font-medium',
                        cell(count, s),
                      )}
                    >
                      {count || ''}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
