'use client';
import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Tiny "?" icon button that opens a popover with explanatory copy. */
export function InfoPopover({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-4 w-4 items-center justify-center rounded-full text-sg-muted hover:text-sg-primary focus:outline-none focus:ring-1 focus:ring-sg-primary',
            className,
          )}
          aria-label="More info"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="top"
          align="start"
          sideOffset={6}
          className="z-50 w-80 sg-card p-3 text-xs leading-relaxed text-sg-text shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {children}
          <PopoverPrimitive.Arrow className="fill-white stroke-sg-border" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
