'use client';
import { cn } from '@/lib/cn';

export type QuadrantVariant =
  | 'positive'
  | 'negative'
  | 'caution'
  | 'forward'
  | 'neutral';

const VARIANT_STYLES: Record<
  QuadrantVariant,
  { bg: string; border: string; eyebrow: string; bullet: string }
> = {
  positive: {
    bg: 'bg-emerald-50',
    border: 'border-l-4 border-emerald-500',
    eyebrow: 'text-emerald-700',
    bullet: 'text-emerald-600',
  },
  negative: {
    bg: 'bg-red-50',
    border: 'border-l-4 border-red-500',
    eyebrow: 'text-red-700',
    bullet: 'text-red-600',
  },
  caution: {
    bg: 'bg-amber-50',
    border: 'border-l-4 border-amber-500',
    eyebrow: 'text-amber-700',
    bullet: 'text-amber-600',
  },
  forward: {
    bg: 'bg-sky-50',
    border: 'border-l-4 border-sky-500',
    eyebrow: 'text-sky-700',
    bullet: 'text-sky-600',
  },
  neutral: {
    bg: 'bg-sg-surface',
    border: 'border-l-4 border-sg-muted',
    eyebrow: 'text-sg-text',
    bullet: 'text-sg-muted',
  },
};

export function QuadrantPanel({
  variant,
  icon: Icon,
  title,
  items,
  ordered = false,
  bulletGlyph,
}: {
  variant: QuadrantVariant;
  icon?: any;
  title: string;
  items: string[];
  ordered?: boolean;
  /** Override the default bullet glyph (+ / − / → / number). */
  bulletGlyph?: string;
}) {
  const s = VARIANT_STYLES[variant];
  const defaultGlyph =
    variant === 'positive'
      ? '+'
      : variant === 'negative'
        ? '−'
        : variant === 'caution'
          ? '!'
          : variant === 'neutral'
            ? '•'
            : '→';
  const glyph = bulletGlyph ?? defaultGlyph;

  return (
    <div className={cn('rounded p-4', s.bg, s.border)}>
      <div
        className={cn(
          'text-[10px] uppercase tracking-[0.16em] mb-2.5 flex items-center gap-1.5 font-semibold',
          s.eyebrow,
        )}
      >
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {title}
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-sg-muted-light italic">None identified.</div>
      ) : ordered ? (
        <ol className="space-y-2 text-sm leading-relaxed">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2.5">
              <span
                className={cn(
                  'tabular-nums font-semibold text-xs flex-shrink-0 mt-0.5',
                  s.bullet,
                )}
              >
                {i + 1}.
              </span>
              <span className="text-sg-text">{it}</span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="space-y-2 text-sm leading-relaxed">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2.5">
              <span className={cn('font-semibold flex-shrink-0 mt-0.5', s.bullet)}>
                {glyph}
              </span>
              <span className="text-sg-text">{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
