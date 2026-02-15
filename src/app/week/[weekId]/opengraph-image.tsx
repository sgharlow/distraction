import { ImageResponse } from 'next/og';
import { resolveWeekParam, getWeekLabel, getWeekNumber, toWeekId } from '@/lib/weeks';
import { getWeekData } from '@/lib/data/weeks';

export const runtime = 'edge';
export const alt = 'The Distraction Index — Weekly Summary';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const weekStart = resolveWeekParam(weekId);
  if (!weekStart) {
    return new ImageResponse(
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', backgroundColor: '#050510', color: '#F3F4F6', fontSize: 32 }}>
        Week Not Found
      </div>,
      { ...size },
    );
  }

  const wid = toWeekId(weekStart);
  const weekData = await getWeekData(wid);
  const weekLabel = getWeekLabel(weekStart);
  const weekNum = getWeekNumber(weekStart);

  const topA = weekData?.events.A[0] ?? null;
  const topB = weekData?.events.B[0] ?? null;
  const totalEvents = weekData?.snapshot.total_events ?? 0;
  const totalSources = weekData?.snapshot.total_sources ?? 0;
  const status = weekData?.snapshot.status ?? 'live';

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#050510',
        padding: '48px 56px',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#818CF8', letterSpacing: '0.2em', textTransform: 'uppercase' as const }}>
          THE DISTRACTION INDEX
        </div>
      </div>

      {/* Week info */}
      <div style={{ fontSize: 36, fontWeight: 800, color: '#F3F4F6', marginBottom: 4 }}>
        Week {weekNum}: {weekLabel}
      </div>
      <div style={{ fontSize: 16, color: '#9CA3AF', marginBottom: 32 }}>
        {status === 'live' ? 'Live — updating throughout the week' : 'Frozen weekly edition'}
      </div>

      {/* Top events */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {topA && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 42, fontWeight: 800, color: '#DC2626', minWidth: 80 }}>
              {topA.a_score?.toFixed(1) ?? '—'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>
                TOP DAMAGE
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#F3F4F6', lineHeight: 1.2 }}>
                {topA.title.length > 60 ? topA.title.slice(0, 57) + '...' : topA.title}
              </div>
            </div>
          </div>
        )}

        {topB && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 42, fontWeight: 800, color: '#D97706', minWidth: 80 }}>
              {topB.b_score?.toFixed(1) ?? '—'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#D97706', letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>
                TOP DISTRACTION
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#F3F4F6', lineHeight: 1.2 }}>
                {topB.title.length > 60 ? topB.title.slice(0, 57) + '...' : topB.title}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
        <div style={{ fontSize: 14, color: '#838B98' }}>
          {totalEvents} events · {totalSources} sources
        </div>
        <div style={{ fontSize: 14, color: '#838B98' }}>
          distractionindex.org
        </div>
      </div>
    </div>,
    { ...size },
  );
}
