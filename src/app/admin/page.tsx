import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentWeekStart, toWeekId, getWeekLabel } from '@/lib/weeks';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getDashboardData() {
  const supabase = createAdminClient();
  const currentWeekId = toWeekId(getCurrentWeekStart());

  const [
    { data: currentWeek },
    { data: recentRuns },
    { data: currentEvents },
    { count: totalEvents },
    { count: totalArticles },
    { data: pendingReview },
  ] = await Promise.all([
    supabase
      .from('weekly_snapshots')
      .select('*')
      .eq('week_id', currentWeekId)
      .single(),
    supabase
      .from('pipeline_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10),
    supabase
      .from('events')
      .select('id, primary_list, confidence, human_reviewed')
      .eq('week_id', currentWeekId),
    supabase
      .from('events')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('articles')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('events')
      .select('id')
      .eq('week_id', currentWeekId)
      .lt('confidence', 0.7),
  ]);

  const lastIngest = (recentRuns || []).find((r) => r.run_type === 'ingest');
  const lastFreeze = (recentRuns || []).find((r) => r.run_type === 'freeze');
  const failedRuns = (recentRuns || []).filter((r) => r.status === 'failed');

  const events = currentEvents || [];
  const listCounts = {
    A: events.filter((e) => e.primary_list === 'A').length,
    B: events.filter((e) => e.primary_list === 'B').length,
    C: events.filter((e) => e.primary_list === 'C').length,
  };
  const unreviewed = events.filter((e) => !e.human_reviewed).length;

  return {
    currentWeekId,
    currentWeek,
    lastIngest,
    lastFreeze,
    failedRuns,
    listCounts,
    pendingReviewCount: pendingReview?.length || 0,
    unreviewedCount: unreviewed,
    totalEvents: totalEvents || 0,
    totalArticles: totalArticles || 0,
    eventCount: events.length,
  };
}

export default async function AdminDashboard() {
  const data = await getDashboardData();

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">Dashboard</h2>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Events" value={data.totalEvents} />
        <StatCard label="Total Articles" value={data.totalArticles} />
        <StatCard label="This Week" value={data.eventCount} />
        <StatCard
          label="Failed Runs"
          value={data.failedRuns.length}
          alert={data.failedRuns.length > 0}
        />
      </div>

      {/* Current week */}
      <div className="bg-surface-raised border border-surface-border rounded-lg p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">
            Current Week: {getWeekLabel(new Date(data.currentWeekId + 'T00:00:00'))}
          </h3>
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              data.currentWeek?.status === 'frozen'
                ? 'bg-mixed/20 text-mixed'
                : 'bg-live/20 text-live'
            }`}
          >
            {data.currentWeek?.status || 'no snapshot'}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-3 text-sm">
          <MiniStat label="List A" value={data.listCounts.A} color="text-damage" />
          <MiniStat label="List B" value={data.listCounts.B} color="text-distraction" />
          <MiniStat label="List C" value={data.listCounts.C} color="text-noise" />
          <MiniStat
            label="Low Confidence"
            value={data.pendingReviewCount}
            color={data.pendingReviewCount > 0 ? 'text-distraction' : 'text-text-muted'}
          />
          <MiniStat
            label="Unreviewed"
            value={data.unreviewedCount}
            color={data.unreviewedCount > 0 ? 'text-distraction' : 'text-text-muted'}
          />
        </div>
      </div>

      {/* Pipeline health */}
      <div className="bg-surface-raised border border-surface-border rounded-lg p-5 mb-6">
        <h3 className="text-sm font-semibold mb-3">Pipeline Health</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-text-dim">Last Ingest: </span>
            <span className="text-text-secondary">
              {data.lastIngest
                ? `${new Date(data.lastIngest.started_at).toLocaleString()} — ${data.lastIngest.status}`
                : 'Never'}
            </span>
          </div>
          <div>
            <span className="text-text-dim">Last Freeze: </span>
            <span className="text-text-secondary">
              {data.lastFreeze
                ? `${new Date(data.lastFreeze.started_at).toLocaleString()} — ${data.lastFreeze.status}`
                : 'Never'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 mb-6">
        <TriggerButton endpoint="/api/admin/pipeline/trigger" label="Trigger Ingest" />
        <Link
          href="/admin/queue"
          className="bg-surface-raised border border-surface-border rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:border-mixed/30 transition-colors no-underline"
        >
          Review Queue ({data.pendingReviewCount})
        </Link>
        <Link
          href="/admin/events"
          className="bg-surface-raised border border-surface-border rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:border-mixed/30 transition-colors no-underline"
        >
          All Events
        </Link>
      </div>

      {/* Recent pipeline runs */}
      {data.failedRuns.length > 0 && (
        <div className="bg-damage/5 border border-damage/20 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-damage mb-2">
            Recent Errors ({data.failedRuns.length})
          </h3>
          {data.failedRuns.map((run) => (
            <div key={run.id} className="text-xs text-text-secondary mb-1">
              {run.run_type} at {new Date(run.started_at).toLocaleString()} —{' '}
              {Array.isArray(run.errors) && run.errors.length > 0
                ? String(run.errors[0])
                : 'Unknown error'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  alert,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div
      className={`bg-surface-raised border rounded-lg p-4 ${
        alert ? 'border-damage/40' : 'border-surface-border'
      }`}
    >
      <p className="text-xs text-text-dim mb-1">{label}</p>
      <p className={`text-2xl font-bold ${alert ? 'text-damage' : 'text-text-primary'}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <p className="text-xs text-text-dim">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function TriggerButton({ endpoint, label }: { endpoint: string; label: string }) {
  return (
    <form
      action={async () => {
        'use server';
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}${endpoint}`, {
          method: 'POST',
        });
      }}
    >
      <button
        type="submit"
        className="bg-action text-white rounded px-4 py-2 text-sm font-semibold hover:bg-action/90 transition-colors cursor-pointer"
      >
        {label}
      </button>
    </form>
  );
}
