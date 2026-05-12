'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Pill } from '@/components/ui/pill';
import { Button } from '@/components/ui/button';
import { NewOpportunityDialog } from '@/components/opportunity/NewOpportunityDialog';
import { Pencil, Save, X } from 'lucide-react';
import { api } from '@/lib/api';

type Client = {
  id: string;
  name: string;
  type: string;
  riskAppetite: string;
  contactEmail: string | null;
  timeHorizonYears: number | null;
  liquidityNeedsNote: string | null;
  geographyPrefs: string[];
  sectorPrefs: string[];
  leverageMaxLtv: number | null;
  mandateSummary: string | null;
  internalNotes: string | null;
  positions: any[];
  opportunities: any[];
  decisions: any[];
};

const STAGE_LABEL: Record<string, string> = {
  NEW: 'New',
  INITIAL_SCREENING: 'Initial Screening',
  UNDER_REVIEW: 'Under Review',
  DUE_DILIGENCE: 'Due Diligence',
  IC_PREPARATION: 'IC Preparation',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CLOSED: 'Closed',
};

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const c = (await api.client(params.id)) as Client;
      setClient(c);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [params.id]);

  if (loading)
    return (
      <>
        <Topbar title="Loading…" />
        <div className="flex-1 p-6 text-sm text-sg-muted">Loading client…</div>
      </>
    );
  if (error || !client)
    return (
      <>
        <Topbar title="Client not found" subtitle={error ?? ''} />
      </>
    );

  return (
    <>
      <Topbar
        title={client.name}
        subtitle={`${client.type.replace('_', ' ')} · ${client.riskAppetite.replace('_', '+')}`}
      />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Pill variant="maroon">{client.type.replace('_', ' ')}</Pill>
          <Pill>{client.riskAppetite.replace('_', '+')}</Pill>
          {client.timeHorizonYears ? <Pill>{client.timeHorizonYears}y horizon</Pill> : null}
          {client.leverageMaxLtv != null ? (
            <Pill>Max LTV {(Number(client.leverageMaxLtv) * 100).toFixed(0)}%</Pill>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="sg-card p-5 col-span-2 space-y-3">
            <div className="text-sm font-semibold tracking-tight">Mandate</div>
            {client.mandateSummary ? (
              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                {client.mandateSummary}
              </div>
            ) : (
              <div className="text-sm text-sg-muted-light">
                No AI-generated mandate summary yet.
              </div>
            )}
            <div className="pt-2 flex flex-wrap gap-2">
              {(client.geographyPrefs ?? []).map((g) => (
                <Pill key={g}>{g}</Pill>
              ))}
              {(client.sectorPrefs ?? []).map((s) => (
                <Pill key={s}>{s}</Pill>
              ))}
            </div>
          </div>
          <ClientBriefingCard client={client} onSaved={load} />
        </div>

        <div className="sg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold tracking-tight">Active opportunities</div>
              <div className="text-xs text-sg-muted">
                Diligence pipeline currently being evaluated for this client
              </div>
            </div>
            <NewOpportunityDialog onCreated={load} prefillClientId={client.id} />
          </div>
          {client.opportunities.length === 0 ? (
            <div className="text-sm text-sg-muted-light">
              No opportunities yet for this client.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-sg-muted uppercase tracking-wider">
                <tr>
                  <th className="text-left font-medium pb-2">Opportunity</th>
                  <th className="text-left font-medium pb-2">Stage</th>
                  <th className="text-right font-medium pb-2">Risk</th>
                  <th className="text-right font-medium pb-2">IC Readiness</th>
                </tr>
              </thead>
              <tbody>
                {client.opportunities.map((o) => (
                  <tr key={o.id} className="border-t border-sg-border">
                    <td className="py-2.5">
                      <Link
                        href={`/opportunities/${o.id}/overview`}
                        className="hover:text-sg-primary"
                      >
                        {o.name}
                      </Link>
                    </td>
                    <td className="py-2.5">
                      <Pill>{STAGE_LABEL[o.stage] ?? o.stage}</Pill>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {o.riskScore != null ? Number(o.riskScore).toFixed(1) : '—'}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {o.icReadinessScore != null
                        ? Number(o.icReadinessScore).toFixed(1)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="sg-card p-5">
          <div className="text-sm font-semibold tracking-tight mb-3">Existing portfolio</div>
          {client.positions.length === 0 ? (
            <div className="text-sm text-sg-muted-light">
              No portfolio positions logged. Concentration analysis will be empty.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-sg-muted uppercase tracking-wider">
                <tr>
                  <th className="text-left font-medium pb-2">Asset</th>
                  <th className="text-left font-medium pb-2">Type</th>
                  <th className="text-left font-medium pb-2">Geography</th>
                  <th className="text-right font-medium pb-2">Equity</th>
                  <th className="text-right font-medium pb-2">LTV</th>
                </tr>
              </thead>
              <tbody>
                {client.positions.map((p) => (
                  <tr key={p.id} className="border-t border-sg-border">
                    <td className="py-2.5">{p.assetName}</td>
                    <td className="py-2.5">{p.propertyType}</td>
                    <td className="py-2.5">{p.geography}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      ${Number(p.equityInvested).toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {p.ltv != null ? `${(Number(p.ltv) * 100).toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="sg-card p-5">
          <div className="text-sm font-semibold tracking-tight mb-3">Decision history</div>
          {client.decisions.length === 0 ? (
            <div className="text-sm text-sg-muted-light">
              No prior decisions yet. Approved or rejected opportunities appear here.
            </div>
          ) : (
            <ul className="space-y-2 text-sm">
              {client.decisions.map((d) => (
                <li key={d.id} className="border-t border-sg-border pt-2">
                  <Pill
                    variant={
                      d.decision === 'PROCEED' || d.decision === 'PROCEED_WITH_CONDITIONS'
                        ? 'severity-low'
                        : d.decision === 'REJECT'
                          ? 'severity-high'
                          : 'severity-medium'
                    }
                  >
                    {d.decision}
                  </Pill>{' '}
                  <span className="ml-2 text-sg-text">{d.rationale}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function ClientBriefingCard({ client, onSaved }: { client: Client; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(client.internalNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(client.internalNotes ?? '');
  }, [client.internalNotes]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.updateClient(client.id, { internalNotes: draft.trim() });
      setEditing(false);
      onSaved();
    } catch (err: any) {
      setError(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold tracking-tight">Client briefing</div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-sg-primary hover:underline flex items-center gap-1"
          >
            <Pencil className="h-3 w-3" />
            {client.internalNotes ? 'Edit' : 'Add'}
          </button>
        ) : (
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(client.internalNotes ?? '');
                setEditing(false);
              }}
              disabled={saving}
            >
              <X className="h-3 w-3" />
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              <Save className="h-3 w-3" /> {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        )}
      </div>
      {!editing ? (
        client.internalNotes ? (
          <div className="text-xs whitespace-pre-wrap leading-relaxed">{client.internalNotes}</div>
        ) : (
          <div className="text-xs text-sg-muted-light">
            Durable analyst-written context. Loaded into every AI run for every opportunity of
            this client.
          </div>
        )
      ) : (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            className="w-full rounded border border-sg-border bg-white px-2 py-1.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sg-primary resize-y min-h-[140px]"
          />
          {error ? <div className="mt-2 text-xs text-destructive">{error}</div> : null}
        </>
      )}
    </div>
  );
}
