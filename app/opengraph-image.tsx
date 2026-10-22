import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'TideeUp — A personalized weekly cleaning plan for your home';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Share card for the whole site. Rendered on the edge at request time, no
 * external assets needed, so it works on Vercel with zero setup.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #F0FDFA 0%, #FFFFFF 55%, #F0FDFA 100%)',
          fontFamily: 'system-ui, sans-serif',
          color: '#0F172A',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 48 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: '#0D9488',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="44" height="44" viewBox="0 0 64 64">
              <path
                d="M18 34 L28 44 L47 22"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, color: '#0D9488' }}>TideeUp</div>
        </div>

        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
          A personalized weekly cleaning plan for your home.
        </div>
        <div style={{ fontSize: 34, color: '#475569', marginTop: 32 }}>
          In 2 minutes. Free. No login required.
        </div>
      </div>
    ),
    { ...size },
  );
}
