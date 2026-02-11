'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface QueueEvent {
  id: string;
  week_id: string;
  title: string;
  primary_list: string | null;
  a_score: number | null;
  b_score: number | null;
  confidence: number | null;
  human_reviewed: boolean;
  is_mixed: boolean;
  score_frozen: boolean;
}

type QueueTab = 'low_confidence' | 'mixed' | 'unreviewed';

export default function AdminQueuePage() {
  const [events, setEvents] = useState<QueueEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<QueueTab>('low_confidence');
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Fetch all unreviewed + low-confidence events in one call
      const res = await fetch('/api/admin/events?human_reviewed=false&limit=200&sort_by=confidence&sort_dir=asc');
      const data = await res.json();
      setEvents(data.events || []);
      setLoading(false);
    })();
  }, []);

  const filtered = events.filter((e) => {
    if (tab === 'low_confidence') return e.confidence != null && e.confidence < 0.7;
    if (tab === 'mixed') return e.is_mixed;
    return !e.human_reviewed;
  });

  const approve = async (id: string) => {
    setActionMessage('');
    const res = await fetch('/api/admin/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_ids: [id], action: 'mark_reviewed' }),
    });
    if (res.ok) {
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, human_reviewed: true } : e)));
      setActionMessage('Approved');
    }
  };

  const rescore = async (id: string) => {
    setActionMessage('Re-scoring...');
    const res = await fetch(`/api/admin/events/${id}`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setActionMessage(`Re-scored: A=${Math.round(data.a_score)}, B=${Math.round(data.b_score)}`);
      // Re-fetch to get updated data
      const refresh = await fetch('/api/admin/events?human_reviewed=false&limit=200&sort_by=confidence&sort_dir=asc');
      const refreshData = await refresh.json();
      setEvents(refreshData.events || []);
    } else {
      const err = await res.json();
      setActionMessage(`Error: ${err.error}`);
    }
  };

  const listColor = (l: string | null) => {
    if (l === 'A') return 'text-damage';
    if (l === 'B') return 'text-distraction';
    return 'text-noise';
  };

  const tabs: { key: QueueTab; label: string }[] = [
    { key: 'low_confidence', label: 'Low Confidence' },
    { key: 'mixed', label: 'Mixed' },
    { key: 'unreviewed', label: 'All Unreviewed' },
  ];

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">Review Queue</h2>

      {actionMessage && (
        <div className={`text-sm rounded px-3 py-2 mb-4 ${actionMessage.startsWith('Error') ? 'bg-damage/10 text-damage border border-damage/30' : 'bg-action/10 text-action border border-action/30'}`}>
          {actionMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded text-sm cursor-pointer border ${
              tab === t.key
                ? 'bg-mixed/20 text-mixed border-mixed/30'
                : 'bg-surface-raised text-text-dim border-surface-border hover:text-text-secondary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-text-dim py-8">Loading queue...</div>
      ) : filtered.length === 0 ? (
        <div className="text-text-dim py-8 text-center bg-surface-raised border border-surface-border rounded-lg">
          No events in this queue. All caught up!
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => (
            <div key={e.id} className="bg-surface-raised border border-surface-border rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-bold text-sm ${listColor(e.primary_list)}`}>
                      {e.primary_list || '—'}
                    </span>
                    {e.is_mixed && (
                      <span className="text-[10px] bg-mixed/20 text-mixed px-1 rounded">MIXED</span>
                    )}
                    {e.score_frozen && (
                      <span className="text-[10px] bg-mixed/20 text-mixed px-1 rounded">FROZEN</span>
                    )}
                  </div>
                  <Link
                    href={`/admin/events/${e.id}`}
                    className="text-sm text-text-primary hover:text-mixed no-underline"
                  >
                    {e.title}
                  </Link>
                  <div className="flex gap-4 mt-2 text-xs text-text-dim">
                    <span>A: <span className="text-damage font-mono">{e.a_score != null ? Math.round(e.a_score) : '—'}</span></span>
                    <span>B: <span className="text-distraction font-mono">{e.b_score != null ? Math.round(e.b_score) : '—'}</span></span>
                    <span>Confidence: <span className={`font-mono ${e.confidence != null && e.confidence < 0.7 ? 'text-distraction' : 'text-text-muted'}`}>{e.confidence?.toFixed(2) ?? '—'}</span></span>
                    <span className="text-text-dim font-mono">{e.week_id}</span>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => approve(e.id)}
                    disabled={e.human_reviewed}
                    className="bg-action/20 text-action border border-action/30 rounded px-3 py-1 text-xs hover:bg-action/30 disabled:opacity-30 cursor-pointer"
                  >
                    Approve
                  </button>
                  <Link
                    href={`/admin/events/${e.id}`}
                    className="bg-surface-base border border-surface-border text-text-secondary rounded px-3 py-1 text-xs hover:border-mixed/30 no-underline"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => rescore(e.id)}
                    disabled={e.score_frozen}
                    className="bg-surface-base border border-surface-border text-text-secondary rounded px-3 py-1 text-xs hover:border-mixed/30 disabled:opacity-30 cursor-pointer"
                  >
                    Re-score
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
