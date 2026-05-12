'use client';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { FileText, FileBarChart, Presentation } from 'lucide-react';
import { api } from '@/lib/api';

export default function ReportsPage({ params }: { params: { id: string } }) {
  async function generate(type: string) {
    try {
      await api.generateReport({ opportunityId: params.id, type });
      alert(`${type} generated. Check Reports list.`);
    } catch (err: any) {
      alert(err.message);
    }
  }
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <ReportCard
          icon={FileText}
          title="IC Memo (long)"
          description="Institutional 12–18 page memorandum with full diligence and recommendation."
          onGenerate={() => generate('IC_MEMO_LONG')}
        />
        <ReportCard
          icon={FileBarChart}
          title="Executive Summary"
          description="2–3 page principal-ready brief with decision and key risks."
          onGenerate={() => generate('EXECUTIVE_SUMMARY')}
        />
        <ReportCard
          icon={Presentation}
          title="Presentation Deck"
          description="Polished IC presentation in Stone Gate template."
          onGenerate={() => generate('PRESENTATION_DECK')}
        />
      </div>
      <div className="sg-card p-5">
        <div className="text-sm font-semibold tracking-tight mb-3">Recent reports</div>
        <div className="text-sm text-sg-muted">
          Generated reports appear here, versioned with author + timestamp.
        </div>
      </div>
    </div>
  );
}

function ReportCard({
  icon: Icon,
  title,
  description,
  onGenerate,
}: {
  icon: any;
  title: string;
  description: string;
  onGenerate: () => void;
}) {
  return (
    <div className="sg-card p-5 flex flex-col">
      <Icon className="h-6 w-6 text-sg-primary" />
      <div className="mt-3 text-sm font-semibold tracking-tight">{title}</div>
      <div className="mt-1 text-xs text-sg-muted flex-1">{description}</div>
      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" onClick={onGenerate}>Generate</Button>
        <Pill>Stone Gate template</Pill>
      </div>
    </div>
  );
}
