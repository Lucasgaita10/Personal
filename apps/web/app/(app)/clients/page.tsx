'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Pill } from '@/components/ui/pill';
import { NewClientDialog } from '@/components/client/NewClientDialog';
import { api } from '@/lib/api';

type Client = {
  id: string;
  name: string;
  type: string;
  riskAppetite: string;
  mandateSummary: string | null;
  geographyPrefs: string[];
  sectorPrefs: string[];
  _count: { opportunities: number; positions: number };
};

export default function ClientsPage() {
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = (await api.clients()) as Client[];
      setItems(data);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <Topbar title="Clients" subtitle="Investor profiles, mandates, and existing portfolios" />
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-sg-muted">
            {loading ? 'Loading…' : `${items.length} client${items.length === 1 ? '' : 's'}`}
            {error ? ` · ${error}` : ''}
          </div>
          <NewClientDialog onCreated={load} />
        </div>
        {!loading && items.length === 0 ? (
          <div className="sg-card-muted p-8 text-center text-sm text-sg-muted-light">
            No clients yet. Create your first one to start logging opportunities.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {items.map((c) => (
              <Link key={c.id} href={`/clients/${c.id}`}>
                <div className="sg-card p-5 hover:border-sg-primary/40 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-9 w-9 rounded bg-sg-primary text-white grid place-items-center text-sm font-semibold">
                      {c.name[0]}
                    </div>
                    <div>
                      <div className="text-sm font-semibold tracking-tight">{c.name}</div>
                      <div className="text-xs text-sg-muted capitalize">
                        {c.type.replace('_', ' ')} · {c.riskAppetite.replace('_', '+')}
                      </div>
                    </div>
                  </div>
                  {c.mandateSummary ? (
                    <div className="text-sm text-sg-text line-clamp-3">{c.mandateSummary}</div>
                  ) : (
                    <div className="text-sm text-sg-muted-light">No mandate summary yet.</div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill>
                      {c._count.opportunities} opportunit
                      {c._count.opportunities === 1 ? 'y' : 'ies'}
                    </Pill>
                    <Pill>
                      {c._count.positions} position{c._count.positions === 1 ? '' : 's'}
                    </Pill>
                    {(c.geographyPrefs ?? []).slice(0, 2).map((g) => (
                      <Pill key={g}>{g}</Pill>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
