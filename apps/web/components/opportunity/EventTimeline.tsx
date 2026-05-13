'use client';
import { useEffect, useState } from 'react';
import { RefreshCcw, RotateCcw, ArrowLeftCircle } from 'lucide-react';
import { useOpportunity } from '@/components/opportunity/OpportunityContext';

const KIND_ICON: Record<string, any> = {
  update_event: RefreshCcw,
  reset_event: RotateCcw,
  stage_rollback: ArrowLeftCircle,
};
const KIND_LABEL: Record<string, string> = {
  update_event: 'Updated',
  reset_event: 'Reset',
  stage_rollback: 'Rolled back',
};

type Event = {
  id: string;
  kind: string;
  content: string;
  createdAt: string;
};

export function EventTimeline() {
  const { opportunity } = useOpportunity();
  const [events, setEvents] = useState<Event[]>([]);

  // Fetch via the opportunity payload — but `memories` isn't included by default.
  // We'll do a tiny separate fetch.
  useEffect(() => {
    if (!opportunity) return;
    const token =
      typeof window !== 'undefined' ? window.localStorage.getItem('sg_token') : null;
    fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL ?? '/bff'}/v1/opportunities/${opportunity.id}/events`,
      {
        credentials: 'include',
        headers: token ? { authorization: `Bearer ${token}` } : {},
      },
    )
      .then(async (r) => (r.ok ? r.json() : []))
      .then((data) => setEvents(data as Event[]))
      .catch(() => setEvents([]));
  }, [opportunity?.id, opportunity?.analysisVersion]);

  if (!opportunity || events.length === 0) return null;

  return (
    <div className="border-b border-sg-border bg-sg-surface px-6 py-2 flex items-center gap-3 overflow-x-auto">
      <span className="text-[10px] uppercase tracking-[0.16em] text-sg-muted shrink-0">
        Restart events
      </span>
      <div className="flex gap-2">
        {events.slice(0, 6).map((e) => {
          const Icon = KIND_ICON[e.kind] ?? RefreshCcw;
          const date = new Date(e.createdAt);
          const dateStr = date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          });
          return (
            <div
              key={e.id}
              title={e.content}
              className="flex items-center gap-2 px-2.5 py-1 rounded border border-sg-border bg-white text-[11px] shrink-0 max-w-[260px]"
            >
              <Icon className="h-3 w-3 text-sg-primary shrink-0" />
              <span className="font-medium">{KIND_LABEL[e.kind]}</span>
              <span className="text-sg-muted">· {dateStr}</span>
              <span className="truncate text-sg-muted-light">— {e.content}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
