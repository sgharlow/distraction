'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { WeeklySnapshot } from '@/lib/types';

interface WeekEvent {
  id: string;
  title: string;
  primary_list: string | null;
  a_score: number | null;
  b_score: number | null;
  is_mixed: boolean;
}

export default function AdminWeekEditorPage() {
  const { weekId } = useParams<{ weekId: string }>();
  const router = useRouter();

  const [week, setWeek] = useState<WeeklySnapshot | null>(null);
  const [events, setEvents] = useState<WeekEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Editable fields
  const [weeklySummary, setWeeklySummary] = useState('');
  const [editorsPick, setEditorsPick] = useState('');

  const fetchWeek = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/weeks/${weekId}`);
    const data = await res.json();
    setWeek(data.week);
    setEvents(data.events || []);
    setWeeklySummary(data.week?.weekly_summary || '');
    setEditorsPick(data.week?.editors_pick_event_id || '');
    setLoading(false);
  }, [weekId]);

  useEffect(() => {
    fetchWeek();
  }, [fetchWeek]);

  const save = async () => {
    setSaving(true);
    setMessage('');
    const res = await fetch(`/api/admin/weeks/${weekId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weekly_summary: weeklySummary || null,
        editors_pick_event_id: editorsPick || null,
      }),
    });
    if (res.ok) {
      setMessage('Saved');
      fetchWeek();
    } else {
      const err = await res.json();
      setMessage(`Error: ${err.error}`);
    }
    setSaving(false);
  };

  const doAction = async (action: string) => {
    setMessage('');
    const res = await fetch(`/api/admin/weeks/${weekId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      setMessage(`${action} complete`);
      fetchWeek();
    } else {
      const err = await res.json();
      setMessage(`Error: ${err.error}`);
    }
  };

  if (loading) return <div className="text-text-dim py-8">Loading week...</div>;
  if (!week) return <div className="text-damage py-8">Week not found</div>;

  const listA = events.filter((e) => e.primary_list === 'A');
  const listB = events.filter((e) => e.primary_list === 'B');
  const listC = events.filter((e) => e.primary_list === 'C');

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="text-text-dim hover:text-text-secondary text-sm cursor-pointer bg-transparent border-none">
          ← Back
        </button>
        <h2 className="text-lg font-bold">Week: {weekId}</h2>
        <span className={`text-xs px-2 py-0.5 rounded ${week.status === 'frozen' ? 'bg-mixed/20 text-mixed' : 'bg-live/20 text-live'}`}>
          {week.status}
        </span>
      </div>

      {message && (
        <div className={`text-sm rounded px-3 py-2 mb-4 ${message.startsWith('Error') ? 'bg-damage/10 text-damage border border-damage/30' : 'bg-action/10 text-action border border-action/30'}`}>
          {message}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        <MiniStat label="Total" value={week.total_events} />
        <MiniStat label="List A" value={week.list_a_count} color="text-damage" />
        <MiniStat label="List B" value={week.list_b_count} color="text-distraction" />
        <MiniStat label="List C" value={week.list_c_count} color="text-noise" />
        <MiniStat label="Avg A" value={week.avg_a_score != null ? Math.round(week.avg_a_score) : 0} color="text-damage" />
        <MiniStat label="Avg B" value={week.avg_b_score != null ? Math.round(week.avg_b_score) : 0} color="text-distraction" />
      </div>

      {/* Edit section */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2">
          <label className="flex flex-col gap-1 mb-4">
            <span className="text-xs text-text-dim">Weekly Summary</span>
            <textarea
              value={weeklySummary}
              onChange={(e) => setWeeklySummary(e.target.value)}
              rows={6}
              className="w-full bg-surface-base border border-surface-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-mixed"
            />
          </label>

          <label className="flex flex-col gap-1 mb-4">
            <span className="text-xs text-text-dim">Editor&apos;s Pick Event</span>
            <select
              value={editorsPick}
              onChange={(e) => setEditorsPick(e.target.value)}
              className="w-full bg-surface-base border border-surface-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-mixed"
            >
              <option value="">None</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  [{e.primary_list}] {e.title.slice(0, 80)}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={save}
            disabled={saving}
            className="bg-mixed text-white rounded px-4 py-2 text-sm font-semibold hover:bg-mixed/90 disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-text-dim uppercase tracking-wide">Actions</h3>

          {week.status === 'live' ? (
            <button
              onClick={() => doAction('freeze')}
              className="w-full bg-mixed/20 text-mixed border border-mixed/30 rounded px-4 py-2 text-sm hover:bg-mixed/30 cursor-pointer"
            >
              Freeze Week
            </button>
          ) : (
            <button
              onClick={() => doAction('unfreeze')}
              className="w-full bg-distraction/20 text-distraction border border-distraction/30 rounded px-4 py-2 text-sm hover:bg-distraction/30 cursor-pointer"
            >
              Unfreeze Week
            </button>
          )}

          <button
            onClick={() => doAction('recompute')}
            className="w-full bg-surface-base border border-surface-border text-text-secondary rounded px-4 py-2 text-sm hover:border-mixed/30 cursor-pointer"
          >
            Recompute Stats
          </button>

          <Link
            href={`/admin/events?week_id=${weekId}`}
            className="block w-full bg-surface-base border border-surface-border text-text-secondary rounded px-4 py-2 text-sm text-center hover:border-mixed/30 no-underline"
          >
            View All Events
          </Link>

          <Link
            href={`/week/${weekId}`}
            className="block w-full bg-surface-base border border-surface-border text-text-dim rounded px-4 py-2 text-sm text-center hover:border-mixed/30 no-underline"
          >
            View Public Page
          </Link>

          {week.frozen_at && (
            <p className="text-xs text-text-dim">
              Frozen at: {new Date(week.frozen_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Event breakdown */}
      <div className="grid grid-cols-3 gap-4">
        <EventColumn title="List A — Damage" events={listA} color="text-damage" />
        <EventColumn title="List B — Distraction" events={listB} color="text-distraction" />
        <EventColumn title="List C / Noise" events={listC} color="text-noise" />
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-surface-raised border border-surface-border rounded p-3">
      <p className="text-xs text-text-dim">{label}</p>
      <p className={`text-xl font-bold ${color || 'text-text-primary'}`}>{value}</p>
    </div>
  );
}

function EventColumn({ title, events, color }: { title: string; events: { id: string; title: string; a_score: number | null; b_score: number | null; is_mixed: boolean }[]; color: string }) {
  return (
    <div>
      <h4 className={`text-xs font-semibold mb-2 ${color}`}>{title} ({events.length})</h4>
      <div className="space-y-1">
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/admin/events/${e.id}`}
            className="block bg-surface-raised border border-surface-border rounded px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:border-mixed/30 no-underline transition-colors"
          >
            <span className="line-clamp-2">{e.title}</span>
            <span className="text-text-dim mt-0.5 block">
              A:{e.a_score != null ? Math.round(e.a_score) : '—'} B:{e.b_score != null ? Math.round(e.b_score) : '—'}
              {e.is_mixed && ' MIXED'}
            </span>
          </Link>
        ))}
        {events.length === 0 && <p className="text-xs text-text-dim">None</p>}
      </div>
    </div>
  );
}
