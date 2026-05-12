'use client';
import {
  Target,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { Pill } from '@/components/ui/pill';
import { useOpportunity } from '@/components/opportunity/OpportunityContext';
import { cn } from '@/lib/cn';
import { QuadrantPanel } from '@/components/ui/quadrant-panel';

const VERDICT_META: Record<
  string,
  { label: string; pillVariant: any; tone: string; icon: any }
> = {
  PROCEED: {
    label: 'Proceed',
    pillVariant: 'severity-low',
    tone: 'border-emerald-300 bg-emerald-50',
    icon: ThumbsUp,
  },
  PROCEED_WITH_CONDITIONS: {
    label: 'Proceed with conditions',
    pillVariant: 'severity-medium',
    tone: 'border-amber-300 bg-amber-50',
    icon: HelpCircle,
  },
  REJECT: {
    label: 'Reject',
    pillVariant: 'severity-high',
    tone: 'border-red-300 bg-red-50',
    icon: ThumbsDown,
  },
  NEED_MORE_INFO: {
    label: 'Need more info',
    pillVariant: 'default',
    tone: 'border-sg-border bg-sg-surface',
    icon: HelpCircle,
  },
};

export function AIRecommendationCard() {
  const { opportunity } = useOpportunity();
  const o = opportunity as any;
  if (!o) return null;

  const verdict: string | null = o.aiVerdict ?? null;
  const rationale: string | null = o.aiVerdictRationale ?? null;
  const reasonsFor: string[] = Array.isArray(o.aiTopReasonsFor) ? o.aiTopReasonsFor : [];
  const reasonsAgainst: string[] = Array.isArray(o.aiTopReasonsAgainst)
    ? o.aiTopReasonsAgainst
    : [];
  const nextSteps: string[] = Array.isArray(o.aiNextSteps) ? o.aiNextSteps : [];
  const criticalQ: string[] = Array.isArray(o.aiCriticalQuestions)
    ? o.aiCriticalQuestions
    : [];
  const watchpoints: string[] = Array.isArray(o.aiWatchpoints) ? o.aiWatchpoints : [];

  if (!verdict && !rationale) return null;

  const meta = (verdict && VERDICT_META[verdict]) || VERDICT_META.NEED_MORE_INFO;
  const Icon = meta.icon;

  return (
    <section className={cn('sg-card border-2 p-6 space-y-5', meta.tone)}>
      {/* ─── Header ──────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <Target className="h-5 w-5 text-sg-primary mt-0.5" />
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.16em] text-sg-muted">
            AI Recommendation
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="text-lg font-semibold tracking-tight">{meta.label}</span>
            <Pill variant={meta.pillVariant}>v{o.analysisVersion ?? 1}</Pill>
          </div>
          <div className="text-[11px] text-sg-muted mt-1">
            The AI's holistic verdict from synthesis. Distinct from the human decision (see
            Recommendation tab).
          </div>
        </div>
      </div>

      {/* ─── Rationale ───────────────────────────────────── */}
      {rationale && (
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-sg-text">
          {rationale}
        </div>
      )}

      {/* ─── Quadrants: For / Against / Questions / Next ── */}
      <div className="grid grid-cols-2 gap-3">
        <QuadrantPanel
          variant="positive"
          icon={ThumbsUp}
          title="Reasons in favor"
          items={reasonsFor}
        />
        <QuadrantPanel
          variant="negative"
          icon={ThumbsDown}
          title="Reasons against"
          items={reasonsAgainst}
        />
        <QuadrantPanel
          variant="caution"
          icon={HelpCircle}
          title="Decision-critical questions"
          items={criticalQ}
          ordered
        />
        <QuadrantPanel
          variant="forward"
          icon={ArrowRight}
          title="Next steps"
          items={nextSteps}
        />
      </div>

      {/* ─── Watchpoints (neutral) ───────────────────────── */}
      {watchpoints.length > 0 && (
        <div className="border-t border-sg-border pt-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-sg-muted mb-2 flex items-center gap-1.5">
            <Eye className="h-3 w-3" /> Watchpoints if approved
          </div>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-sg-muted">
            {watchpoints.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

