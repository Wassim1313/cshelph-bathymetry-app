import React, { useState } from 'react';

function ParamSlider({ label, value, min, max, step, unit, onChange, description }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
        <label style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-cyan)', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
          {value}{unit || ''}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step || 1} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', height: '4px', borderRadius: '2px', outline: 'none', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer',
          background: `linear-gradient(to right, var(--accent-cyan) ${((value-min)/(max-min))*100}%, var(--bg-tertiary) ${((value-min)/(max-min))*100}%)`,
        }} />
      {description && <p style={{ fontSize: '9px', color: 'var(--text-dim)', marginTop: '3px', lineHeight: 1.4 }}>{description}</p>}
    </div>
  );
}

export default function Sidebar({ roi, params, setParams, onExtract, onSearch, loading, error, results, searchResults, onExport }) {
  const [section, setSection] = useState('roi');

  return (
    <aside style={{
      background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-dim)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', gridRow: '2',
    }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-dim)' }}>
        {[
          { id: 'roi', label: '01 ROI' },
          { id: 'params', label: '02 C-SHELPh' },
          { id: 'info', label: '03 Pipeline' },
        ].map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{
            flex: 1, padding: '10px 4px', fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 500, border: 'none', cursor: 'pointer',
            background: section === s.id ? 'var(--bg-tertiary)' : 'transparent',
            color: section === s.id ? 'var(--accent-cyan)' : 'var(--text-dim)',
            borderBottom: section === s.id ? '2px solid var(--accent-cyan)' : '2px solid transparent',
          }}>{s.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>
        {section === 'roi' && (
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Region of Interest</h3>

            {/* ROI status */}
            <div style={{
              padding: '14px', borderRadius: 'var(--radius)', marginBottom: '14px',
              border: `1px solid ${roi ? 'rgba(45, 212, 191, 0.3)' : 'var(--border-dim)'}`,
              background: roi ? 'rgba(45, 212, 191, 0.05)' : 'var(--bg-card)',
            }}>
              {roi ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent-teal)', boxShadow: '0 0 6px var(--accent-teal)' }} />
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-teal)', fontWeight: 600 }}>ROI DEFINED</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                    {[['N', roi.north], ['S', roi.south], ['E', roi.east], ['W', roi.west]].map(([d, v]) => (
                      <div key={d} style={{ padding: '5px 7px', background: 'var(--bg-secondary)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-dim)' }}>{d}</span>
                        <span style={{ color: 'var(--text-primary)' }}>{v?.toFixed(4)}°</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '6px 0' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Draw a rectangle on the map</p>
                  <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>Choose a coastal area with clear, shallow water</p>
                </div>
              )}
            </div>

            {/* Date Range */}
            <label style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '5px' }}>
              ATL03 Date Range
            </label>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              {['start_date', 'end_date'].map(k => (
                <input key={k} type="date" value={params[k]}
                  onChange={e => setParams({...params, [k]: e.target.value})}
                  style={{
                    flex: 1, padding: '7px', fontSize: '10px', fontFamily: 'var(--font-mono)',
                    background: 'var(--bg-card)', border: '1px solid var(--border-dim)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none',
                  }} />
              ))}
            </div>

            {/* Search button */}
            <button onClick={onSearch} disabled={!roi || loading} style={{
              width: '100%', padding: '10px', fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 600,
              borderRadius: '8px', border: '1px solid var(--border-dim)', marginBottom: '8px',
              background: 'var(--bg-card)', color: roi && !loading ? 'var(--accent-teal)' : 'var(--text-dim)',
              cursor: roi && !loading ? 'pointer' : 'not-allowed', opacity: roi && !loading ? 1 : 0.5,
            }}>
              🔍 Search ATL03 Tracks
            </button>

            {searchResults && (
              <div style={{
                padding: '8px 10px', borderRadius: '6px', background: 'rgba(45, 212, 191, 0.08)',
                border: '1px solid rgba(45, 212, 191, 0.2)', marginBottom: '12px',
                fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-teal)',
              }}>
                Found <strong>{searchResults.count}</strong> ATL03 granules
              </div>
            )}

            {/* Extract Button */}
            <button onClick={onExtract} disabled={!roi || loading} style={{
              width: '100%', padding: '14px', fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 700,
              borderRadius: '10px', border: 'none',
              cursor: roi && !loading ? 'pointer' : 'not-allowed', opacity: roi && !loading ? 1 : 0.4,
              background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))', color: '#fff',
              boxShadow: roi ? '0 4px 20px rgba(56, 189, 248, 0.3)' : 'none',
            }}>
              {loading ? '⟳ Processing...' : '⚡ Run C-SHELPh Extraction'}
            </button>

            {error && (
              <div style={{
                marginTop: '10px', padding: '10px 12px', borderRadius: '8px',
                background: 'rgba(251, 113, 133, 0.1)', border: '1px solid rgba(251, 113, 133, 0.2)',
                fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-rose)', lineHeight: 1.5,
              }}>{error}</div>
            )}
          </div>
        )}

        {section === 'params' && (
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '14px' }}>C-SHELPh Parameters</h3>

            <ParamSlider label="Laser Number" value={params.laser} min={1} max={3}
              onChange={v => setParams({...params, laser: v})}
              description="ICESat-2 ground track pair (1-3). Selects strong beam." />

            <ParamSlider label="Density Threshold" value={params.density_threshold} min={5} max={95} unit="%"
              onChange={v => setParams({...params, density_threshold: v})}
              description="Percentile threshold for photon density classification. Lower = more sensitive to noise." />

            <ParamSlider label="Surface Buffer" value={params.surface_buffer} min={-3} max={0} step={0.1} unit="m"
              onChange={v => setParams({...params, surface_buffer: v})}
              description="Height buffer below which to look for subsurface data." />

            <ParamSlider label="Lat Resolution" value={params.lat_resolution} min={5} max={50} unit="m"
              onChange={v => setParams({...params, lat_resolution: v})}
              description="Horizontal bin size for photon grouping (along-track)." />

            <ParamSlider label="Height Resolution" value={params.height_resolution} min={0.1} max={2} step={0.1} unit="m"
              onChange={v => setParams({...params, height_resolution: v})}
              description="Vertical bin size for photon classification." />

            <ParamSlider label="Max Granules" value={params.max_granules} min={1} max={10}
              onChange={v => setParams({...params, max_granules: v})}
              description="Maximum number of ATL03 H5 files to download and process." />

            <ParamSlider label="Y Limit Top" value={params.y_limit_top} min={0} max={20} unit="m"
              onChange={v => setParams({...params, y_limit_top: v})} />

            <ParamSlider label="Y Limit Bottom" value={params.y_limit_bottom} min={-60} max={-5} unit="m"
              onChange={v => setParams({...params, y_limit_bottom: v})} />

            <div style={{ marginTop: '10px' }}>
              <label style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>
                Water Temp Override (°C)
              </label>
              <input type="number" placeholder="Auto (earthaccess)" step="0.5"
                value={params.water_temp || ''}
                onChange={e => setParams({...params, water_temp: e.target.value ? parseFloat(e.target.value) : null})}
                style={{
                  width: '100%', padding: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)',
                  background: 'var(--bg-card)', border: '1px solid var(--border-dim)', borderRadius: '6px',
                  color: 'var(--text-primary)', outline: 'none',
                }} />
              <p style={{ fontSize: '9px', color: 'var(--text-dim)', marginTop: '3px' }}>
                Leave empty to auto-fetch SST via earthaccess (GHRSST). Override if you know local water temp.
              </p>
            </div>
          </div>
        )}

        {section === 'info' && (
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '14px' }}>C-SHELPh Pipeline</h3>
            <div style={{ fontSize: '11px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              <p style={{ marginBottom: '10px' }}>
                This app runs the <strong style={{ color: 'var(--text-primary)' }}>real cshelph Python package</strong> (v2.9)
                from PyPI on actual ICESat-2 ATL03 data downloaded via <strong style={{ color: 'var(--text-primary)' }}>earthaccess</strong>.
              </p>
              <div style={{ padding: '10px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-dim)' }}>
                <p style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>Execution Flow</p>
                {[
                  'earthaccess.login() → authenticate',
                  'earthaccess.search_data("ATL03", bbox)',
                  'earthaccess.download() → H5 files',
                  'cshelph.read_atl03(h5, laser)',
                  'cshelph.convert_wgs_to_utm()',
                  'cshelph.orthometric_correction()',
                  'cshelph.ref_linear_interp()',
                  'cshelph.bin_data(lat_res, height_res)',
                  'cshelph.get_sea_height(surface_buffer)',
                  'cshelph.get_water_temp() → GHRSST SST',
                  'cshelph.refraction_correction() → Parrish 2019',
                  'cshelph.get_bath_height(threshold)',
                  'Transform UTM→WGS84 → JSON response',
                ].map((step, i) => (
                  <p key={i} style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', padding: '3px 0', borderBottom: i < 12 ? '1px solid var(--border-dim)' : 'none' }}>
                    <span style={{ color: 'var(--accent-cyan)', marginRight: '6px' }}>{String(i+1).padStart(2,'0')}</span>{step}
                  </p>
                ))}
              </div>
              <p style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '10px' }}>
                Ref: Thomas et al. (2022) — A purely spaceborne open source approach for regional bathymetry mapping.
              </p>
              <p style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>
                Requires NASA EarthData credentials (EARTHDATA_USERNAME, EARTHDATA_PASSWORD env vars).
              </p>
            </div>
          </div>
        )}
      </div>

      {results && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-dim)', display: 'flex', gap: '6px' }}>
          <button onClick={() => onExport('geojson')} style={{
            flex: 1, padding: '7px', fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 600,
            borderRadius: '6px', border: '1px solid var(--border-dim)', background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer',
          }}>↓ GeoJSON</button>
          <button onClick={() => onExport('csv')} style={{
            flex: 1, padding: '7px', fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 600,
            borderRadius: '6px', border: '1px solid var(--border-dim)', background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer',
          }}>↓ CSV</button>
        </div>
      )}
    </aside>
  );
}
