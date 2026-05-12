'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@stonegate.local');
  const [password, setPassword] = useState('changeme');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-neutral-200">
      <form onSubmit={submit} className="w-[420px] sg-card bg-white p-10 space-y-6 shadow-lg">
        <div className="flex flex-col items-center text-center space-y-3">
          <img
            src="/stone-gate-logo2.png"
            alt="Stone Gate"
            className="w-full max-w-[260px] h-auto object-contain"
          />
          <div className="text-[10px] tracking-[0.18em] uppercase text-sg-muted">
            AI-Powered Real Estate Investments Hub
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-sg-muted">Email</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-xs text-sg-muted">Password</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? <div className="text-xs text-destructive">{error}</div> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
