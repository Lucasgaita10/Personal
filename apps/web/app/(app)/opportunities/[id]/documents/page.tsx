'use client';
import { useEffect, useRef, useState } from 'react';
import { Upload, Sparkles, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { useOpportunity } from '@/components/opportunity/OpportunityContext';
import { api } from '@/lib/api';

const DOC_CLASSES = [
  'INVESTMENT_MEMO',
  'PITCH_DECK',
  'FINANCIAL_STATEMENT',
  'RENT_ROLL',
  'LEGAL_AGREEMENT',
  'DUE_DILIGENCE_REPORT',
  'MARKET_STUDY',
  'APPRAISAL',
  'CONSTRUCTION_BUDGET',
  'LOAN_AGREEMENT',
  'PHOTO',
  'EMAIL',
  'OTHER',
];
const CLASS_LABEL: Record<string, string> = {
  INVESTMENT_MEMO: 'Investment Memo',
  PITCH_DECK: 'Pitch Deck',
  FINANCIAL_STATEMENT: 'Financials',
  RENT_ROLL: 'Rent Roll',
  LEGAL_AGREEMENT: 'Legal Agreement',
  DUE_DILIGENCE_REPORT: 'DD Report',
  MARKET_STUDY: 'Market Study',
  APPRAISAL: 'Appraisal',
  CONSTRUCTION_BUDGET: 'Construction Budget',
  LOAN_AGREEMENT: 'Loan Agreement',
  PHOTO: 'Photo',
  EMAIL: 'Email',
  OTHER: 'Other',
};

const STATUS_VARIANT: Record<string, any> = {
  COMPLETE: 'severity-low',
  PROCESSING: 'severity-medium',
  PENDING: 'severity-medium',
  FAILED: 'severity-high',
};

export default function DocumentsPage({ params }: { params: { id: string } }) {
  const { opportunity, loading, refresh } = useOpportunity();
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      await api.uploadDocs(params.id, files);
      await refresh();
    } catch (err: any) {
      setError(err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const docs = (opportunity?.documents ?? []) as any[];
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [classifySummary, setClassifySummary] = useState<string | null>(null);

  async function updateClass(id: string, documentClass: string) {
    try {
      await api.updateDocClass(id, documentClass);
      await refresh();
    } catch (err: any) {
      alert(err.message ?? 'Update failed');
    }
  }

  async function deleteDoc(id: string, filename: string) {
    if (
      !confirm(
        `Delete "${filename}"? This removes the file, its chunks, and its embeddings. Cannot be undone.`,
      )
    )
      return;
    setDeletingId(id);
    try {
      await api.deleteDoc(id);
      await refresh();
    } catch (err: any) {
      alert(err.message ?? 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  async function retryFailed() {
    if (!opportunity) return;
    setClassifying(true);
    setClassifySummary(null);
    try {
      const res = (await api.retryFailedDocs(opportunity.id)) as {
        total: number;
        started: number;
      };
      setClassifySummary(
        `Retrying ${res.started} of ${res.total} document${res.total === 1 ? '' : 's'}…`,
      );
      // Poll a few times so the UI reflects new status as the pipeline runs
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        await refresh();
      }
    } catch (err: any) {
      setClassifySummary(`Failed: ${err.message ?? 'unknown error'}`);
    } finally {
      setClassifying(false);
    }
  }

  async function classifyAll() {
    if (!opportunity) return;
    setClassifying(true);
    setClassifySummary(null);
    try {
      const res = (await api.classifyAllDocs(opportunity.id)) as {
        total: number;
        results: Array<
          | { ok: true; documentClass: string; previous: string; filename: string }
          | { ok: false; filename: string; error: string }
        >;
      };
      const changed = res.results.filter(
        (r): r is Extract<typeof r, { ok: true }> =>
          r.ok && r.documentClass !== r.previous,
      );
      const failed = res.results.filter((r) => !r.ok).length;
      setClassifySummary(
        `${res.total} document${res.total === 1 ? '' : 's'} classified · ` +
          `${changed.length} re-classified` +
          (failed ? ` · ${failed} failed` : ''),
      );
      await refresh();
    } catch (err: any) {
      setClassifySummary(`Failed: ${err.message ?? 'unknown error'}`);
    } finally {
      setClassifying(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          onFiles(e.dataTransfer.files);
        }}
        className={`sg-card-muted border-2 border-dashed transition-colors p-8 text-center ${
          drag ? 'border-sg-primary bg-sg-primary-soft' : 'border-sg-border'
        }`}
      >
        <Upload className="h-6 w-6 mx-auto text-sg-muted mb-2" />
        <div className="text-sm font-medium">Drop files or folders to ingest</div>
        <div className="text-xs text-sg-muted mt-1">
          PDF · Excel · Word · Email · Images · ZIP. The AI will classify, extract metrics, and
          index.
        </div>
        <div className="mt-4">
          <input
            id="file"
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <label htmlFor="file">
            <Button asChild variant="outline" size="sm">
              <span>Select files</span>
            </Button>
          </label>
        </div>
        {uploading && <div className="text-xs text-sg-muted mt-3">Uploading…</div>}
        {error && <div className="text-xs text-destructive mt-3">{error}</div>}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-sg-muted">
          {loading ? 'Loading…' : `${docs.length} document${docs.length === 1 ? '' : 's'}`}
          {classifySummary ? (
            <span className="ml-2 text-sg-text">· {classifySummary}</span>
          ) : null}
        </div>
        <div className="flex gap-2">
          {docs.some((d) => d.status === 'FAILED' || d.status === 'PENDING') && (
            <Button
              size="sm"
              variant="outline"
              onClick={retryFailed}
              disabled={classifying}
              title="Re-run ingestion for documents that failed or are still pending"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {classifying ? 'Retrying…' : 'Retry failed'}
            </Button>
          )}
          <Button
            size="sm"
            onClick={classifyAll}
            disabled={classifying || docs.length === 0}
            title={
              docs.length === 0
                ? 'Upload at least one document first'
                : 'Re-run AI classification on every document in this opportunity'
            }
          >
            <Sparkles className="h-3.5 w-3.5" />
            {classifying ? 'Classifying…' : 'AI Classification'}
          </Button>
        </div>
      </div>

      {docs.length === 0 ? (
        <div className="sg-card-muted p-6 text-sm text-sg-muted-light text-center">
          No documents yet. Drop the data room above to get started.
        </div>
      ) : (
        <div className="sg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sg-surface text-xs text-sg-muted uppercase tracking-wider">
              <tr>
                <th className="text-left font-medium py-2 px-4">Document</th>
                <th className="text-left font-medium py-2 px-4">Class</th>
                <th className="text-left font-medium py-2 px-4">Status</th>
                <th className="text-right font-medium py-2 px-4">Pages</th>
                <th className="text-right font-medium py-2 px-4">Size</th>
                <th className="text-right font-medium py-2 px-4 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-t border-sg-border group">
                  <td className="py-2.5 px-4">{d.filename}</td>
                  <td className="py-2.5 px-4">
                    <ClassCell
                      doc={d}
                      onChange={updateClass}
                    />
                  </td>
                  <td className="py-2.5 px-4">
                    <Pill variant={STATUS_VARIANT[d.status] ?? 'default'}>{d.status}</Pill>
                    {d.failureReason && (
                      <div className="text-[11px] text-destructive mt-1">
                        {d.failureReason}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-sg-muted">
                    {d.pageCount ?? '—'}
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-sg-muted">
                    {(d.sizeBytes / 1024).toFixed(0)} KB
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => deleteDoc(d.id, d.filename)}
                      disabled={deletingId === d.id}
                      className="h-7 w-7 grid place-items-center rounded text-sg-muted hover:bg-red-50 hover:text-destructive disabled:opacity-40"
                      title="Delete document"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ClassCell({
  doc,
  onChange,
}: {
  doc: any;
  onChange: (id: string, cls: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (editing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [editing]);

  async function save(value: string) {
    if (value === doc.documentClass) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onChange(doc.id, value);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <select
        ref={selectRef}
        defaultValue={doc.documentClass}
        disabled={saving}
        onChange={(e) => save(e.target.value)}
        onBlur={() => setEditing(false)}
        className="h-7 rounded border border-sg-primary bg-white px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-sg-primary"
      >
        {DOC_CLASSES.map((c) => (
          <option key={c} value={c}>
            {CLASS_LABEL[c] ?? c}
          </option>
        ))}
      </select>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-sm text-sg-text hover:text-sg-primary cursor-pointer hover:underline underline-offset-2 decoration-dotted"
      title={
        doc.classConfidence != null
          ? `AI confidence: ${(Number(doc.classConfidence) * 100).toFixed(0)}% — click to change`
          : 'Click to change'
      }
    >
      {CLASS_LABEL[doc.documentClass] ?? doc.documentClass}
    </button>
  );
}
