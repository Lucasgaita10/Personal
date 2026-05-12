'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '@/lib/api';

const TEMPLATES = [
  { name: 'Base case', inputs: {} },
  { name: 'Vacancy −15pp', inputs: { vacancy: 0.15 } },
  { name: 'Rate +200bps', inputs: { rateShockBps: 200 } },
  { name: 'Exit cap +150bps', inputs: { exitCapBps: 150 } },
  { name: 'Refinance unavailable', inputs: { refinanceAvailable: false } },
  { name: 'Recession (combined)', inputs: { vacancy: 0.1, rateShockBps: 200, exitCapBps: 100, rentGrowthDelta: -0.02 } },
];

export function ScenarioPanel({ opportunityId }: { opportunityId: string }) {
  const [vacancy, setVacancy] = useState('0');
  const [rateShock, setRateShock] = useState('0');
  const [exitCap, setExitCap] = useState('0');
  const [result, setResult] = useState<any | null>(null);
  const [running, setRunning] = useState(false);

  async function run(inputs: Record<string, number | boolean>) {
    setRunning(true);
    try {
      const res = (await api.runScenario({ opportunityId, inputs })) as any;
      setResult(res);
    } finally {
      setRunning(false);
    }
  }

  const cf = result?.run?.cashflow ?? [];

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-sg-muted mb-2">SCENARIO TEMPLATES</div>
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.name}
              onClick={() => run(t.inputs as any)}
              className="sg-card-muted text-left text-sm p-2.5 hover:border-sg-primary/40"
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="sg-card p-4 space-y-3">
        <div className="text-xs text-sg-muted">CUSTOM SCENARIO</div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[11px] text-sg-muted">Vacancy +%</label>
            <Input value={vacancy} onChange={(e) => setVacancy(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] text-sg-muted">Rate shock (bps)</label>
            <Input value={rateShock} onChange={(e) => setRateShock(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] text-sg-muted">Exit cap (bps)</label>
            <Input value={exitCap} onChange={(e) => setExitCap(e.target.value)} />
          </div>
        </div>
        <Button
          onClick={() =>
            run({
              vacancy: Number(vacancy) / 100,
              rateShockBps: Number(rateShock),
              exitCapBps: Number(exitCap),
            })
          }
          disabled={running}
          size="sm"
        >
          {running ? 'Running…' : 'Run scenario'}
        </Button>
      </div>

      {result && (
        <div className="sg-card p-4">
          <div className="grid grid-cols-4 gap-4 mb-3">
            <Stat label="IRR" value={`${(result.run.outputs.irr * 100).toFixed(1)}%`} />
            <Stat label="MOIC" value={`${result.run.outputs.moic.toFixed(2)}x`} />
            <Stat label="DSCR (min)" value={result.run.outputs.dscrMin?.toFixed(2)} />
            <Stat label="C-on-C" value={`${(result.run.outputs.cashOnCash * 100).toFixed(1)}%`} />
          </div>
          <div className="h-44">
            <ResponsiveContainer>
              <LineChart data={cf}>
                <CartesianGrid stroke="#e5e5e5" strokeDasharray="3 3" />
                <XAxis dataKey="year" stroke="#6b6b6b" fontSize={11} />
                <YAxis stroke="#6b6b6b" fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#780000" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {result.run.outputs.notes?.length > 0 && (
            <ul className="mt-3 text-xs text-sg-muted space-y-1">
              {result.run.outputs.notes.map((n: string) => (
                <li key={n}>• {n}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-sg-muted">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value ?? '—'}</div>
    </div>
  );
}
