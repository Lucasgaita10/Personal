'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export function CollapsibleSection({
  id,
  title,
  subtitle,
  badge,
  defaultOpen = false,
  children,
  className,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  /** Right-aligned summary shown next to the title (e.g. count pills, score). */
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <section id={id} className={cn('space-y-3', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-3 py-2.5 -mx-3 rounded hover:bg-sg-surface transition-colors text-left group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Chevron className="h-4 w-4 text-sg-muted group-hover:text-sg-primary flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-base font-semibold tracking-tight">{title}</div>
            {subtitle && (
              <div className="text-xs text-sg-muted truncate">{subtitle}</div>
            )}
          </div>
        </div>
        {badge && (
          <div className="flex items-center gap-2 flex-shrink-0 text-xs text-sg-muted">
            {badge}
          </div>
        )}
      </button>
      {open && <div className="pt-1">{children}</div>}
    </section>
  );
}
