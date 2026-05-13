'use client';
import { useEffect, useState } from 'react';
import {
  Check,
  X,
  AlertCircle,
  HelpCircle,
  Lock,
  FileText,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { useOpportunity } from '@/components/opportunity/OpportunityContext';
import { api } from '@/lib/api';

type Decision = 'PROCEED' | 'PROCEED_WITH_CONDITIONS' | 'REJECT' | 'NEED_MORE_INFO';

const OPTIONS: {
  value: Decision;
  title: string;
  description: string;
  icon: any;
  accent: string;
}[] = [
  {
    value: 'PROCEED',
    title: 'Proceed',
    description: 'Approve and submit to IC for funding.',
    icon: Check,
    accent: 'border-emerald-500 hover:bg-emerald-50',
  },
  {
    value: 'PROCEED_WITH_CONDITIONS',
    title: 'Proceed with conditions',
    description: 'Approve subject to specific conditions being met.',
    icon: AlertCircle,
    accent: 'border-amber-500 hover:bg-amber-50',
  },
  {
    value: 'REJECT',
    title: 'Reject',
    description: 'Pass on this opportunity. Logged for institutional memory.',
    icon: X,
    accent: 'border-red-500 hover:bg-red-50',
  },
  {
    value: 'NEED_MORE_INFO',
    title: 'Need more information',
    description: 'Hold for additional diligence — return after the gaps are closed.',
    icon: HelpCircle,
    accent: 'border-sg-border hover:bg-sg-surface',
  },
];

export default function RecommendationPage() {
  const { opportunity, refresh } = useOpportunity();
  const [reports, setReports] = useState<any[]>([]);
  const [selected, setSelected] = useState<Decision | null>(null);
  const [rationale, setRationale] = useState('');
  const [conditions, setConditions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const opp = opportunity as any;
  const existing = opp?.decision;

  useEffect(() => {
    if (!opp) return;
    api
      .reports(opp.id)
      .then((r) => setReports(r as any[]))
      .catch(() => setReports([]));
  }, [opp?.id]);

  useEffect(() => {
    if (existing) {
      setSelected(existing.decision);
      setRationale(existing.rationale ?? '');
      setConditions(existing.conditions ?? '');
    }
  }, [existing?.id]);

  async function submit() {
    if (!opp || !selected) return;
    if (rationale.trim().length < 10) {
      setError('Rationale should explain the decision (minimum 10 characters).');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.decision(opp.id, {
        decision: selected,
        rationale: rationale.trim(),
        conditions: conditions.trim() || undefined,
      });
      setSuccess('Decision recorded.');
      await refresh();
    } catch (err: any) {
      setError(err.message ?? 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (!opp) {
    return <div className="p-6 text-sm text-sg-muted">Loading…</div>;
  }

  const memo = reports.find((r) => r.type === 'IC_MEMO_LONG');
  const summary = reports.find((r) => r.type === 'EXECUTIVE_SUMMARY');
  const deck = reports.find((r) => r.type === 'PRESENTATION_DECK');
  const hasAnyReport = reports.length > 0;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {existing && (
        <div className="sg-card p-5 border-sg-primary bg-sg-primary-soft">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-sg-primary mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-semibold tracking-tight">
                Decision recorded —{' '}
                <span className="uppercase tracking-wider">
                  {existing.decision.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="text-xs text-sg-muted mt-1">
                {new Date(existing.decidedAt).toLocaleString()}
              </div>
              <div className="mt-3 text-sm whitespace-pre-wrap">{existing.rationale}</div>
              {existing.conditions && (
                <div className="mt-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-sg-muted">
                    Conditions
                  </div>
                  <div className="text-sm whitespace-pre-wrap mt-1">
                    {existing.conditions}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="sg-card p-5">
        <div className="text-sm font-semibold tracking-tight">Reports submitted to IC</div>
        <div className="text-xs text-sg-muted mt-1 mb-4">
          These artifacts back the decision. Generate or refresh them in the{' '}
          <strong>Understanding</strong> tab.
        </div>
        {!hasAnyReport ? (
          <div className="text-sm text-sg-muted-light">
            No reports yet. Run the AI analysis and generate the IC memo before recording a
            decision.
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <ReportRow label="IC Memo" report={memo} />
            <ReportRow label="Executive Summary" report={summary} />
            <ReportRow label="Presentation Deck" report={deck} />
          </div>
        )}
      </div>

      <div className="sg-card p-5 space-y-5">
        <div>
          <div className="text-sm font-semibold tracking-tight">
            {existing ? 'Update decision' : 'Record decision'}
          </div>
          <div className="text-xs text-sg-muted mt-1">
            {existing
              ? 'You can update the decision; the change is audit-logged.'
              : 'This decision is captured against the current analysis snapshot. The audit trail is immutable.'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {OPTIONS.map((o) => {
            const Icon = o.icon;
            const active = selected === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setSelected(o.value)}
                className={`sg-card text-left p-4 border-2 transition-colors ${
                  active ? 'border-sg-primary bg-sg-primary-soft' : o.accent
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={`h-4 w-4 ${active ? 'text-sg-primary' : 'text-sg-muted'}`}
                  />
                  <div className="text-sm font-semibold">{o.title}</div>
                </div>
                <div className="text-xs text-sg-muted mt-1">{o.description}</div>
              </button>
            );
          })}
        </div>

        <label className="block">
          <span className="text-[11px] text-sg-muted">Rationale *</span>
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={5}
            placeholder="Why this decision? Reference the documents, scenarios, and key risks. This rationale is part of the audit trail."
            className="mt-1 w-full rounded border border-sg-border bg-white px-3 py-2 text-sm shadow-sm placeholder:text-sg-muted-light focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sg-primary resize-y min-h-[120px]"
          />
        </label>

        {selected === 'PROCEED_WITH_CONDITIONS' && (
          <label className="block">
            <span className="text-[11px] text-sg-muted">Conditions</span>
            <textarea
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              rows={4}
              placeholder="List conditions that must be met before funding (e.g. sponsor reps, exit cap stress, KYC clearance, signed leases)."
              className="mt-1 w-full rounded border border-sg-border bg-white px-3 py-2 text-sm shadow-sm placeholder:text-sg-muted-light focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sg-primary resize-y min-h-[100px]"
            />
          </label>
        )}

        {error && <div className="text-xs text-destructive">{error}</div>}
        {success && <div className="text-xs text-emerald-700">{success}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={submit} disabled={!selected || submitting} size="sm">
            <Lock className="h-3.5 w-3.5" />
            {submitting
              ? 'Submitting…'
              : existing
                ? 'Update decision'
                : 'Record decision & lock'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReportRow({ label, report }: { label: string; report?: any }) {
  if (!report) {
    return (
      <div className="flex items-center justify-between text-sg-muted-light">
        <span>
          <FileText className="h-4 w-4 inline mr-2 -mt-0.5" />
          {label}
        </span>
        <span className="text-xs">Not generated</span>
      </div>
    );
  }
  const v = report.payload?.analysis_version;
  return (
    <div className="flex items-center justify-between">
      <span>
        <FileText className="h-4 w-4 inline mr-2 -mt-0.5 text-sg-primary" />
        {label}
      </span>
      <div className="flex items-center gap-3">
        {v != null && <Pill>analysis v{v}</Pill>}
        <span className="text-xs text-sg-muted tabular-nums">
          {new Date(report.createdAt).toLocaleDateString()}
        </span>
        <a
          href={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? '/bff'}/v1/reports/${report.id}/download`}
          className="inline-flex items-center gap-1 text-xs text-sg-primary hover:underline"
        >
          <Download className="h-3 w-3" /> Download
        </a>
      </div>
    </div>
  );
}
