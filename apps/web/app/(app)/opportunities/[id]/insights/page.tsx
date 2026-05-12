'use client';
import { useState } from 'react';
import { Chat } from '@/components/insights/Chat';
import { ContextViewer } from '@/components/insights/ContextViewer';

export default function InsightsPage({ params }: { params: { id: string } }) {
  const [citation, setCitation] = useState<{
    documentId: string;
    chunkId?: string;
    page?: number;
  } | null>(null);

  return (
    <div className="h-full flex">
      <div className="w-[42%] border-r border-sg-border flex flex-col">
        <Chat opportunityId={params.id} onCite={(c) => setCitation(c)} />
      </div>
      <div className="flex-1 min-w-0">
        <ContextViewer opportunityId={params.id} citation={citation} />
      </div>
    </div>
  );
}
