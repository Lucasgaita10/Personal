'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, RefreshCcw, RotateCcw, ArrowLeftCircle } from 'lucide-react';
import { useOpportunity } from '@/components/opportunity/OpportunityContext';
import { api } from '@/lib/api';

const STAGES = [
  'NEW',
  'INITIAL_SCREENING',
  'UNDER_REVIEW',
  'DUE_DILIGENCE',
  'IC_PREPARATION',
];
const STAGE_LABEL: Record<string, string> = {
  NEW: 'New',
  INITIAL_SCREENING: 'Initial Screening',
  UNDER_REVIEW: 'Under Review',
  DUE_DILIGENCE: 'Due Diligence',
  IC_PREPARATION: 'IC Preparation',
};
const STAGE_ORDER: Record<string, number> = {
  NEW: 0,
  INITIAL_SCREENING: 1,
  UNDER_REVIEW: 2,
  DUE_DILIGENCE: 3,
  IC_PREPARATION: 4,
  APPROVED: 5,
  REJECTED: 5,
  CLOSED: 6,
};

type Mode = null | 'rerun' | 'reset' | 'rollback';

export function RestartActionsMenu() {
  const { opportunity, refresh } = useOpportunity();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(null);

  if (!opportunity) return null;

  const dialogTitle =
    mode === 'rerun'
      ? 'Re-run analysis'
      : mode === 'reset'
        ? 'Reset analysis'
        : 'Roll back stage';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-8 w-8 grid place-items-center rounded hover:bg-sg-surface text-sg-muted"
        aria-label="Actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 w-72 sg-card p-1 shadow-xl">
          <ActionItem
            icon={RefreshCcw}
            title="Re-run analysis"
            description="New info arrived; refresh the analysis with it."
            onClick={() => {
              setOpen(false);
              setMode('rerun');
            }}
          />
          <ActionItem
            icon={RotateCcw}
            title="Reset analysis"
            description="Discard AI outputs, optionally roll back stage."
            onClick={() => {
              setOpen(false);
              setMode('reset');
            }}
          />
          <ActionItem
            icon={ArrowLeftCircle}
            title="Roll back stage"
            description="Demote without touching analysis."
            onClick={() => {
              setOpen(false);
              setMode('rollback');
            }}
          />
        </div>
      )}

      <Dialog open={mode !== null} onOpenChange={(o) => (!o ? setMode(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {mode === 'rerun'
                ? 'Provide what changed. The AI will re-analyze with this update at the top of its context.'
                : mode === 'reset'
                  ? 'Clear all AI outputs (risks, gaps, thesis, scores). Documents and briefings are preserved.'
                  : 'Demote stage. The AI keeps its current analysis but the workflow rolls back.'}
            </DialogDescription>
          </DialogHeader>
          {mode === 'rerun' && (
            <RerunForm
              onCancel={() => setMode(null)}
              onSubmit={async (reason) => {
                await api.rerun(opportunity.id, reason);
                await refresh();
                setMode(null);
              }}
            />
          )}
          {mode === 'reset' && (
            <ResetForm
              currentStage={opportunity.stage}
              onCancel={() => setMode(null)}
              onSubmit={async (reason, rollbackToStage) => {
                await api.reset(opportunity.id, reason, rollbackToStage);
                await refresh();
                setMode(null);
              }}
            />
          )}
          {mode === 'rollback' && (
            <RollbackForm
              currentStage={opportunity.stage}
              onCancel={() => setMode(null)}
              onSubmit={async (stage, reason) => {
                await api.setStage(opportunity.id, stage, reason);
                await refresh();
                setMode(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionItem({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: any;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex gap-3 p-3 rounded hover:bg-sg-surface transition-colors"
    >
      <Icon className="h-4 w-4 mt-0.5 text-sg-primary shrink-0" />
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-sg-muted">{description}</div>
      </div>
    </button>
  );
}

function ReasonField({
  reason,
  setReason,
  placeholder,
}: {
  reason: string;
  setReason: (s: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-sg-muted">Reason *</span>
      <textarea
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        placeholder={placeholder}
        className="mt-1 w-full rounded border border-sg-border bg-white px-3 py-2 text-sm shadow-sm placeholder:text-sg-muted-light focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sg-primary resize-y min-h-[100px]"
      />
    </label>
  );
}

function RerunForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (reason.trim().length < 3) {
          setError('Provide a clear reason.');
          return;
        }
        setSubmitting(true);
        setError(null);
        try {
          await onSubmit(reason.trim());
        } catch (err: any) {
          setError(err.message);
        } finally {
          setSubmitting(false);
        }
      }}
      className="space-y-3"
    >
      <ReasonField
        reason={reason}
        setReason={setReason}
        placeholder='e.g. "Sponsor confirmed lock-up provision; need to re-evaluate liquidity risk."'
      />
      {error && <div className="text-xs text-destructive">{error}</div>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? 'Re-running…' : 'Re-run analysis'}
        </Button>
      </div>
    </form>
  );
}

function ResetForm({
  currentStage,
  onCancel,
  onSubmit,
}: {
  currentStage: string;
  onCancel: () => void;
  onSubmit: (reason: string, rollbackToStage?: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [rollbackTo, setRollbackTo] = useState('UNDER_REVIEW');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (reason.trim().length < 3) {
          setError('Provide a clear reason.');
          return;
        }
        setSubmitting(true);
        setError(null);
        try {
          await onSubmit(reason.trim(), rollbackTo);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setSubmitting(false);
        }
      }}
      className="space-y-3"
    >
      <ReasonField
        reason={reason}
        setReason={setReason}
        placeholder='e.g. "Sponsor materially changed deal terms — original thesis invalid."'
      />
      <label className="block">
        <span className="text-[11px] text-sg-muted">Roll back stage to</span>
        <select
          value={rollbackTo}
          onChange={(e) => setRollbackTo(e.target.value)}
          className="mt-1 flex h-9 w-full rounded border border-sg-border bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-sg-primary"
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <div className="text-[11px] text-sg-muted-light">
        Risks, gaps, thesis, executive summary, and scoring will be cleared. Documents and
        briefings are preserved. Audit log captures the prior state.
      </div>
      {error && <div className="text-xs text-destructive">{error}</div>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={submitting}
          className="!bg-destructive hover:!bg-destructive/90"
        >
          {submitting ? 'Resetting…' : 'Reset analysis'}
        </Button>
      </div>
    </form>
  );
}

function RollbackForm({
  currentStage,
  onCancel,
  onSubmit,
}: {
  currentStage: string;
  onCancel: () => void;
  onSubmit: (stage: string, reason: string) => Promise<void>;
}) {
  const earlierStages = STAGES.filter((s) => STAGE_ORDER[s] < STAGE_ORDER[currentStage]);
  const [stage, setStage] = useState(earlierStages[earlierStages.length - 1] ?? 'UNDER_REVIEW');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (earlierStages.length === 0) {
    return (
      <div className="text-sm text-sg-muted">
        Already at the earliest stage — nothing to roll back to.
        <div className="flex justify-end pt-3">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (reason.trim().length < 3) {
          setError('Reason required.');
          return;
        }
        setSubmitting(true);
        setError(null);
        try {
          await onSubmit(stage, reason.trim());
        } catch (err: any) {
          setError(err.message);
        } finally {
          setSubmitting(false);
        }
      }}
      className="space-y-3"
    >
      <label className="block">
        <span className="text-[11px] text-sg-muted">Roll back to</span>
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          className="mt-1 flex h-9 w-full rounded border border-sg-border bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-sg-primary"
        >
          {earlierStages.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <ReasonField
        reason={reason}
        setReason={setReason}
        placeholder='e.g. "New finding warrants more diligence — back to UNDER_REVIEW."'
      />
      {error && <div className="text-xs text-destructive">{error}</div>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? 'Rolling back…' : 'Roll back'}
        </Button>
      </div>
    </form>
  );
}
