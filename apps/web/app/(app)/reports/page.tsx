import { Topbar } from '@/components/layout/Topbar';

export default function ReportsLanding() {
  return (
    <>
      <Topbar title="Reports" subtitle="All generated memos and presentations" />
      <div className="flex-1 overflow-auto p-6">
        <div className="sg-card p-5 text-sm text-sg-muted">
          Cross-opportunity report library. Filter by type, client, and stage.
        </div>
      </div>
    </>
  );
}
