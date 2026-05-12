import { cn } from '@/lib/cn';
import { InfoPopover } from '@/components/ui/info-popover';

export function MetricCard({
  label,
  value,
  delta,
  info,
  className,
}: {
  label: string;
  value: string | number;
  delta?: string;
  info?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('sg-card p-5', className)}>
      <div className="flex items-center gap-1.5">
        <div className="text-[10px] tracking-[0.16em] uppercase text-sg-muted">{label}</div>
        {info ? <InfoPopover>{info}</InfoPopover> : null}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {delta ? <div className="mt-1 text-xs text-sg-muted">{delta}</div> : null}
    </div>
  );
}
