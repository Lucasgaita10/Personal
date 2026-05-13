'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Pin, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { Pill } from '@/components/ui/pill';
import { api } from '@/lib/api';

// crypto.randomUUID() is only available in secure contexts (HTTPS or localhost).
// On plain HTTP IP-based deploys it's undefined and a call throws, killing the
// button click before any UI update happens. Fall back to a simple RFC4122-ish
// generator — only used for local React keys, never persisted.
function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      /* falls through to the polyfill */
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type Message = {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  structured?: any;
  agent?: string;
  citations?: { documentId: string; chunkId?: string; page?: number }[];
};

/** Parse content into structured data when the assistant returned JSON (the
 *  risk_analyst / gap_agent / financial_analyst all do). We prefer the
 *  server-supplied `structured` field but fall back to parsing content. */
function asStructured(content: string, fallback?: any): any | null {
  if (fallback && typeof fallback === 'object') return fallback;
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/** Renders structured chat output (risks list, gaps list, financial verdict, etc.)
 *  in proper cards. Falls back to JSON pretty-print for shapes we don't know. */
function StructuredRender({ data }: { data: any }) {
  // List shapes: { risks: [...] } | { gaps: [...] } | { assumptions: [...] }
  const listMap: Array<{ key: string; kind: 'risk' | 'gap' | 'assumption' | 'metric' }> = [
    { key: 'risks', kind: 'risk' },
    { key: 'gaps', kind: 'gap' },
    { key: 'assumptions', kind: 'assumption' },
    { key: 'metrics', kind: 'metric' },
  ];
  for (const { key, kind } of listMap) {
    if (Array.isArray(data[key])) {
      return <StructuredList items={data[key]} kind={kind} />;
    }
  }
  // Financial-verdict shape
  if (data.verdict || data.verdict_rationale || data.analysis) {
    return <VerdictRender data={data} />;
  }
  // Unknown — pretty-print JSON so it's at least readable
  return (
    <pre className="text-[11px] overflow-x-auto bg-sg-surface rounded p-2 leading-snug">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function StructuredList({
  items,
  kind,
}: {
  items: any[];
  kind: 'risk' | 'gap' | 'assumption' | 'metric';
}) {
  return (
    <div className="space-y-2 w-full">
      {items.map((it, i) => {
        const sev = (it.severity || it.priority || '').toString().toUpperCase();
        const variant = sev
          ? (`severity-${sev.toLowerCase().replace('blocker', 'critical')}` as const)
          : null;
        return (
          <div key={i} className="border border-sg-border rounded-md p-3 bg-white">
            <div className="flex items-start gap-2">
              <span className="font-medium text-sm flex-1 leading-snug">
                {it.title || it.name || `#${i + 1}`}
              </span>
              {variant && (
                <Pill variant={variant as any} className="shrink-0">
                  {sev}
                </Pill>
              )}
              {it.category && !variant && (
                <span className="text-[10px] uppercase tracking-wider text-sg-muted shrink-0">
                  {it.category}
                </span>
              )}
            </div>
            {it.description && (
              <p className="text-xs text-sg-muted mt-1.5 leading-snug">{it.description}</p>
            )}
            {it.mitigation && (
              <p className="text-xs text-sg-muted mt-1.5 leading-snug">
                <span className="uppercase tracking-wider text-[10px] font-semibold">
                  Mitigation:
                </span>{' '}
                {it.mitigation}
              </p>
            )}
            {it.recommendation && (
              <p className="text-xs text-sg-muted mt-1.5 leading-snug">
                <span className="uppercase tracking-wider text-[10px] font-semibold">
                  Recommendation:
                </span>{' '}
                {it.recommendation}
              </p>
            )}
            {it.rationale && (
              <p className="text-xs text-sg-muted italic mt-1.5 leading-snug">{it.rationale}</p>
            )}
            {it.value != null && (
              <p className="text-xs text-sg-muted mt-1.5">
                <span className="uppercase tracking-wider text-[10px] font-semibold">Value:</span>{' '}
                <span className="tabular-nums">
                  {it.value}
                  {it.unit ? ` ${it.unit}` : ''}
                </span>
                {it.period ? ` · ${it.period}` : ''}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VerdictRender({ data }: { data: any }) {
  const verdict = (data.verdict || '').toString().toUpperCase();
  const variant: any =
    verdict === 'STRONG' || verdict === 'PROCEED'
      ? 'severity-low'
      : verdict === 'WEAK' || verdict === 'REJECT'
      ? 'severity-high'
      : verdict === 'MARGINAL' || verdict === 'PROCEED_WITH_CONDITIONS'
      ? 'severity-medium'
      : 'default';
  return (
    <div className="space-y-2 w-full">
      {verdict && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-sg-muted">Verdict</span>
          <Pill variant={variant}>{verdict}</Pill>
        </div>
      )}
      {data.verdict_rationale && (
        <p className="text-sm leading-relaxed">{data.verdict_rationale}</p>
      )}
      {data.analysis && (
        <div className="text-sm leading-relaxed whitespace-pre-wrap mt-1">{data.analysis}</div>
      )}
      {Array.isArray(data.headline_metrics) && data.headline_metrics.length > 0 && (
        <div className="mt-2 space-y-1">
          {data.headline_metrics.slice(0, 6).map((m: any, i: number) => (
            <div key={i} className="text-xs">
              <strong className="font-semibold">{m.name}:</strong>{' '}
              <span className="tabular-nums">{m.value}</span>
              {m.interpretation ? ` — ${m.interpretation}` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PROMPT_LIBRARY = [
  'What are the main risks in this opportunity?',
  'Summarize the debt structure.',
  'What assumptions drive the IRR?',
  'Compare this to prior approved deals.',
  'What would make this deal fail?',
  'Stress test interest rates +200bps.',
  'What if occupancy drops to 75%?',
  "What are the strongest arguments to reject this investment?",
];

export function Chat({
  opportunityId,
  onCite,
}: {
  opportunityId: string;
  onCite: (c: { documentId: string; chunkId?: string; page?: number }) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [threadId, setThreadId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages]);

  async function send(text?: string) {
    const message = text ?? input.trim();
    if (!message) return;
    setInput('');
    const userMsg: Message = { id: genId(), role: 'USER', content: message };
    setMessages((m) => [...m, userMsg]);
    setBusy(true);
    try {
      const res = (await api.sendMessage({
        opportunityId,
        threadId,
        message,
      })) as any;
      setThreadId(res.threadId);
      setMessages((m) => [
        ...m,
        {
          id: res.messageId,
          role: 'ASSISTANT',
          content: res.content,
          structured: res.structured,
          citations: res.citations,
        },
      ]);
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        {
          id: genId(),
          role: 'ASSISTANT',
          content: `Error: ${err.message}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-sg-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-sg-primary" />
          <span className="text-sm font-semibold tracking-tight">Investment Copilot</span>
        </div>
        <div className="flex gap-1">
          <button className="h-7 w-7 grid place-items-center rounded hover:bg-sg-surface text-sg-muted">
            <History className="h-4 w-4" />
          </button>
          <button className="h-7 w-7 grid place-items-center rounded hover:bg-sg-surface text-sg-muted">
            <Pin className="h-4 w-4" />
          </button>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="flex-1 overflow-auto p-4">
          <div className="text-xs text-sg-muted mb-2">SUGGESTED PROMPTS</div>
          <div className="grid grid-cols-1 gap-2">
            {PROMPT_LIBRARY.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="sg-card-muted text-left text-sm p-3 hover:border-sg-primary/40 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div ref={scrollerRef} className="flex-1 overflow-auto px-4 py-4 space-y-4">
          {messages.map((m) => {
            const struct = m.role === 'ASSISTANT' ? asStructured(m.content, m.structured) : null;
            return (
            <div key={m.id} className={cn('flex flex-col', m.role === 'USER' ? 'items-end' : 'items-start')}>
              <div
                className={cn(
                  'max-w-[92%] rounded-md text-sm',
                  m.role === 'USER'
                    ? 'bg-sg-primary text-white px-3.5 py-2.5 whitespace-pre-wrap'
                    : struct
                      ? 'bg-transparent w-full'
                      : 'bg-white border border-sg-border px-3.5 py-2.5 whitespace-pre-wrap',
                )}
              >
                {struct ? <StructuredRender data={struct} /> : m.content}
              </div>
              {m.citations && m.citations.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {m.citations.slice(0, 6).map((c, i) => (
                    <button
                      key={i}
                      onClick={() => onCite(c)}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-sg-border bg-sg-surface text-sg-muted hover:text-sg-primary hover:border-sg-primary/40"
                    >
                      [{i + 1}] doc · p.{c.page ?? '—'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            );
          })}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-sg-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-sg-primary animate-pulse" />
              Thinking…
            </div>
          )}
        </div>
      )}

      <div className="border-t border-sg-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 resize-none border border-sg-border rounded p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-sg-primary min-h-[44px] max-h-32"
            placeholder="Ask about risks, financials, scenarios…"
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button size="icon" onClick={() => send()} disabled={busy}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
