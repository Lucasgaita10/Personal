/** Server-side workflow stage computation. Mirrors apps/web/components/opportunity/workflow.ts.
 *  Use to decorate API responses with the computed workflow stage. */

export const STAGE_KEYS = [
  'context',
  'initial-screening',
  'understanding',
  'cio-review',
  'recommendation',
  'monitoring',
] as const;

export type WorkflowStage = (typeof STAGE_KEYS)[number];

export const STAGE_LABEL: Record<WorkflowStage, string> = {
  context: 'Context',
  'initial-screening': 'Initial Screening',
  understanding: 'Understanding',
  'cio-review': 'CIO Review',
  recommendation: 'Recommendation',
  monitoring: 'Monitoring',
};

interface OppShape {
  sponsor?: string | null;
  briefingNotes?: string | null;
  thesis?: string | null;
  recommendation?: string | null;
  stage?: string | null;
  client?: { id: string } | null;
  // Either the full collections OR counts via `_count`
  documents?: Array<{ status?: string | null }> | null;
  risks?: unknown[] | null;
  gaps?: unknown[] | null;
  threads?: unknown[] | null;
  scenarios?: unknown[] | null;
  reports?: unknown[] | null;
  decision?: unknown | null;
  _count?: {
    documents?: number;
    risks?: number;
    gaps?: number;
    threads?: number;
    scenarios?: number;
    reports?: number;
  };
}

function countComplete(docs: Array<{ status?: string | null }> | undefined | null): number {
  if (!docs) return 0;
  return docs.filter((d) => d?.status === 'COMPLETE').length;
}

export function computeWorkflowStage(opp: OppShape): WorkflowStage {
  const hasContext = !!(opp.briefingNotes || opp.sponsor || opp.client);

  // Initial Screening: at least one COMPLETE document. If only counts are
  // available (no array), accept any document present.
  const docsCompleteCount = countComplete(opp.documents);
  const totalDocs = opp.documents ? opp.documents.length : opp._count?.documents ?? 0;
  const hasScreening = docsCompleteCount > 0 || totalDocs > 0;

  const hasUnderstanding =
    !!opp.thesis ||
    (opp.risks?.length ?? opp._count?.risks ?? 0) > 0 ||
    (opp.gaps?.length ?? opp._count?.gaps ?? 0) > 0;

  const hasCioReview =
    (opp.threads?.length ?? opp._count?.threads ?? 0) > 0 ||
    (opp.scenarios?.length ?? opp._count?.scenarios ?? 0) > 0;

  // A draft IC memo (Report row) is NOT a recommendation — it's just an
  // AI-generated artifact for review. Only an actual decision counts.
  const hasRecommendation =
    !!opp.decision ||
    opp.recommendation === 'PROCEED' ||
    opp.recommendation === 'PROCEED_WITH_CONDITIONS' ||
    opp.recommendation === 'REJECT';

  const isApproved =
    opp.stage === 'APPROVED' ||
    opp.recommendation === 'PROCEED' ||
    opp.recommendation === 'PROCEED_WITH_CONDITIONS';

  let current: WorkflowStage = 'context';
  if (hasContext) current = 'context';
  if (hasScreening) current = 'initial-screening';
  if (hasUnderstanding) current = 'understanding';
  if (hasCioReview) current = 'cio-review';
  if (hasRecommendation) current = 'recommendation';
  if (hasRecommendation && isApproved) current = 'monitoring';
  return current;
}
