'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check } from 'lucide-react';
import { useOpportunity } from '@/components/opportunity/OpportunityContext';
import { cn } from '@/lib/cn';
import {
  STAGE_ORDER,
  STAGE_LABEL,
  STAGE_SUB,
  computeCompletion,
  computeCurrentStage,
  isApproved as opportunityIsApproved,
  type WorkflowStage,
} from '@/components/opportunity/workflow';

export function StagesStepper({ id }: { id: string }) {
  const { opportunity } = useOpportunity();
  const pathname = usePathname();

  const completion = computeCompletion(opportunity);
  const computedCurrent = computeCurrentStage(opportunity);
  const isApproved = opportunityIsApproved(opportunity);

  // If the user is viewing a specific stage, highlight that one. Otherwise highlight
  // the computed current stage.
  const fromUrl = STAGE_ORDER.find((s) => pathname?.includes(`/${s}`));
  const activeKey: WorkflowStage = fromUrl ?? computedCurrent;

  return (
    <div className="border-b border-sg-border bg-sg-surface px-6 py-3">
      <div className="flex items-stretch gap-1">
        {STAGE_ORDER.map((s, idx) => {
          const isActive = activeKey === s;
          const isComplete = completion[s];
          const isLocked = s === 'monitoring' && !isApproved;
          const href = `/opportunities/${id}/${s}`;

          const inner = (
            <div
              className={cn(
                'flex-1 flex items-center gap-3 px-3 py-2 rounded transition-colors min-w-0',
                isActive && 'bg-white border border-sg-primary',
                !isActive && !isLocked && 'hover:bg-white border border-transparent',
                isLocked && 'opacity-40 cursor-not-allowed',
              )}
            >
              <div
                className={cn(
                  'h-6 w-6 rounded-full grid place-items-center text-[11px] font-semibold shrink-0',
                  isActive
                    ? 'bg-sg-primary text-white'
                    : isComplete
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border border-sg-border text-sg-muted',
                )}
              >
                {isComplete && !isActive ? <Check className="h-3 w-3" /> : idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    'text-xs font-semibold tracking-tight truncate',
                    isActive ? 'text-sg-primary' : 'text-sg-text',
                  )}
                >
                  {STAGE_LABEL[s]}
                </div>
                <div className="text-[10px] text-sg-muted truncate">{STAGE_SUB[s]}</div>
              </div>
            </div>
          );

          return isLocked ? (
            <div key={s} className="flex-1" title="Available after the deal is approved">
              {inner}
            </div>
          ) : (
            <Link key={s} href={href} className="flex-1 min-w-0">
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
