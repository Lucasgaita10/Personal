'use client';
import { TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react';

/**
 * Extracts the TAILWIND / NEUTRAL / HEADWIND verdict from the market
 * researcher's prose. The agent is prompted to end with a one-liner like:
 *   "VERDICT: TAILWIND — strong submarket fundamentals..."
 * but in practice the verdict word may appear anywhere on the last line.
 */
function extractVerdict(text: string): {
  verdict: 'TAILWIND' | 'NEUTRAL' | 'HEADWIND' | null;
  rationale: string | null;
} {
  const lines = text.trim().split(/\n+/).filter(Boolean);
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 3); i--) {
    const line = lines[i];
    const m = line.match(/\b(TAILWIND|NEUTRAL|HEADWIND)\b/);
    if (m) {
      // Strip leading "VERDICT:" / "Verdict —" / "MARKET VERDICT:" labels
      const rationale = line
        .replace(/^[A-Z\s]*VERDICT\s*[:\-—–]\s*/i, '')
        .replace(new RegExp(`^${m[1]}\\s*[:\\-—–]?\\s*`, 'i'), '')
        .trim();
      return {
        verdict: m[1] as 'TAILWIND' | 'NEUTRAL' | 'HEADWIND',
        rationale: rationale && rationale !== m[1] ? rationale : null,
      };
    }
  }
  return { verdict: null, rationale: null };
}

function VerdictPill({
  verdict,
}: {
  verdict: 'TAILWIND' | 'NEUTRAL' | 'HEADWIND' | null;
}) {
  if (!verdict) return null;
  const map = {
    TAILWIND: {
      Icon: TrendingUp,
      cls: 'bg-emerald-600 text-white border-emerald-600',
    },
    NEUTRAL: {
      Icon: Minus,
      cls: 'bg-sg-surface text-sg-text border-sg-border',
    },
    HEADWIND: {
      Icon: TrendingDown,
      cls: 'bg-red-600 text-white border-red-600',
    },
  } as const;
  const { Icon, cls } = map[verdict];
  return (
    <span
      className={
        'inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-medium border ' +
        cls
      }
    >
      <Icon className="h-3.5 w-3.5" />
      {verdict}
    </span>
  );
}

/** Render inline markdown: **bold**, *italic*, [text](url), and bare URLs. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  // One alternation covers all four patterns; capture groups identify which one matched.
  const re =
    /(\*\*([^*]+?)\*\*)|(\*([^*\s][^*]*?)\*)|(\[([^\]]+)\]\((https?:\/\/[^)]+)\))|(\bhttps?:\/\/[^\s)>\]]+)/g;
  const out: React.ReactNode[] = [];
  let cursor = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > cursor) out.push(text.slice(cursor, m.index));
    if (m[1]) {
      out.push(
        <strong key={`${keyPrefix}-b-${i++}`} className="font-semibold text-sg-text">
          {m[2]}
        </strong>,
      );
    } else if (m[3]) {
      out.push(<em key={`${keyPrefix}-i-${i++}`}>{m[4]}</em>);
    } else if (m[5]) {
      out.push(
        <a
          key={`${keyPrefix}-ml-${i++}`}
          href={m[7]}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-sg-primary underline-offset-2 hover:underline"
        >
          {m[6]}
          <ExternalLink className="h-3 w-3" />
        </a>,
      );
    } else if (m[8]) {
      const url = m[8];
      out.push(
        <a
          key={`${keyPrefix}-l-${i++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-sg-primary underline-offset-2 hover:underline"
        >
          {url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          <ExternalLink className="h-3 w-3" />
        </a>,
      );
    }
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

/** Render a single block (paragraph or heading), handling markdown headings + inline. */
function renderBlock(block: string, key: number): React.ReactNode {
  const trimmed = block.trim();
  if (trimmed.startsWith('### ')) {
    return (
      <h4
        key={key}
        className="text-sm font-semibold text-sg-text mt-2 first:mt-0"
      >
        {renderInline(trimmed.slice(4), `h4-${key}`)}
      </h4>
    );
  }
  if (trimmed.startsWith('## ')) {
    return (
      <h3
        key={key}
        className="text-base font-semibold tracking-tight text-sg-text mt-3 first:mt-0"
      >
        {renderInline(trimmed.slice(3), `h3-${key}`)}
      </h3>
    );
  }
  if (trimmed.startsWith('# ')) {
    return (
      <h2
        key={key}
        className="text-lg font-semibold tracking-tight text-sg-text mt-3 first:mt-0"
      >
        {renderInline(trimmed.slice(2), `h2-${key}`)}
      </h2>
    );
  }
  return (
    <p key={key} className="text-sm text-sg-text leading-relaxed">
      {renderInline(trimmed, `p-${key}`)}
    </p>
  );
}

/** Strip the AI's "I'll research…" / "Let me now compose…" preamble.
 *  Everything before the first markdown heading is meta-narration we don't want. */
function stripPreamble(text: string): string {
  const m = text.search(/(^|\n)#{1,3}\s+/);
  return m > 0 ? text.slice(m).replace(/^\n+/, '') : text;
}

/** Split into sections at each `## Heading`. The first chunk before any H2 is
 *  treated as a "headline" / opening block. */
function splitSections(
  text: string,
): { headline: string | null; sections: Array<{ title: string; body: string }> } {
  // Drop a top-level `# Title` line if present (we render it as the section's own title).
  const cleaned = text.replace(/^#\s+[^\n]*\n+/, '');
  const parts = cleaned.split(/\n(?=##\s+)/);
  if (parts.length === 0) return { headline: null, sections: [] };

  let headline: string | null = null;
  const sections: Array<{ title: string; body: string }> = [];
  for (const p of parts) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^##\s+(.+?)\n([\s\S]*)$/);
    if (m) {
      sections.push({ title: m[1].trim(), body: m[2].trim() });
    } else if (!headline) {
      headline = trimmed;
    } else {
      // Stray prose between sections — append to the prior section.
      if (sections.length > 0) {
        sections[sections.length - 1].body += '\n\n' + trimmed;
      } else {
        headline = (headline || '') + '\n\n' + trimmed;
      }
    }
  }
  return { headline, sections };
}

export function MarketResearchSection({ research }: { research: string }) {
  const cleaned = stripPreamble(research);
  const { verdict, rationale } = extractVerdict(cleaned);

  // Strip the trailing verdict line from the prose so it isn't shown twice.
  let prose = cleaned;
  if (verdict) {
    const lines = cleaned.trim().split(/\n+/);
    let cut = -1;
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 3); i--) {
      if (/\b(TAILWIND|NEUTRAL|HEADWIND)\b/.test(lines[i])) {
        cut = i;
        break;
      }
    }
    if (cut >= 0) prose = lines.slice(0, cut).join('\n\n');
  }

  const { headline, sections } = splitSections(prose);

  const headlineParagraphs = (headline || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3">
      {/* Verdict + one-line rationale */}
      {(verdict || rationale) && (
        <div className="sg-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[11px] uppercase tracking-wider text-sg-muted">
              Market verdict
            </span>
            <VerdictPill verdict={verdict} />
          </div>
          {rationale && (
            <p className="text-sm text-sg-text leading-relaxed">{rationale}</p>
          )}
        </div>
      )}

      {/* Headline conclusion / TL;DR */}
      {headlineParagraphs.length > 0 && (
        <div className="sg-card p-5 border-l-4 border-l-sg-primary">
          <div className="text-[11px] uppercase tracking-wider text-sg-muted mb-2">
            Headline conclusion
          </div>
          <div className="space-y-3">
            {headlineParagraphs.map((p, i) => renderBlock(p, i))}
          </div>
        </div>
      )}

      {/* One card per section */}
      {sections.map((s, i) => {
        const paragraphs = s.body
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean);
        return (
          <div key={`${s.title}-${i}`} className="sg-card p-5">
            <h3 className="text-base font-semibold tracking-tight text-sg-text mb-3">
              {renderInline(s.title, `t-${i}`)}
            </h3>
            <div className="space-y-3">
              {paragraphs.map((p, j) => renderBlock(p, j))}
            </div>
          </div>
        );
      })}

      {/* Fallback when we couldn't structure it */}
      {sections.length === 0 && headlineParagraphs.length === 0 && (
        <div className="sg-card p-5 text-xs text-sg-muted italic">
          No market research narrative.
        </div>
      )}
    </div>
  );
}
