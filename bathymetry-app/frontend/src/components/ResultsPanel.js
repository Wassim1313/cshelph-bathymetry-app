import React, { useState, useMemo } from 'react';

function StatCard({ label, value, unit, accent }) {
  return (
    <div style={{ padding: '10px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-dim)' }}>
      <p style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>{label}</p>
      <p style={{ fontSize: '18px', fontWeight: 700, color: accent || 'var(--accent-cyan)', lineHeight: 1.1 }}>
        {value}<span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-dim)', marginLeft: '3px' }}>{unit}</span>
      </p>
    </div>
  );
}

function DepthHistogram({ points, maxDepth }) {
  const bins = useMemo(() => {
    const bp = points.filter(p => p.photon_class === 'bathymetry');
    const nBins = 20, bw = (maxDepth || 30) / nBins;
    const counts = new Array(nBins).fill(0);
    bp.forEach(p => { const b = Math.min(Math.floor(Math.abs(p.depth) / bw), nBins - 1); counts[b]++; });
    const mx = Math.max(...counts);
    return counts.map((c, i) => ({ depth: (i*bw+bw/2).toFixed(1), count: c, pct: mx > 0 ? c/mx : 0 }));
  }, [points, maxDepth]);

  return (
    <div>
      <p style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>Depth Distribution</p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '70px' }}>
        {bins.map((b, i) => (
          <div key={i} title={`${b.depth}m: ${b.count}`} style={{
            flex: 1, height: `${Math.max(b.pct*100, 2)}%`, borderRadius: '2px 2px 0 0',
            background: 'linear-gradient(to top, rgba(30,27,75,0.8), rgba(99,102,241,0.8), rgba(56,189,248,0.9))',
            opacity: 0.3+b.pct*0.7, cursor: 'pointer',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px', fontSize: '8px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
        <span>0m</span><span>{(maxDepth/2).toFixed(0)}m</span><span>{maxDepth.toFixed(0)}m</span>
      </div>
    </div>
  );
}

function DepthProfile({ profile, title }) {
  if (!profile || profile.length === 0) return null;
  const valid = profile.filter(p => p.height !== null && p.height !== undefined);
  if (valid.length < 2) return null;
  const minH = Math.min(...valid.map(p => p.height)), maxH = Math.max(...valid.map(p => p.height));
  const range = maxH - minH || 1;

  return (
    <div style={{ marginBottom: '10px' }}>
      <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '4px' }}>{title}</p>
      <svg width="100%" height="45" viewBox="0 0 300 45" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`g-${title}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <path
          d={'M 0 0 ' + valid.map((p, i) => `L ${(i/(valid.length-1))*300} ${((p.height-minH)/range)*43+1}`).join(' ') + ' L 300 0 Z'}
          fill={`url(#g-${title})`} stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.6"
        />
      </svg>
    </div>
  );
}

export default function ResultsPanel({ results, onClose, onExport }) {
  const [tab, setTab] = useState('overview');
  const stats = results.stats || {};
  const maxD = stats.max_depth || 30;

  return (
    <div style={{
      gridRow: '2', background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-dim)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeInUp 0.4s ease',
    }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-dim)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-cyan)' }}>C-SHELPh Results</h3>
          <p style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
            {stats.granules_processed || 0} granules · {stats.bathy_photons || 0} bathy photons
          </p>
        </div>
        <button onClick={onClose} style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid var(--border-dim)', background: 'var(--bg-card)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-dim)' }}>
        {['overview', 'profiles', 'data'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '7px', fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 500, border: 'none', cursor: 'pointer',
            background: tab === t ? 'var(--bg-tertiary)' : 'transparent',
            color: tab === t ? 'var(--accent-cyan)' : 'var(--text-dim)',
            borderBottom: tab === t ? '2px solid var(--accent-cyan)' : '2px solid transparent',
          }}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>
        {tab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '14px' }}>
              <StatCard label="Mean Depth" value={stats.mean_depth?.toFixed(2)} unit="m" />
              <StatCard label="Max Depth" value={stats.max_depth?.toFixed(2)} unit="m" accent="var(--accent-blue)" />
              <StatCard label="Bathy Photons" value={stats.bathy_photons?.toLocaleString()} accent="var(--accent-teal)" />
              <StatCard label="Total Photons" value={stats.total_photons?.toLocaleString()} accent="var(--text-secondary)" />
              <StatCard label="Std Dev" value={stats.std_depth?.toFixed(2)} unit="m" accent="var(--accent-amber)" />
              <StatCard label="Min Depth" value={stats.min_depth?.toFixed(2)} unit="m" accent="var(--accent-emerald)" />
            </div>

            <div style={{ padding: '12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-dim)', marginBottom: '14px' }}>
              <p style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>Photon Classification</p>
              {[
                { label: 'Bathymetry', count: stats.bathy_photons, color: 'var(--accent-cyan)' },
                { label: 'Surface', count: stats.surface_photons, color: 'var(--accent-emerald)' },
                { label: 'Noise', count: stats.noise_photons, color: 'var(--text-dim)' },
              ].map(cls => {
                const pct = stats.total_photons > 0 ? (cls.count / stats.total_photons) * 100 : 0;
                return (
                  <div key={cls.label} style={{ marginBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: cls.color }}>{cls.label}</span>
                      <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{cls.count?.toLocaleString()} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div style={{ height: '3px', background: 'var(--bg-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: cls.color, borderRadius: '2px' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-dim)' }}>
              <DepthHistogram points={results.points} maxDepth={maxD} />
            </div>
          </div>
        )}

        {tab === 'profiles' && (
          <div>
            <p style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '10px' }}>
              Along-Track Depth Profiles (from cshelph.get_bath_height)
            </p>
            {(results.bath_profiles || []).map((bp, i) => (
              <DepthProfile key={i} profile={bp.profile} title={bp.track} />
            ))}
            {(results.sea_profiles || []).map((sp, i) => (
              <DepthProfile key={`sea-${i}`} profile={sp.profile} title={`Sea Surface — ${sp.track}`} />
            ))}

            {results.tracks && (
              <div style={{ padding: '10px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-dim)', marginTop: '10px' }}>
                <p style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>Track Summary</p>
                <table style={{ width: '100%', fontSize: '9px', fontFamily: 'var(--font-mono)', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ color: 'var(--text-dim)' }}>
                    <th style={{ textAlign: 'left', padding: '3px 0' }}>Track</th>
                    <th style={{ textAlign: 'right', padding: '3px 0' }}>Bathy</th>
                    <th style={{ textAlign: 'right', padding: '3px 0' }}>Mean</th>
                    <th style={{ textAlign: 'right', padding: '3px 0' }}>Max</th>
                  </tr></thead>
                  <tbody>
                    {results.tracks.filter(t => !t.error).map((t, i) => (
                      <tr key={i} style={{ color: 'var(--text-secondary)' }}>
                        <td style={{ padding: '2px 0', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.track_id}</td>
                        <td style={{ textAlign: 'right', padding: '2px 0' }}>{t.n_bathy}</td>
                        <td style={{ textAlign: 'right', padding: '2px 0', color: 'var(--accent-cyan)' }}>{t.mean_depth?.toFixed(1)}m</td>
                        <td style={{ textAlign: 'right', padding: '2px 0', color: 'var(--accent-blue)' }}>{t.max_depth?.toFixed(1)}m</td>
                      </tr>
                    ))}
                    {results.tracks.filter(t => t.error).map((t, i) => (
                      <tr key={`e-${i}`} style={{ color: 'var(--accent-rose)' }}>
                        <td colSpan="4" style={{ padding: '2px 0', fontSize: '8px' }}>{t.track_id}: {t.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'data' && (
          <div>
            <p style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '10px' }}>
              Classified Bathymetry Photons
            </p>
            <div style={{ maxHeight: '400px', overflow: 'auto', borderRadius: '8px', border: '1px solid var(--border-dim)' }}>
              <table style={{ width: '100%', fontSize: '9px', fontFamily: 'var(--font-mono)', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: 'var(--bg-card)', color: 'var(--text-dim)', position: 'sticky', top: 0 }}>
                  <th style={{ textAlign: 'left', padding: '6px 4px' }}>Lat</th>
                  <th style={{ textAlign: 'left', padding: '6px 4px' }}>Lon</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px' }}>Depth</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px' }}>Height</th>
                </tr></thead>
                <tbody>
                  {results.points.filter(p => p.photon_class === 'bathymetry').slice(0, 150).map((p, i) => (
                    <tr key={i} style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-dim)' }}>
                      <td style={{ padding: '3px 4px' }}>{p.lat.toFixed(5)}</td>
                      <td style={{ padding: '3px 4px' }}>{p.lon.toFixed(5)}</td>
                      <td style={{ textAlign: 'right', padding: '3px 4px', color: 'var(--accent-cyan)' }}>{p.depth.toFixed(2)}m</td>
                      <td style={{ textAlign: 'right', padding: '3px 4px' }}>{p.height?.toFixed(2)}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
              <button onClick={() => onExport('geojson')} style={{ flex: 1, padding: '9px', fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 600, borderRadius: '8px', border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.1)', color: 'var(--accent-cyan)', cursor: 'pointer' }}>↓ GeoJSON</button>
              <button onClick={() => onExport('csv')} style={{ flex: 1, padding: '9px', fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 600, borderRadius: '8px', border: '1px solid rgba(45,212,191,0.3)', background: 'rgba(45,212,191,0.1)', color: 'var(--accent-teal)', cursor: 'pointer' }}>↓ CSV</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
