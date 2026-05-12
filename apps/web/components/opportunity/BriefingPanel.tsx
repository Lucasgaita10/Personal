'use client';
import { useEffect, useState } from 'react';
import { Pencil, Save, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOpportunity } from '@/components/opportunity/OpportunityContext';
import { api } from '@/lib/api';

export function BriefingPanel() {
  const { opportunity, refresh } = useOpportunity();
  const briefing = (opportunity as any)?.briefingNotes ?? '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(briefing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(briefing);
  }, [briefing]);

  async function save() {
    if (!opportunity) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateBriefing(opportunity.id, draft.trim() || null);
      await refresh();
      setEditing(false);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-sg-primary" />
          <div className="text-sm font-semibold tracking-tight">Briefing notes</div>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-sg-primary hover:underline flex items-center gap-1"
          >
            <Pencil className="h-3 w-3" />
            {briefing ? 'Edit' : 'Add brief'}
          </button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(briefing);
                setEditing(false);
                setError(null);
              }}
              disabled={saving}
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        )}
      </div>

      {!editing && !briefing ? (
        <div className="text-sm text-sg-muted-light">
          No briefing yet. Add deal-specific context, client preferences, and particularities the
          AI must consider when analyzing this opportunity.
        </div>
      ) : !editing ? (
        <div className="text-sm whitespace-pre-wrap leading-relaxed text-sg-text">{briefing}</div>
      ) : (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            placeholder="Goals, preferences, particularities, hot buttons, red lines…"
            className="w-full rounded border border-sg-border bg-white px-3 py-2 text-sm shadow-sm placeholder:text-sg-muted-light focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sg-primary resize-y min-h-[180px]"
          />
          {error ? <div className="mt-2 text-xs text-destructive">{error}</div> : null}
          <div className="mt-2 text-[11px] text-sg-muted-light">
            Loaded into every AI agent run for this opportunity.
          </div>
        </>
      )}
    </div>
  );
}
