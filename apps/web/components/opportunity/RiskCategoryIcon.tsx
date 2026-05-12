import {
  Users,
  TrendingUp,
  LineChart,
  Target,
  Scale,
  HardHat,
  Home,
  Repeat,
  ShieldAlert,
  Leaf,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  SPONSOR: Users,
  LEVERAGE: TrendingUp,
  MARKET: LineChart,
  CONCENTRATION: Target,
  LEGAL: Scale,
  CONSTRUCTION: HardHat,
  TENANT: Home,
  REFINANCE: Repeat,
  REGULATORY: ShieldAlert,
  ESG: Leaf,
  OTHER: AlertCircle,
};

export function RiskCategoryIcon({
  category,
  className = 'h-4 w-4 text-sg-muted',
}: {
  category: string;
  className?: string;
}) {
  const Icon = ICONS[String(category).toUpperCase()] ?? AlertCircle;
  return <Icon className={className} aria-hidden />;
}
