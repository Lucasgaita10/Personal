'use client';
import { useState } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SettingsPage() {
  const [key, setKey] = useState('');
  return (
    <>
      <Topbar title="Settings" subtitle="API keys, users, and audit log" />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="sg-card p-5">
          <div className="text-sm font-semibold tracking-tight mb-3">Anthropic API key</div>
          <div className="text-xs text-sg-muted mb-3">
            Encrypted at rest with AES-256-GCM. Used for Claude Opus, Sonnet, and Haiku.
          </div>
          <div className="flex gap-2">
            <Input type="password" placeholder="sk-ant-..." value={key} onChange={(e) => setKey(e.target.value)} />
            <Button>Save</Button>
          </div>
        </div>
        <div className="sg-card p-5">
          <div className="text-sm font-semibold tracking-tight mb-3">Embedding provider</div>
          <div className="text-xs text-sg-muted">
            Voyage (recommended) or local fallback. Configure in <code>.env</code>.
          </div>
        </div>
      </div>
    </>
  );
}
