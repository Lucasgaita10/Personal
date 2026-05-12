'use client';
import { Activity, TrendingUp, AlertCircle, Banknote } from 'lucide-react';
import { useOpportunity } from '@/components/opportunity/OpportunityContext';

export default function MonitoringPage() {
  const { opportunity } = useOpportunity();
  return (
    <div className="p-6 space-y-6">
      <div className="sg-card p-6">
        <div className="flex items-start gap-3">
          <Activity className="h-5 w-5 text-sg-primary mt-0.5" />
          <div>
            <div className="text-sm font-semibold tracking-tight">Post-decision monitoring</div>
            <div className="text-xs text-sg-muted mt-1">
              Track this investment after approval — actuals vs underwritten, covenant
              compliance, liquidity events, and AI alerts when something drifts.
            </div>
            {opportunity?.recommendation && (
              <div className="text-xs text-sg-text mt-2">
                Decision recorded:{' '}
                <span className="font-medium">{opportunity.recommendation}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <PlaceholderCard
          icon={TrendingUp}
          title="Performance vs underwriting"
          description="Quarterly NOI, occupancy, and IRR-to-date compared with the underwritten base case."
        />
        <PlaceholderCard
          icon={Banknote}
          title="Liquidity & distributions"
          description="Capital calls, distributions, leverage profile, refinance windows."
        />
        <PlaceholderCard
          icon={AlertCircle}
          title="Covenant & alignment alerts"
          description="DSCR breaches, debt yield breaches, sponsor co-invest changes, manager turnover."
        />
      </div>

      <div className="sg-card-muted p-5 text-xs text-sg-muted-light">
        Monitoring features are on the roadmap. Today this surface tracks the decision
        outcome — full performance ingest (sponsor reports, audited financials) lights up in
        a future phase.
      </div>
    </div>
  );
}

function PlaceholderCard({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <div className="sg-card p-5">
      <Icon className="h-4 w-4 text-sg-primary" />
      <div className="text-sm font-semibold tracking-tight mt-2">{title}</div>
      <div className="text-xs text-sg-muted mt-1">{description}</div>
    </div>
  );
}
