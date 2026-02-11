'use client';

import { useState, useEffect, useRef } from 'react';
import type { PipelineRun } from '@/lib/types';

export default function AdminPipelinePage() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState('');
  const [triggering, setTriggering] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRuns = async () => {
    const res = await fetch('/api/admin/pipeline?limit=50');
    const data = await res.json();
    setRuns(data.runs || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchRuns, 30000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh]);

  const triggerIngest = async () => {
    setTriggering(true);
    setTriggerMessage('');
    const res = await fetch('/api/admin/pipeline/trigger', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.success) {
      setTriggerMessage('Ingest triggered successfully');
      fetchRuns();
    } else {
      setTriggerMessage(`Error: ${data.error || 'Unknown error'}`);
    }
    setTriggering(false);
  };

  const statusColor = (status: string) => {
    if (status === 'completed') return 'bg-action/20 text-action';
    if (status === 'failed') return 'bg-damage/20 text-damage';
    return 'bg-distraction/20 text-distraction';
  };

  const typeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ingest: 'Ingest',
      score: 'Score',
      freeze: 'Freeze',
      backfill: 'Backfill',
    };
    return labels[type] || type;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Pipeline Monitor</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={fetchRuns}
            className="bg-surface-raised border border-surface-border rounded px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary cursor-pointer"
          >
            Refresh
          </button>
        </div>
      </div>

      {triggerMessage && (
        <div className={`text-sm rounded px-3 py-2 mb-4 ${triggerMessage.startsWith('Error') ? 'bg-damage/10 text-damage border border-damage/30' : 'bg-action/10 text-action border border-action/30'}`}>
          {triggerMessage}
        </div>
      )}

      <button
        onClick={triggerIngest}
        disabled={triggering}
        className="bg-action text-white rounded px-4 py-2 text-sm font-semibold hover:bg-action/90 disabled:opacity-50 cursor-pointer mb-6"
      >
        {triggering ? 'Triggering...' : 'Ingest Now'}
      </button>

      {loading ? (
        <div className="text-text-dim py-8">Loading pipeline runs...</div>
      ) : runs.length === 0 ? (
        <div className="text-text-dim py-8 text-center bg-surface-raised border border-surface-border rounded-lg">
          No pipeline runs found.
        </div>
      ) : (
        <div className="bg-surface-raised border border-surface-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-text-dim text-xs">
                <th className="px-3 py-2 text-left w-20">Type</th>
                <th className="px-3 py-2 text-left">Started</th>
                <th className="px-3 py-2 text-left">Completed</th>
                <th className="px-3 py-2 text-center w-24">Status</th>
                <th className="px-3 py-2 text-right w-16">Fetched</th>
                <th className="px-3 py-2 text-right w-12">New</th>
                <th className="px-3 py-2 text-right w-16">Scored</th>
                <th className="px-3 py-2 text-right w-16">Errors</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <>
                  <tr
                    key={run.id}
                    className={`border-b border-surface-border hover:bg-surface-overlay cursor-pointer transition-colors ${run.status === 'failed' ? 'bg-damage/5' : ''}`}
                    onClick={() => setExpandedId(expandedId === run.id ? null : run.id)}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{typeLabel(run.run_type)}</td>
                    <td className="px-3 py-2 text-text-secondary text-xs">
                      {new Date(run.started_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-text-dim text-xs">
                      {run.completed_at ? new Date(run.completed_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded ${statusColor(run.status)}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{run.articles_fetched}</td>
                    <td className="px-3 py-2 text-right font-mono">{run.articles_new}</td>
                    <td className="px-3 py-2 text-right font-mono">{run.events_scored}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {Array.isArray(run.errors) && run.errors.length > 0 ? (
                        <span className="text-damage">{run.errors.length}</span>
                      ) : (
                        <span className="text-text-dim">0</span>
                      )}
                    </td>
                  </tr>
                  {expandedId === run.id && (
                    <tr key={`${run.id}-detail`}>
                      <td colSpan={8} className="px-4 py-3 bg-surface-overlay border-b border-surface-border">
                        <div className="text-xs space-y-2">
                          {Array.isArray(run.errors) && run.errors.length > 0 && (
                            <div>
                              <p className="text-text-dim font-semibold mb-1">Errors:</p>
                              {run.errors.map((err, i) => (
                                <p key={i} className="text-damage font-mono">{String(err)}</p>
                              ))}
                            </div>
                          )}
                          {run.metadata && Object.keys(run.metadata).length > 0 && (
                            <div>
                              <p className="text-text-dim font-semibold mb-1">Metadata:</p>
                              <pre className="text-text-muted font-mono whitespace-pre-wrap">
                                {JSON.stringify(run.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                          {(!run.errors || (Array.isArray(run.errors) && run.errors.length === 0)) &&
                            (!run.metadata || Object.keys(run.metadata).length === 0) && (
                              <p className="text-text-dim">No additional details.</p>
                            )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
