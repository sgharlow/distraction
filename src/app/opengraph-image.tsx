import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'The Distraction Index — Weekly civic intelligence report';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
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
        justifyContent: 'center',
      }}
    >
      {/* Brand header */}
      <div style={{ fontSize: 14, fontWeight: 800, color: '#818CF8', letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: 16 }}>
        DISTRACTIONINDEX.ORG
      </div>

      {/* Title */}
      <div style={{ fontSize: 52, fontWeight: 800, color: '#F3F4F6', lineHeight: 1.15, marginBottom: 20 }}>
        The Distraction Index
      </div>

      {/* Tagline */}
      <div style={{ fontSize: 24, color: '#9CA3AF', lineHeight: 1.4, marginBottom: 40 }}>
        Weekly civic intelligence report tracking democratic damage vs. manufactured distractions.
      </div>

      {/* Score labels */}
      <div style={{ display: 'flex', gap: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#DC2626' }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: '#DC2626', letterSpacing: '0.1em' }}>
            A-SCORE: CONSTITUTIONAL DAMAGE
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#D97706' }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: '#D97706', letterSpacing: '0.1em' }}>
            B-SCORE: DISTRACTION / HYPE
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
        <div style={{ fontSize: 14, color: '#838B98' }}>
          Independent · Open Source · Immutable Weekly Records
        </div>
        <div style={{ fontSize: 14, color: '#838B98' }}>
          Since December 2024
        </div>
      </div>
    </div>,
    { ...size },
  );
}
