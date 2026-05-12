'use client';
import { useState } from 'react';
import { Sparkles, Brain, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOpportunity } from '@/components/opportunity/OpportunityContext';
import { api } from '@/lib/api';

const AGENT_LABELS = [
  'Reading documents',
  'Drafting investment thesis',
  'Extracting financial metrics',
  'Identifying risks',
  'Mapping diligence gaps',
  'Computing scores',
];

export function AnalyzeButton() {
  const { opportunity, refresh } = useOpportunity();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [summary, setSummary] = useState<any | null>(null);

  if (!opportunity) return null;
  const docCount = opportunity.documents?.length ?? 0;
  const completeDocs = (opportunity.documents ?? []).filter(
    (d: any) => d.status === 'COMPLETE',
  ).length;
  const hasAnalysis =
    !!opportunity.thesis ||
    (opportunity.risks?.length ?? 0) > 0 ||
    (opportunity.gaps?.length ?? 0) > 0;

  async function run() {
    if (completeDocs === 0) return;
    setRunning(true);
    setError(null);
    setSummary(null);
    setStep(0);
    // Cycle the step labels for visual feedback (the backend runs in parallel
    // so we just rotate through to indicate activity).
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % AGENT_LABELS.length);
    }, 2500);
    try {
      const result: any = await api.analyze(opportunity.id);
      setSummary(result.summary);
      await refresh();
    } catch (err: any) {
      setError(err.message ?? 'Analysis failed');
    } finally {
      clearInterval(interval);
      setRunning(false);
    }
  }

  if (running) {
    return (
      <div className="sg-card p-5 border-sg-primary bg-sg-primary-soft">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Brain className="h-5 w-5 text-sg-primary" />
            <div className="absolute inset-0 animate-ping">
              <Brain className="h-5 w-5 text-sg-primary opacity-30" />
            </div>
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold tracking-tight">
              Running AI analysis…
            </div>
            <div className="text-xs text-sg-muted mt-0.5">
              {AGENT_LABELS[step]} · this typically takes 30–90 seconds
            </div>
          </div>
        </div>
        <div className="mt-3 h-1 bg-white rounded overflow-hidden">
          <div
            className="h-full bg-sg-primary transition-all"
            style={{ width: `${((step + 1) / AGENT_LABELS.length) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  if (summary) {
    return (
      <div className="sg-card p-5 border-emerald-200 bg-emerald-50">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-emerald-700 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-semibold tracking-tight text-emerald-900">
              Analysis complete
            </div>
            <div className="text-xs text-emerald-800 mt-1">
              {summary.thesis_generated ? 'Thesis drafted · ' : ''}
              {summary.metrics ?? 0} metric{summary.metrics === 1 ? '' : 's'} ·{' '}
              {summary.risks ?? 0} risk{summary.risks === 1 ? '' : 's'} ·{' '}
              {summary.gaps ?? 0} gap{summary.gaps === 1 ? '' : 's'} identified
            </div>
            <div className="mt-2 text-xs text-emerald-800">
              See the Risks, Gaps, and Financials tabs. The Insights chat is now ready
              with full document context.
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setSummary(null)}>
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="sg-card p-5 border-sg-primary/40 bg-sg-primary-soft">
      <div className="flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-sg-primary mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-semibold tracking-tight">
            {hasAnalysis ? 'Re-run AI analysis' : 'Run AI analysis'}
          </div>
          <div className="text-xs text-sg-muted mt-1">
            {completeDocs === 0
              ? 'Upload and process at least one document before running analysis.'
              : hasAnalysis
                ? `Refresh thesis, risks, gaps, and financial extraction across the ${completeDocs} processed document${completeDocs === 1 ? '' : 's'}.`
                : `Run all four agents (Thesis · Financial · Risk · Gap) in parallel across the ${completeDocs} processed document${completeDocs === 1 ? '' : 's'}. Populates every tab.`}
          </div>
          {docCount > completeDocs && (
            <div className="mt-2 flex items-center gap-1 text-xs text-amber-700">
              <AlertCircle className="h-3 w-3" />
              {docCount - completeDocs} document
              {docCount - completeDocs === 1 ? ' is' : 's are'} still processing — they
              will be skipped.
            </div>
          )}
          {error && (
            <div className="mt-2 text-xs text-destructive">{error}</div>
          )}
        </div>
        <Button onClick={run} disabled={completeDocs === 0} size="sm">
          <Sparkles className="h-3.5 w-3.5" />
          {hasAnalysis ? 'Re-analyze' : 'Analyze'}
        </Button>
      </div>
    </div>
  );
}
