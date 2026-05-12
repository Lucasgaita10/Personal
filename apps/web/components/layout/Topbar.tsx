'use client';
import { Search, Bell } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="h-14 border-b border-sg-border bg-white flex items-center px-6 gap-6">
      <div className="flex-1">
        <div className="text-sm font-semibold tracking-tight">{title}</div>
        {subtitle ? <div className="text-xs text-sg-muted">{subtitle}</div> : null}
      </div>
      <div className="relative w-80">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-sg-muted" />
        <Input className="pl-8 h-8 text-sm" placeholder="Search opportunities, clients, documents…" />
      </div>
      <button className="h-8 w-8 grid place-items-center rounded hover:bg-sg-surface text-sg-muted">
        <Bell className="h-4 w-4" />
      </button>
      <div className="h-7 w-7 rounded-full bg-sg-primary text-white text-[11px] font-semibold grid place-items-center">
        SG
      </div>
    </header>
  );
}
