'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { WeeklySnapshot } from '@/lib/types';

export default function AdminWeeksPage() {
  const [weeks, setWeeks] = useState<WeeklySnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/weeks');
      const data = await res.json();
      setWeeks(data.weeks || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-text-dim py-8">Loading weeks...</div>;

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">Weeks</h2>

      <div className="bg-surface-raised border border-surface-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-text-dim text-xs">
              <th className="px-3 py-2 text-left">Week</th>
              <th className="px-3 py-2 text-left">Date Range</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-right">Events</th>
              <th className="px-3 py-2 text-right">Avg A</th>
              <th className="px-3 py-2 text-right">Avg B</th>
              <th className="px-3 py-2 text-right">List A</th>
              <th className="px-3 py-2 text-right">List B</th>
              <th className="px-3 py-2 text-right">List C</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.id} className="border-b border-surface-border hover:bg-surface-overlay transition-colors">
                <td className="px-3 py-2">
                  <Link href={`/admin/weeks/${w.week_id}`} className="text-text-primary hover:text-mixed no-underline font-mono text-xs">
                    {w.week_id}
                  </Link>
                </td>
                <td className="px-3 py-2 text-text-secondary text-xs">
                  {formatRange(w.week_start, w.week_end)}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded ${w.status === 'frozen' ? 'bg-mixed/20 text-mixed' : 'bg-live/20 text-live'}`}>
                    {w.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono">{w.total_events}</td>
                <td className="px-3 py-2 text-right font-mono text-damage">
                  {w.avg_a_score != null ? Math.round(w.avg_a_score) : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono text-distraction">
                  {w.avg_b_score != null ? Math.round(w.avg_b_score) : '—'}
                </td>
                <td className="px-3 py-2 text-right text-damage">{w.list_a_count}</td>
                <td className="px-3 py-2 text-right text-distraction">{w.list_b_count}</td>
                <td className="px-3 py-2 text-right text-noise">{w.list_c_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatRange(start: string, end: string) {
  try {
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  } catch {
    return `${start} – ${end}`;
  }
}
