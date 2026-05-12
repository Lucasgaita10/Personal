/** Single source of truth for the opportunity workflow stage.
 *  Used by the header pill, the stepper, and the default-redirect. */

export type WorkflowStage =
  | 'context'
  | 'initial-screening'
  | 'understanding'
  | 'cio-review'
  | 'recommendation'
  | 'monitoring';

export const STAGE_ORDER: WorkflowStage[] = [
  'context',
  'initial-screening',
  'understanding',
  'cio-review',
  'recommendation',
  'monitoring',
];

export const STAGE_LABEL: Record<WorkflowStage, string> = {
  context: 'Context',
  'initial-screening': 'Initial Screening',
  understanding: 'Understanding',
  'cio-review': 'CIO Review',
  recommendation: 'Recommendation',
  monitoring: 'Monitoring',
};

export const STAGE_SUB: Record<WorkflowStage, string> = {
  context: 'Briefing & deal facts',
  'initial-screening': 'Upload & classify documents',
  understanding: 'Thesis · Financials · Risks · Gaps',
  'cio-review': 'Chat · Scenarios',
  recommendation: 'IC memo · Decision',
  monitoring: 'Performance · Liquidity',
};

/** Compute completion of each stage from the opportunity payload. */
export function computeCompletion(opportunity: any): Record<WorkflowStage, boolean> {
  const docs = (opportunity?.documents ?? []) as any[];
  const docsComplete = docs.filter((d) => d.status === 'COMPLETE').length;

  const hasContext = !!(
    opportunity?.briefingNotes ||
    opportunity?.sponsor ||
    opportunity?.client
  );
  const hasScreening = docsComplete > 0;
  const hasUnderstanding =
    !!opportunity?.thesis ||
    (opportunity?.risks?.length ?? 0) > 0 ||
    (opportunity?.gaps?.length ?? 0) > 0;
  const hasCioReview =
    (opportunity?.threads?.length ?? 0) > 0 ||
    (opportunity?.scenarios?.length ?? 0) > 0;
  // A draft IC memo (Report row) is NOT a recommendation — it's just an
  // AI-generated artifact for review. Only an actual decision counts.
  const hasRecommendation =
    !!opportunity?.decision ||
    opportunity?.recommendation === 'PROCEED' ||
    opportunity?.recommendation === 'PROCEED_WITH_CONDITIONS' ||
    opportunity?.recommendation === 'REJECT';
  const isApproved =
    opportunity?.recommendation === 'PROCEED' ||
    opportunity?.recommendation === 'PROCEED_WITH_CONDITIONS' ||
    opportunity?.stage === 'APPROVED';

  return {
    context: hasContext,
    'initial-screening': hasScreening,
    understanding: hasUnderstanding,
    'cio-review': hasCioReview,
    recommendation: hasRecommendation,
    monitoring: isApproved,
  };
}

/** "Where is the analyst right now?" — the most-advanced stage that has data,
 *  OR the next incomplete stage. */
export function computeCurrentStage(opportunity: any): WorkflowStage {
  const completion = computeCompletion(opportunity);
  // Walk the order; the current stage is the LAST completed one if any,
  // otherwise the first stage.
  let current: WorkflowStage = 'context';
  for (const s of STAGE_ORDER) {
    if (completion[s]) current = s;
  }
  // If recommendation is complete & approved, we're in monitoring.
  if (completion.recommendation && completion.monitoring) current = 'monitoring';
  return current;
}

export function isApproved(opportunity: any): boolean {
  return (
    opportunity?.recommendation === 'PROCEED' ||
    opportunity?.recommendation === 'PROCEED_WITH_CONDITIONS' ||
    opportunity?.stage === 'APPROVED'
  );
}
