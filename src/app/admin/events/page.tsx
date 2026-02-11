'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface EventRow {
  id: string;
  week_id: string;
  title: string;
  event_date: string;
  primary_list: string | null;
  is_mixed: boolean;
  a_score: number | null;
  b_score: number | null;
  confidence: number | null;
  human_reviewed: boolean;
  score_frozen: boolean;
  noise_flag: boolean;
  article_count: number;
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filters
  const [weekId, setWeekId] = useState('');
  const [list, setList] = useState('');
  const [reviewedFilter, setReviewedFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (weekId) params.set('week_id', weekId);
    if (list) params.set('primary_list', list);
    if (reviewedFilter) params.set('human_reviewed', reviewedFilter);
    params.set('sort_by', sortBy);
    params.set('sort_dir', sortDir);
    params.set('limit', '100');

    const res = await fetch(`/api/admin/events?${params}`);
    const data = await res.json();
    setEvents(data.events || []);
    setSelected(new Set());
    setLoading(false);
  }, [weekId, list, reviewedFilter, sortBy, sortDir]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === events.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(events.map((e) => e.id)));
    }
  };

  const bulkMarkReviewed = async () => {
    if (selected.size === 0) return;
    await fetch('/api/admin/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_ids: [...selected], action: 'mark_reviewed' }),
    });
    fetchEvents();
  };

  const listColor = (l: string | null) => {
    if (l === 'A') return 'text-damage';
    if (l === 'B') return 'text-distraction';
    return 'text-noise';
  };

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">Events</h2>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Week ID (YYYY-MM-DD)"
          value={weekId}
          onChange={(e) => setWeekId(e.target.value)}
          className="bg-surface-base border border-surface-border rounded px-3 py-1.5 text-sm text-text-primary w-44"
        />
        <select
          value={list}
          onChange={(e) => setList(e.target.value)}
          className="bg-surface-base border border-surface-border rounded px-3 py-1.5 text-sm text-text-primary"
        >
          <option value="">All Lists</option>
          <option value="A">List A</option>
          <option value="B">List B</option>
          <option value="C">List C</option>
        </select>
        <select
          value={reviewedFilter}
          onChange={(e) => setReviewedFilter(e.target.value)}
          className="bg-surface-base border border-surface-border rounded px-3 py-1.5 text-sm text-text-primary"
        >
          <option value="">All Review Status</option>
          <option value="true">Reviewed</option>
          <option value="false">Unreviewed</option>
        </select>
        <button
          onClick={fetchEvents}
          className="bg-mixed text-white rounded px-3 py-1.5 text-sm cursor-pointer hover:bg-mixed/90"
        >
          Refresh
        </button>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex gap-2 mb-3 items-center">
          <span className="text-sm text-text-secondary">{selected.size} selected</span>
          <button
            onClick={bulkMarkReviewed}
            className="bg-action text-white rounded px-3 py-1 text-xs cursor-pointer hover:bg-action/90"
          >
            Mark Reviewed
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface-raised border border-surface-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-text-dim text-xs">
              <th className="px-3 py-2 text-left w-8">
                <input type="checkbox" checked={selected.size === events.length && events.length > 0} onChange={toggleAll} />
              </th>
              <th className="px-3 py-2 text-left cursor-pointer hover:text-text-secondary" onClick={() => handleSort('title')}>
                Title {sortBy === 'title' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="px-3 py-2 text-left w-16">List</th>
              <th className="px-3 py-2 text-right w-16 cursor-pointer hover:text-text-secondary" onClick={() => handleSort('a_score')}>
                A {sortBy === 'a_score' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="px-3 py-2 text-right w-16 cursor-pointer hover:text-text-secondary" onClick={() => handleSort('b_score')}>
                B {sortBy === 'b_score' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="px-3 py-2 text-right w-16 cursor-pointer hover:text-text-secondary" onClick={() => handleSort('confidence')}>
                Conf {sortBy === 'confidence' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="px-3 py-2 text-center w-20">Status</th>
              <th className="px-3 py-2 text-left w-28">Week</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-text-dim">Loading...</td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-text-dim">No events found</td>
              </tr>
            ) : (
              events.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-surface-border hover:bg-surface-overlay transition-colors"
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(e.id)}
                      onChange={() => toggleSelect(e.id)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/events/${e.id}`}
                      className="text-text-primary hover:text-mixed no-underline"
                    >
                      {e.title.length > 80 ? e.title.slice(0, 80) + '...' : e.title}
                    </Link>
                    {e.is_mixed && (
                      <span className="ml-1.5 text-[10px] bg-mixed/20 text-mixed px-1 rounded">MIXED</span>
                    )}
                    {e.noise_flag && (
                      <span className="ml-1.5 text-[10px] bg-noise/20 text-noise px-1 rounded">NOISE</span>
                    )}
                  </td>
                  <td className={`px-3 py-2 font-bold ${listColor(e.primary_list)}`}>
                    {e.primary_list || '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-damage">
                    {e.a_score != null ? Math.round(e.a_score) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-distraction">
                    {e.b_score != null ? Math.round(e.b_score) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    <span className={e.confidence != null && e.confidence < 0.7 ? 'text-distraction' : 'text-text-muted'}>
                      {e.confidence != null ? e.confidence.toFixed(2) : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {e.score_frozen && (
                      <span className="text-[10px] bg-mixed/20 text-mixed px-1.5 py-0.5 rounded">frozen</span>
                    )}
                    {e.human_reviewed && (
                      <span className="text-[10px] bg-action/20 text-action px-1.5 py-0.5 rounded ml-1">reviewed</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-dim text-xs font-mono">{e.week_id}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
