'use client';
import { useEffect, useState } from 'react';
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
import { Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { useOpportunity } from '@/components/opportunity/OpportunityContext';

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

function toFormString(v: any): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

export function EditOpportunityDialog() {
  const { opportunity, refresh } = useOpportunity();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);

  const [form, setForm] = useState({
    clientId: '',
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

  // Hydrate form from opportunity each time the dialog opens.
  useEffect(() => {
    if (!open || !opportunity) return;
    const o = opportunity as any;
    setForm({
      clientId: o.client?.id ?? o.clientId ?? '',
      name: toFormString(o.name),
      sponsor: toFormString(o.sponsor),
      propertyType: toFormString(o.propertyType),
      city: toFormString(o.city),
      country: toFormString(o.country),
      size: toFormString(o.size),
      units: toFormString(o.units),
      unitMix: toFormString(o.unitMix),
      vintageYear: toFormString(o.vintageYear),
      askingEquity: toFormString(o.askingEquity),
      totalCapitalization: toFormString(o.totalCapitalization),
      targetIrr: toFormString(o.targetIrr),
      targetMoic: toFormString(o.targetMoic),
      holdPeriodYears: toFormString(o.holdPeriodYears),
      briefingNotes: toFormString(o.briefingNotes),
    });
    api
      .clients()
      .then((cs) => setClients(cs as ClientOption[]))
      .catch(() => setClients([]));
    setError(null);
  }, [open, opportunity?.id]);

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!opportunity) return;
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Build a payload that sends only fields that are non-empty (or were
      // explicitly cleared). For text fields we send the trimmed string or
      // null when blank to clear them.
      const payload: any = {
        name: form.name.trim(),
      };
      if (form.clientId) payload.clientId = form.clientId;

      const textFields = [
        'sponsor',
        'propertyType',
        'city',
        'country',
        'size',
        'unitMix',
        'briefingNotes',
      ] as const;
      for (const k of textFields) {
        const v = form[k];
        payload[k] = v === '' ? null : v;
      }

      const numFields = [
        'units',
        'vintageYear',
        'askingEquity',
        'totalCapitalization',
        'targetIrr',
        'targetMoic',
        'holdPeriodYears',
      ] as const;
      for (const k of numFields) {
        const v = form[k];
        if (v === '') {
          payload[k] = null;
        } else if (!Number.isNaN(Number(v))) {
          payload[k] = Number(v);
        }
      }

      await api.updateOpportunity(opportunity.id, payload);
      await refresh();
      setOpen(false);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-3.5 w-3.5" /> Edit details
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit opportunity</DialogTitle>
          <DialogDescription>
            Update any details. The AI will use the new values on the next analysis run.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Client *">
            <select
              value={form.clientId}
              onChange={(e) => update('clientId', e.target.value)}
              className="flex h-9 w-full rounded border border-sg-border bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-sg-primary"
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.type ? `· ${c.type}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Name *">
            <Input value={form.name} onChange={(e) => update('name', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sponsor">
              <Input value={form.sponsor} onChange={(e) => update('sponsor', e.target.value)} />
            </Field>
            <Field label="Property type">
              <select
                value={form.propertyType}
                onChange={(e) => update('propertyType', e.target.value)}
                className="flex h-9 w-full rounded border border-sg-border bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-sg-primary"
              >
                <option value="">—</option>
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
              <Input value={form.size} onChange={(e) => update('size', e.target.value)} />
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
              />
            </Field>
            <Field label="Vintage year">
              <Input
                inputMode="numeric"
                value={form.vintageYear}
                onChange={(e) => update('vintageYear', e.target.value)}
              />
            </Field>
            <Field label="Unit mix (free text)">
              <Input value={form.unitMix} onChange={(e) => update('unitMix', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Asking equity (USD)">
              <Input
                inputMode="numeric"
                value={form.askingEquity}
                onChange={(e) => update('askingEquity', e.target.value)}
              />
            </Field>
            <Field label="Total cap (USD)">
              <Input
                inputMode="numeric"
                value={form.totalCapitalization}
                onChange={(e) => update('totalCapitalization', e.target.value)}
              />
            </Field>
            <Field label="Hold period (yrs)">
              <Input
                inputMode="numeric"
                value={form.holdPeriodYears}
                onChange={(e) => update('holdPeriodYears', e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target IRR (%)">
              <Input
                inputMode="decimal"
                value={form.targetIrr}
                onChange={(e) => update('targetIrr', e.target.value)}
              />
            </Field>
            <Field label="Target MOIC (x)">
              <Input
                inputMode="decimal"
                value={form.targetMoic}
                onChange={(e) => update('targetMoic', e.target.value)}
              />
            </Field>
          </div>

          <Field label="Briefing notes — context for the AI (free form)">
            <textarea
              value={form.briefingNotes}
              onChange={(e) => update('briefingNotes', e.target.value)}
              rows={6}
              className="flex w-full rounded border border-sg-border bg-white px-3 py-2 text-sm shadow-sm placeholder:text-sg-muted-light focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sg-primary resize-y min-h-[120px]"
            />
          </Field>

          {error ? <div className="text-xs text-destructive">{error}</div> : null}

          <div className="flex justify-end gap-2 pt-1">
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
              {submitting ? 'Saving…' : 'Save changes'}
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
