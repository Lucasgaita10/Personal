'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';

const PROPERTY_TYPES = [
  'Industrial',
  'Multifamily',
  'Office',
  'Retail',
  'Hospitality',
  'Life Sciences',
  'Data Center',
  'Self Storage',
  'Mixed-Use',
  'Other',
];

type ClientOption = { id: string; name: string; type: string };

export function NewOpportunityDialog({
  onCreated,
  prefillClientId,
}: {
  onCreated?: () => void;
  prefillClientId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);

  const [form, setForm] = useState({
    clientId: prefillClientId ?? '',
    name: '',
    sponsor: '',
    propertyType: '',
    city: '',
    country: '',
    size: '',
    units: '',
    unitMix: '',
    vintageYear: '',
    askingEquity: '',
    totalCapitalization: '',
    targetIrr: '',
    targetMoic: '',
    holdPeriodYears: '',
    briefingNotes: '',
  });

  useEffect(() => {
    if (!open) return;
    api
      .clients()
      .then((cs) => setClients(cs as ClientOption[]))
      .catch(() => setClients([]));
  }, [open]);

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientId) {
      setError('Select a client');
      return;
    }
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: any = {
        clientId: form.clientId,
        name: form.name.trim(),
        stage: 'NEW',
      };
      const optionalText = [
        'sponsor',
        'propertyType',
        'city',
        'country',
        'size',
        'unitMix',
        'briefingNotes',
      ] as const;
      for (const k of optionalText) if (form[k]) payload[k] = form[k];

      const optionalNumber = [
        'units',
        'vintageYear',
        'askingEquity',
        'totalCapitalization',
        'targetIrr',
        'targetMoic',
        'holdPeriodYears',
      ] as const;
      for (const k of optionalNumber) {
        const v = form[k];
        if (v !== '' && !Number.isNaN(Number(v))) payload[k] = Number(v);
      }

      const created = (await api.createOpportunity(payload)) as { id: string };
      setOpen(false);
      setForm({
        clientId: prefillClientId ?? '',
        name: '',
        sponsor: '',
        propertyType: '',
        city: '',
        country: '',
        size: '',
        units: '',
        unitMix: '',
        vintageYear: '',
        askingEquity: '',
        totalCapitalization: '',
        targetIrr: '',
        targetMoic: '',
        holdPeriodYears: '',
        briefingNotes: '',
      });
      onCreated?.();
      router.push(`/opportunities/${created.id}/overview`);
    } catch (err: any) {
      setError(err.message ?? 'Failed to create opportunity');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> New opportunity
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Opportunity</DialogTitle>
          <DialogDescription>
            Create a new investment opportunity. You can upload documents and run analysis after.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Client *">
            <select
              value={form.clientId}
              onChange={(e) => update('clientId', e.target.value)}
              className="flex h-9 w-full rounded border border-sg-border bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-sg-primary"
            >
              <option value="">{clients.length === 0 ? 'No clients yet — create one first' : 'Select a client…'}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.type ? `· ${c.type}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Name *">
            <Input
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Project Meridian — Madrid Logistics"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sponsor">
              <Input
                value={form.sponsor}
                onChange={(e) => update('sponsor', e.target.value)}
                placeholder="Iberian Industrial Partners"
              />
            </Field>
            <Field label="Property type">
              <select
                value={form.propertyType}
                onChange={(e) => update('propertyType', e.target.value)}
                className="flex h-9 w-full rounded border border-sg-border bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-sg-primary"
              >
                <option value="">Select…</option>
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="City">
              <Input value={form.city} onChange={(e) => update('city', e.target.value)} />
            </Field>
            <Field label="Country">
              <Input value={form.country} onChange={(e) => update('country', e.target.value)} />
            </Field>
            <Field label="Size (gross area)">
              <Input
                value={form.size}
                onChange={(e) => update('size', e.target.value)}
                placeholder={
                  form.propertyType === 'Multifamily' || form.propertyType === 'Hospitality'
                    ? '165,000 sqm GBA'
                    : '420,000 sqm'
                }
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field
              label={
                form.propertyType === 'Hospitality'
                  ? 'Keys'
                  : form.propertyType === 'Multifamily'
                    ? 'Units'
                    : 'Units / buildings'
              }
            >
              <Input
                inputMode="numeric"
                value={form.units}
                onChange={(e) => update('units', e.target.value)}
                placeholder={form.propertyType === 'Hospitality' ? '250' : '180'}
              />
            </Field>
            <Field label="Vintage year">
              <Input
                inputMode="numeric"
                value={form.vintageYear}
                onChange={(e) => update('vintageYear', e.target.value)}
                placeholder="2018"
              />
            </Field>
            <Field label="Unit mix (free text)">
              <Input
                value={form.unitMix}
                onChange={(e) => update('unitMix', e.target.value)}
                placeholder={
                  form.propertyType === 'Multifamily'
                    ? '1BR 35%, 2BR 50%, 3BR 15%'
                    : 'Mix detail (optional)'
                }
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Asking equity (USD)">
              <Input
                inputMode="numeric"
                value={form.askingEquity}
                onChange={(e) => update('askingEquity', e.target.value)}
                placeholder="180000000"
              />
            </Field>
            <Field label="Total cap (USD)">
              <Input
                inputMode="numeric"
                value={form.totalCapitalization}
                onChange={(e) => update('totalCapitalization', e.target.value)}
                placeholder="540000000"
              />
            </Field>
            <Field label="Hold period (yrs)">
              <Input
                inputMode="numeric"
                value={form.holdPeriodYears}
                onChange={(e) => update('holdPeriodYears', e.target.value)}
                placeholder="5"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target IRR (%)">
              <Input
                inputMode="decimal"
                value={form.targetIrr}
                onChange={(e) => update('targetIrr', e.target.value)}
                placeholder="14.5"
              />
            </Field>
            <Field label="Target MOIC (x)">
              <Input
                inputMode="decimal"
                value={form.targetMoic}
                onChange={(e) => update('targetMoic', e.target.value)}
                placeholder="1.9"
              />
            </Field>
          </div>

          <Field label="Briefing notes — context for the AI (free form)">
            <textarea
              value={form.briefingNotes}
              onChange={(e) => update('briefingNotes', e.target.value)}
              placeholder={
                'Client goals, preferences, deal-specific particularities, sensitivities, ' +
                'red lines, things you want the AI to weight heavily during analysis…'
              }
              rows={6}
              className="flex w-full rounded border border-sg-border bg-white px-3 py-2 text-sm shadow-sm placeholder:text-sg-muted-light focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sg-primary disabled:opacity-50 resize-y min-h-[120px]"
            />
            <div className="mt-1 text-[11px] text-sg-muted-light">
              This brief is loaded into every chat, gap analysis, risk run, and IC memo for
              this opportunity. You can edit it later from the Overview tab.
            </div>
          </Field>

          {error ? <div className="text-xs text-destructive">{error}</div> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create opportunity'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] text-sg-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
