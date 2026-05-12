import * as React from 'react';
import { cn } from '@/lib/cn';

export function Pill({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'maroon' | 'severity-critical' | 'severity-high' | 'severity-medium' | 'severity-low' }) {
  const map: Record<string, string> = {
    default: 'sg-pill',
    maroon: 'sg-pill maroon',
    // Match the heatmap colors exactly. The `!` prefix forces the
    // utility to win over `.sg-pill`'s default background/color rules in
    // globals.css (same specificity, but globals.css loads last otherwise).
    'severity-critical': 'sg-pill !bg-red-700 !border-red-700 !text-white',
    'severity-high': 'sg-pill !bg-red-300 !border-red-300 !text-red-900',
    'severity-medium': 'sg-pill !bg-amber-200 !border-amber-200 !text-amber-900',
    'severity-low': 'sg-pill !bg-emerald-100 !border-emerald-200 !text-emerald-900',
  };
  return <span className={cn(map[variant], className)} {...props} />;
}
