import { OpportunityProvider } from '@/components/opportunity/OpportunityContext';
import { OpportunityHeader } from '@/components/opportunity/Header';
import { EventTimeline } from '@/components/opportunity/EventTimeline';
import { StagesStepper } from '@/components/opportunity/StagesStepper';

export default function OpportunityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return (
    <OpportunityProvider id={params.id}>
      <OpportunityHeader />
      <StagesStepper id={params.id} />
      <EventTimeline />
      <div className="flex-1 overflow-auto">{children}</div>
    </OpportunityProvider>
  );
}
