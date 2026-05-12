'use client';
import { Topbar } from '@/components/layout/Topbar';
import { Pill } from '@/components/ui/pill';
import { useOpportunity } from '@/components/opportunity/OpportunityContext';
import { RestartActionsMenu } from '@/components/opportunity/RestartActionsMenu';
import { computeCurrentStage, STAGE_LABEL } from '@/components/opportunity/workflow';

export function OpportunityHeader() {
  const { opportunity, loading, error } = useOpportunity();

  if (loading) {
    return (
      <>
        <Topbar title="Loading opportunity…" subtitle="" />
        <div className="border-b border-sg-border bg-white px-6 py-3 h-12" />
      </>
    );
  }
  if (error || !opportunity) {
    return (
      <>
        <Topbar title="Opportunity not found" subtitle={error ?? ''} />
        <div className="border-b border-sg-border bg-white px-6 py-3 h-12" />
      </>
    );
  }

  const subtitleParts = [
    opportunity.sponsor,
    [opportunity.city, opportunity.country].filter(Boolean).join(', '),
    [opportunity.propertyType, opportunity.subType].filter(Boolean).join(' / '),
  ].filter(Boolean);

  const docCount = opportunity.documents?.length ?? 0;
  const riskCount = opportunity.risks?.length ?? 0;
  const gapCount = opportunity.gaps?.length ?? 0;
  const version = (opportunity as any).analysisVersion ?? 1;

  // Workflow stage (computed from completion data — matches the stepper)
  const stage = computeCurrentStage(opportunity);
  const decision = (opportunity as any).recommendation as string | undefined;

  return (
    <>
      <Topbar title={opportunity.name} subtitle={subtitleParts.join(' · ') || undefined} />
      <div className="border-b border-sg-border bg-white px-6 py-3 flex items-center gap-2 flex-wrap">
        <Pill variant="maroon">{STAGE_LABEL[stage]}</Pill>
        {decision === 'REJECT' && <Pill variant="severity-high">Rejected</Pill>}
        {decision === 'PROCEED' && <Pill variant="severity-low">Approved</Pill>}
        {decision === 'PROCEED_WITH_CONDITIONS' && (
          <Pill variant="severity-medium">Approved with conditions</Pill>
        )}
        {version > 1 ? <Pill>v{version}</Pill> : null}
        {opportunity.riskScore != null && (
          <Pill>Risk {Number(opportunity.riskScore).toFixed(1)}</Pill>
        )}
        {opportunity.icReadinessScore != null && (
          <Pill>IC Readiness {Number(opportunity.icReadinessScore).toFixed(1)}</Pill>
        )}
        {opportunity.confidenceScore != null && (
          <Pill>Confidence {Number(opportunity.confidenceScore).toFixed(1)}</Pill>
        )}
        <span className="text-xs text-sg-muted ml-3">
          {docCount} document{docCount === 1 ? '' : 's'} · {riskCount} risk
          {riskCount === 1 ? '' : 's'} · {gapCount} gap{gapCount === 1 ? '' : 's'}
        </span>
        <div className="ml-auto">
          <RestartActionsMenu />
        </div>
      </div>
    </>
  );
}
