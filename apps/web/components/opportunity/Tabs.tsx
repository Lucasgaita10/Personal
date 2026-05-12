'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useOpportunity } from '@/components/opportunity/OpportunityContext';

const TABS = [
  { key: 'context', label: 'Context', match: ['context', 'overview'] },
  {
    key: 'initial-screening',
    label: 'Initial Screening',
    match: ['initial-screening', 'documents'],
  },
  {
    key: 'understanding',
    label: 'Understanding',
    match: ['understanding', 'financials', 'risks', 'gaps'],
  },
  { key: 'cio-review', label: 'CIO Review', match: ['cio-review', 'insights'] },
  {
    key: 'recommendation',
    label: 'Recommendation',
    match: ['recommendation', 'reports'],
  },
  { key: 'monitoring', label: 'Monitoring', match: ['monitoring'], requiresApproved: true },
];

export function OpportunityTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const { opportunity } = useOpportunity();
  const stage = opportunity?.stage ?? 'NEW';
  const recommendation = (opportunity as any)?.recommendation as string | undefined;
  const isApproved = stage === 'APPROVED' || recommendation === 'PROCEED';

  return (
    <div className="border-b border-sg-border bg-white px-4">
      <div className="flex gap-1">
        {TABS.map((t) => {
          if (t.requiresApproved && !isApproved) return null;
          const href = `/opportunities/${id}/${t.key}`;
          const active = t.match.some((m) => pathname?.includes(`/${m}`));
          return (
            <Link
              key={t.key}
              href={href}
              className={cn(
                'h-10 px-3 text-sm flex items-center border-b-2 transition-colors',
                active
                  ? 'border-sg-primary text-sg-primary font-medium'
                  : 'border-transparent text-sg-text hover:text-sg-primary',
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
