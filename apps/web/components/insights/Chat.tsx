'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Pin, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';

type Message = {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  agent?: string;
  citations?: { documentId: string; chunkId?: string; page?: number }[];
};

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
    const userMsg: Message = { id: crypto.randomUUID(), role: 'USER', content: message };
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
          citations: res.citations,
        },
      ]);
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
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
          {messages.map((m) => (
            <div key={m.id} className={cn('flex flex-col', m.role === 'USER' ? 'items-end' : 'items-start')}>
              <div
                className={cn(
                  'max-w-[88%] rounded-md px-3.5 py-2.5 text-sm whitespace-pre-wrap',
                  m.role === 'USER'
                    ? 'bg-sg-primary text-white'
                    : 'bg-white border border-sg-border',
                )}
              >
                {m.content}
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
          ))}
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
