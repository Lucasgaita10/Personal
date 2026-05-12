'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  GitBranch,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/cn';

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/opportunities', label: 'Pipeline', icon: GitBranch },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/observability', label: 'Observability', icon: Activity },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-[240px] shrink-0 bg-sg-primary text-white flex flex-col">
      <div className="px-4 pt-7 pb-5 flex flex-col items-center justify-center">
        <img
          src="/stone-gate-logo.png"
          alt="Stone Gate"
          className="w-full max-w-[215px] h-auto object-contain"
          style={{ mixBlendMode: 'screen' }}
        />
        <div className="mt-2 text-[9px] tracking-[0.18em] uppercase text-white/65 text-center leading-snug">
          AI-Powered Real Estate
          <br />
          Investments Hub
        </div>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {items.map((it) => {
          const active = pathname?.startsWith(it.href);
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                'flex items-center gap-3 h-9 px-3 rounded text-sm transition-colors',
                active
                  ? 'bg-white text-sg-primary font-medium'
                  : 'text-white/85 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-white/10 text-[11px] text-white/55">
        v0.1.0 · Local
      </div>
    </aside>
  );
}
