'use client';
import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Topbar } from '@/components/layout/Topbar';
import { MetricCard } from '@/components/charts/MetricCard';
import { Pill } from '@/components/ui/pill';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

type Summary = {
  since: string;
  totals: {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    avgLatencyMs: number;
    avgCostUsd: number;
  };
  byEndpoint: Array<{
    endpoint: string;
    _count: { _all: number };
    _sum: { inputTokens: number; outputTokens: number; costUsd: number };
    _avg: { latencyMs: number };
  }>;
  byModel: Array<{
    model: string;
    _count: { _all: number };
    _sum: { inputTokens: number; outputTokens: number; costUsd: number };
  }>;
  byAgent: Array<{
    agent: string | null;
    _count: { _all: number };
    _sum: { inputTokens: number; outputTokens: number; costUsd: number };
    _avg: { latencyMs: number };
  }>;
  byStatus: Array<{ status: string; _count: { _all: number } }>;
  recent: Array<any>;
  daily: Array<{ day: string; calls: number; cost: number }>;
};

const RANGE_OPTIONS = [
  { label: '24h', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

function fmtCost(v: number) {
  if (v == null || isNaN(v)) return '$0.00';
  if (v < 0.01) return `$${v.toFixed(4)}`;
  if (v < 1) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(2)}`;
}

function fmtNumber(v: number) {
  if (v == null) return '—';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

type ClientOption = { id: string; name: string };
type OppOption = { id: string; name: string; clientId?: string | null };

export default function ObservabilityPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState<string>('');
  const [opportunityId, setOpportunityId] = useState<string>('');
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [opps, setOpps] = useState<OppOption[]>([]);

  // Load filter options once
  useEffect(() => {
    api.clients().then((c) => setClients(c as ClientOption[])).catch(() => setClients([]));
    api
      .opportunities()
      .then((o: any) => setOpps(o as OppOption[]))
      .catch(() => setOpps([]));
  }, []);

  // Opportunities filtered by selected client (if any)
  const filteredOpps = clientId
    ? opps.filter((o) => (o as any).clientId === clientId || (o as any).client?.id === clientId)
    : opps;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = (await api.telemetrySummary({
        days,
        clientId: clientId || undefined,
        opportunityId: opportunityId || undefined,
      })) as Summary;
      setSummary(data);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [days, clientId, opportunityId]);

  // If the selected opportunity doesn't belong to the chosen client, clear it
  useEffect(() => {
    if (!opportunityId || !clientId) return;
    if (!filteredOpps.find((o) => o.id === opportunityId)) {
      setOpportunityId('');
    }
  }, [clientId, opportunityId, filteredOpps]);

  return (
    <>
      <Topbar
        title="Observability"
        subtitle="Every Anthropic call is logged: latency, tokens, cost"
      />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 sg-card p-1">
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r.days}
                  onClick={() => setDays(r.days)}
                  className={`px-3 h-7 rounded text-xs ${
                    days === r.days
                      ? 'bg-sg-primary text-white'
                      : 'text-sg-muted hover:bg-sg-surface'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="h-8 rounded border border-sg-border bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-sg-primary min-w-[180px]"
            >
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={opportunityId}
              onChange={(e) => setOpportunityId(e.target.value)}
              className="h-8 rounded border border-sg-border bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-sg-primary min-w-[220px]"
            >
              <option value="">All opportunities</option>
              {filteredOpps.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>

            {(clientId || opportunityId) && (
              <button
                onClick={() => {
                  setClientId('');
                  setOpportunityId('');
                }}
                className="text-xs text-sg-muted hover:text-sg-text underline-offset-2 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        </div>

        {(clientId || opportunityId) && (
          <div className="text-xs text-sg-muted">
            Filtered to:{' '}
            {opportunityId
              ? `opportunity "${opps.find((o) => o.id === opportunityId)?.name ?? opportunityId}"`
              : `client "${clients.find((c) => c.id === clientId)?.name ?? clientId}" (${filteredOpps.length} opportunities)`}
          </div>
        )}

        {error && (
          <div className="sg-card p-3 text-xs text-destructive">{error}</div>
        )}

        {summary && (
          <>
            <div className="grid grid-cols-4 gap-4">
              <MetricCard
                label="Total cost"
                value={fmtCost(summary.totals.costUsd)}
                delta={`${summary.totals.calls} call${summary.totals.calls === 1 ? '' : 's'}`}
              />
              <MetricCard
                label="Input tokens"
                value={fmtNumber(summary.totals.inputTokens)}
                delta={`Output ${fmtNumber(summary.totals.outputTokens)}`}
              />
              <MetricCard
                label="Avg latency"
                value={`${(summary.totals.avgLatencyMs / 1000).toFixed(1)}s`}
                delta={`Avg cost ${fmtCost(summary.totals.avgCostUsd)}`}
              />
              <MetricCard
                label="Errors"
                value={
                  summary.byStatus.find((s) => s.status === 'error')?._count._all ?? 0
                }
                delta={`OK ${summary.byStatus.find((s) => s.status === 'ok')?._count._all ?? 0}`}
              />
            </div>

            <div className="sg-card p-5">
              <div className="text-sm font-semibold tracking-tight mb-1">Daily cost</div>
              <div className="text-xs text-sg-muted mb-3">USD per day</div>
              {summary.daily.length === 0 ? (
                <div className="text-xs text-sg-muted-light">No activity in this range.</div>
              ) : (
                <div className="h-44">
                  <ResponsiveContainer>
                    <AreaChart data={summary.daily}>
                      <CartesianGrid stroke="#e5e5e5" strokeDasharray="3 3" />
                      <XAxis dataKey="day" stroke="#6b6b6b" fontSize={11} />
                      <YAxis
                        stroke="#6b6b6b"
                        fontSize={11}
                        tickFormatter={(v) => fmtCost(v).replace('$', '$')}
                      />
                      <Tooltip
                        formatter={(v: number, name: string) =>
                          name === 'cost' ? fmtCost(v) : v
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="cost"
                        stroke="#780000"
                        fill="#780000"
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="sg-card p-5">
                <div className="text-sm font-semibold tracking-tight mb-3">By endpoint</div>
                <table className="w-full text-sm">
                  <thead className="text-xs text-sg-muted uppercase tracking-wider">
                    <tr>
                      <th className="text-left font-medium pb-2">Endpoint</th>
                      <th className="text-right font-medium pb-2">Calls</th>
                      <th className="text-right font-medium pb-2">Cost</th>
                      <th className="text-right font-medium pb-2">Avg ms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byEndpoint.map((r) => (
                      <tr key={r.endpoint} className="border-t border-sg-border">
                        <td className="py-2 text-sg-text">{r.endpoint}</td>
                        <td className="py-2 text-right tabular-nums">{r._count._all}</td>
                        <td className="py-2 text-right tabular-nums">
                          {fmtCost(Number(r._sum.costUsd ?? 0))}
                        </td>
                        <td className="py-2 text-right tabular-nums text-sg-muted">
                          {Number(r._avg.latencyMs ?? 0).toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="sg-card p-5">
                <div className="text-sm font-semibold tracking-tight mb-3">By model</div>
                <table className="w-full text-sm">
                  <thead className="text-xs text-sg-muted uppercase tracking-wider">
                    <tr>
                      <th className="text-left font-medium pb-2">Model</th>
                      <th className="text-right font-medium pb-2">Calls</th>
                      <th className="text-right font-medium pb-2">Tokens</th>
                      <th className="text-right font-medium pb-2">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byModel.map((r) => (
                      <tr key={r.model} className="border-t border-sg-border">
                        <td className="py-2 text-sg-text font-mono text-xs">
                          {r.model.replace('claude-', '')}
                        </td>
                        <td className="py-2 text-right tabular-nums">{r._count._all}</td>
                        <td className="py-2 text-right tabular-nums text-sg-muted">
                          {fmtNumber(
                            (r._sum.inputTokens ?? 0) + (r._sum.outputTokens ?? 0),
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {fmtCost(Number(r._sum.costUsd ?? 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="sg-card p-5">
              <div className="text-sm font-semibold tracking-tight mb-3">By agent</div>
              <div className="text-xs text-sg-muted mb-3">
                Cost & latency broken down per agent role
              </div>
              {summary.byAgent.length === 0 ||
              summary.byAgent.every((r) => !r.agent) ? (
                <div className="text-xs text-sg-muted-light">
                  Run an analysis to populate per-agent metrics.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-sg-muted uppercase tracking-wider">
                    <tr>
                      <th className="text-left font-medium pb-2">Agent</th>
                      <th className="text-right font-medium pb-2">Calls</th>
                      <th className="text-right font-medium pb-2">Tokens</th>
                      <th className="text-right font-medium pb-2">Avg latency</th>
                      <th className="text-right font-medium pb-2">Avg cost</th>
                      <th className="text-right font-medium pb-2">Total cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byAgent
                      .filter((r) => r.agent)
                      .map((r) => {
                        const calls = r._count._all || 0;
                        const total = Number(r._sum.costUsd ?? 0);
                        const avg = calls > 0 ? total / calls : 0;
                        return (
                        <tr key={r.agent} className="border-t border-sg-border">
                          <td className="py-2 text-sg-text font-mono text-xs">
                            {r.agent}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {calls}
                          </td>
                          <td className="py-2 text-right tabular-nums text-sg-muted">
                            {fmtNumber(
                              (r._sum.inputTokens ?? 0) + (r._sum.outputTokens ?? 0),
                            )}
                          </td>
                          <td className="py-2 text-right tabular-nums text-sg-muted">
                            {(Number(r._avg.latencyMs ?? 0) / 1000).toFixed(1)}s
                          </td>
                          <td className="py-2 text-right tabular-nums text-sg-muted">
                            {fmtCost(avg)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {fmtCost(total)}
                          </td>
                        </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="sg-card overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between border-b border-sg-border">
                <div>
                  <div className="text-sm font-semibold tracking-tight">Recent calls</div>
                  <div className="text-xs text-sg-muted">Most recent 25 LLM invocations</div>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-sg-surface text-xs text-sg-muted uppercase tracking-wider">
                  <tr>
                    <th className="text-left font-medium py-2 px-4">Time</th>
                    <th className="text-left font-medium py-2 px-4">Endpoint</th>
                    <th className="text-left font-medium py-2 px-4">Agent</th>
                    <th className="text-left font-medium py-2 px-4">Model</th>
                    <th className="text-right font-medium py-2 px-4">In tok</th>
                    <th className="text-right font-medium py-2 px-4">Out tok</th>
                    <th className="text-right font-medium py-2 px-4">Latency</th>
                    <th className="text-right font-medium py-2 px-4">Cost</th>
                    <th className="text-left font-medium py-2 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recent.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 px-4 text-center text-sg-muted-light">
                        No calls yet.
                      </td>
                    </tr>
                  )}
                  {summary.recent.map((c: any) => {
                    const t = new Date(c.createdAt);
                    return (
                      <tr key={c.id} className="border-t border-sg-border">
                        <td
                          className="py-2 px-4 text-xs text-sg-muted tabular-nums"
                          title={t.toLocaleString()}
                        >
                          {t.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="py-2 px-4 text-xs">{c.endpoint}</td>
                        <td className="py-2 px-4 text-xs font-mono text-sg-muted">
                          {c.agent ?? '—'}
                        </td>
                        <td className="py-2 px-4 text-xs font-mono">
                          {c.model.replace('claude-', '')}
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums">
                          {fmtNumber(c.inputTokens)}
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums">
                          {fmtNumber(c.outputTokens)}
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums text-sg-muted">
                          {(c.latencyMs / 1000).toFixed(1)}s
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums">
                          {fmtCost(Number(c.costUsd))}
                        </td>
                        <td className="py-2 px-4">
                          <Pill
                            variant={
                              c.status === 'ok'
                                ? 'severity-low'
                                : ('severity-high' as any)
                            }
                          >
                            {c.status}
                          </Pill>
                          {c.errorMessage && (
                            <div
                              className="text-[10px] text-destructive mt-0.5 max-w-md truncate"
                              title={c.errorMessage}
                            >
                              {c.errorMessage}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
