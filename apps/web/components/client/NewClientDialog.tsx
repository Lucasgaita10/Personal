'use client';
import { useState } from 'react';
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

const TYPES = [
  'family_office',
  'pension',
  'sovereign',
  'endowment',
  'insurance',
  'hnwi',
  'corporate',
  'other',
];

const RISKS = ['CORE', 'CORE_PLUS', 'VALUE_ADD', 'OPPORTUNISTIC'];

export function NewClientDialog({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    type: 'family_office',
    contactEmail: '',
    riskAppetite: 'CORE_PLUS',
    timeHorizonYears: '',
    geographyPrefs: '',
    sectorPrefs: '',
    leverageMaxLtv: '',
    internalNotes: '',
  });

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: any = {
        name: form.name.trim(),
        type: form.type,
        riskAppetite: form.riskAppetite,
      };
      if (form.contactEmail) payload.contactEmail = form.contactEmail;
      if (form.timeHorizonYears) payload.timeHorizonYears = Number(form.timeHorizonYears);
      if (form.leverageMaxLtv) payload.leverageMaxLtv = Number(form.leverageMaxLtv);
      if (form.internalNotes) payload.internalNotes = form.internalNotes;
      const geo = form.geographyPrefs.split(',').map((s) => s.trim()).filter(Boolean);
      const sec = form.sectorPrefs.split(',').map((s) => s.trim()).filter(Boolean);
      if (geo.length) payload.geographyPrefs = geo;
      if (sec.length) payload.sectorPrefs = sec;

      const created = (await api.createClient(payload)) as { id: string };
      setOpen(false);
      onCreated?.();
      router.push(`/clients/${created.id}`);
    } catch (err: any) {
      setError(err.message ?? 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> New client
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Client</DialogTitle>
          <DialogDescription>
            Capture investor identity and mandate. The AI uses this for every opportunity
            evaluated against this client.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name *">
            <Input
              autoFocus
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Aurelian Family Office"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select
                value={form.type}
                onChange={(e) => update('type', e.target.value)}
                className="flex h-9 w-full rounded border border-sg-border bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-sg-primary"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Risk appetite">
              <select
                value={form.riskAppetite}
                onChange={(e) => update('riskAppetite', e.target.value)}
                className="flex h-9 w-full rounded border border-sg-border bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-sg-primary"
              >
                {RISKS.map((r) => (
                  <option key={r} value={r}>
                    {r.replace('_', '+')}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Contact email">
            <Input
              type="email"
              value={form.contactEmail}
              onChange={(e) => update('contactEmail', e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Time horizon (yrs)">
              <Input
                inputMode="numeric"
                value={form.timeHorizonYears}
                onChange={(e) => update('timeHorizonYears', e.target.value)}
              />
            </Field>
            <Field label="Max LTV (0–1)">
              <Input
                inputMode="decimal"
                value={form.leverageMaxLtv}
                onChange={(e) => update('leverageMaxLtv', e.target.value)}
                placeholder="0.55"
              />
            </Field>
          </div>
          <Field label="Geography prefs (comma-separated)">
            <Input
              value={form.geographyPrefs}
              onChange={(e) => update('geographyPrefs', e.target.value)}
              placeholder="UK, EU-Tier1, US-Sunbelt"
            />
          </Field>
          <Field label="Sector prefs (comma-separated)">
            <Input
              value={form.sectorPrefs}
              onChange={(e) => update('sectorPrefs', e.target.value)}
              placeholder="Industrial, Multifamily, Life Sciences"
            />
          </Field>
          <Field label="Internal notes / client briefing">
            <textarea
              value={form.internalNotes}
              onChange={(e) => update('internalNotes', e.target.value)}
              rows={4}
              placeholder="Durable analyst notes about this client. Loaded into every AI run."
              className="flex w-full rounded border border-sg-border bg-white px-3 py-2 text-sm shadow-sm placeholder:text-sg-muted-light focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sg-primary resize-y min-h-[100px]"
            />
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
              {submitting ? 'Creating…' : 'Create client'}
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
