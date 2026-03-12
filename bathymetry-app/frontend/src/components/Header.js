import React from 'react';

export default function Header({ view, setView, hasResults, onReset }) {
  const viewOptions = [
    { id: 'map', label: 'Map' },
    { id: '3d', label: '3D' },
    { id: 'split', label: 'Split' },
  ];

  return (
    <header style={{
      gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-dim)', zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700,
        }}>⚓</div>
        <div>
          <h1 style={{
            fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-teal))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>C-SHELPh</h1>
          <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Real ICESat-2 ATL03 Bathymetry Extraction
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-dim)' }}>
          {viewOptions.map(opt => (
            <button key={opt.id} onClick={() => setView(opt.id)}
              disabled={opt.id !== 'map' && !hasResults}
              style={{
                padding: '6px 16px', fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 500, borderRadius: '6px', border: 'none',
                cursor: opt.id !== 'map' && !hasResults ? 'not-allowed' : 'pointer',
                opacity: opt.id !== 'map' && !hasResults ? 0.3 : 1,
                background: view === opt.id ? 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))' : 'transparent',
                color: view === opt.id ? '#fff' : 'var(--text-secondary)', transition: 'all 0.2s',
              }}>{opt.label}</button>
          ))}
        </div>
        {hasResults && (
          <button onClick={onReset} style={{
            padding: '6px 14px', fontSize: '12px', fontFamily: 'var(--font-mono)', borderRadius: '6px',
            border: '1px solid rgba(251, 113, 133, 0.3)', background: 'rgba(251, 113, 133, 0.1)', color: 'var(--accent-rose)', cursor: 'pointer',
          }}>Reset</button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', padding: '4px 10px', background: 'var(--bg-tertiary)', borderRadius: '4px', border: '1px solid var(--border-dim)' }}>
          cshelph v2.9 + earthaccess
        </span>
      </div>
    </header>
  );
}
