'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function OppRoot({ params }: { params: { id: string } }) {
  const router = useRouter();
  useEffect(() => {
    api
      .opportunity(params.id)
      .then((opp: any) => {
        const docs = opp.documents ?? [];
        const docsComplete = docs.filter((d: any) => d.status === 'COMPLETE').length;
        const hasContext =
          !!opp.briefingNotes || !!opp.sponsor || !!opp.client;
        const hasUnderstanding =
          !!opp.thesis ||
          (opp.risks?.length ?? 0) > 0 ||
          (opp.gaps?.length ?? 0) > 0;
        const hasCioReview = (opp.threads?.length ?? 0) > 0;
        const hasRecommendation =
          (opp.reports?.length ?? 0) > 0 || !!opp.decision;

        // Pick first incomplete stage (or land on the most-advanced completed one).
        let target = 'context';
        if (!hasContext) target = 'context';
        else if (docsComplete === 0) target = 'initial-screening';
        else if (!hasUnderstanding) target = 'understanding';
        else if (!hasCioReview) target = 'cio-review';
        else if (!hasRecommendation) target = 'recommendation';
        else target = 'understanding'; // fully populated → land on the meaty page

        router.replace(`/opportunities/${params.id}/${target}`);
      })
      .catch(() => router.replace(`/opportunities/${params.id}/context`));
  }, [params.id, router]);
  return <div className="p-6 text-sm text-sg-muted">Loading…</div>;
}
