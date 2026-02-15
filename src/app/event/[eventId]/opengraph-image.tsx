import { ImageResponse } from 'next/og';
import { getEventDetail } from '@/lib/data/events';

export const runtime = 'edge';
export const alt = 'The Distraction Index — Event Detail';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = await getEventDetail(eventId);

  if (!event) {
    return new ImageResponse(
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', backgroundColor: '#050510', color: '#F3F4F6', fontSize: 32 }}>
        Event Not Found
      </div>,
      { ...size },
    );
  }

  const list = event.primary_list;
  const listLabel = list === 'A' ? 'REAL DAMAGE' : list === 'B' ? 'DISTRACTION' : 'NOISE';
  const listColor = list === 'A' ? '#DC2626' : list === 'B' ? '#D97706' : '#6B7280';

  const summary = event.summary
    ? event.summary.length > 180 ? event.summary.slice(0, 177) + '...' : event.summary
    : '';

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#818CF8', letterSpacing: '0.2em', textTransform: 'uppercase' as const }}>
          THE DISTRACTION INDEX
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: listColor,
            letterSpacing: '0.15em',
            textTransform: 'uppercase' as const,
            border: `1px solid ${listColor}`,
            padding: '4px 12px',
            borderRadius: 4,
          }}
        >
          {listLabel}
        </div>
      </div>

      {/* Title */}
      <div style={{ fontSize: 32, fontWeight: 800, color: '#F3F4F6', lineHeight: 1.2, marginBottom: 16 }}>
        {event.title.length > 80 ? event.title.slice(0, 77) + '...' : event.title}
      </div>

      {/* Summary */}
      {summary && (
        <div style={{ fontSize: 16, color: '#D1D5DB', lineHeight: 1.5, marginBottom: 32 }}>
          {summary}
        </div>
      )}

      {/* Scores */}
      <div style={{ display: 'flex', gap: 48, marginTop: 'auto', marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', letterSpacing: '0.15em', marginBottom: 4 }}>
            A-SCORE
          </div>
          <div style={{ fontSize: 56, fontWeight: 800, color: '#DC2626' }}>
            {event.a_score?.toFixed(1) ?? '—'}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#D97706', letterSpacing: '0.15em', marginBottom: 4 }}>
            B-SCORE
          </div>
          <div style={{ fontSize: 56, fontWeight: 800, color: '#D97706' }}>
            {event.b_score?.toFixed(1) ?? '—'}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 14, color: '#838B98' }}>
          {event.event_date} · {event.article_count} sources
        </div>
        <div style={{ fontSize: 14, color: '#838B98' }}>
          distractionindex.org
        </div>
      </div>
    </div>,
    { ...size },
  );
}
