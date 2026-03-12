import React, { useState, useCallback } from 'react';
import MapPanel from './components/MapPanel';
import Sidebar from './components/Sidebar';
import ResultsPanel from './components/ResultsPanel';
import ThreeDView from './components/ThreeDView';
import Header from './components/Header';

const API_BASE = process.env.REACT_APP_API_URL || '';

function App() {
  const [roi, setRoi] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState(null);
  const [view, setView] = useState('map');
  const [params, setParams] = useState({
    laser: 1,
    density_threshold: 20,
    surface_buffer: -0.5,
    lat_resolution: 10,
    height_resolution: 0.5,
    y_limit_top: 5,
    y_limit_bottom: -40,
    water_temp: null,
    max_granules: 3,
    start_date: '2020-01-01',
    end_date: '2024-12-31',
  });
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState(null);

  const searchTracks = useCallback(async () => {
    if (!roi) return;
    setLoading(true);
    setLoadingMsg('Searching for ICESat-2 ATL03 tracks...');
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/search-tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bbox: roi,
          start_date: params.start_date,
          end_date: params.end_date,
          max_results: 50,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSearchResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  }, [roi, params]);

  const extractBathymetry = useCallback(async () => {
    if (!roi) return;
    setLoading(true);
    setError(null);

    const steps = [
      'Authenticating with NASA EarthData...',
      'Searching ATL03 granules for ROI...',
      'Downloading ICESat-2 H5 data...',
      'Running cshelph.read_atl03()...',
      'Orthometric correction (EGM2008)...',
      'Interpolating reference elevations...',
      'Binning photons for classification...',
      'Detecting water surface...',
      'Retrieving sea surface temperature...',
      'Applying refraction correction (Parrish 2019)...',
      'Classifying bathymetry photons...',
      'Preparing results...',
    ];
    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        setLoadingMsg(steps[stepIdx]);
        stepIdx++;
      }
    }, 4000);

    setLoadingMsg(steps[0]);

    try {
      const response = await fetch(`${API_BASE}/api/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bbox: roi,
          params,
          start_date: params.start_date,
          end_date: params.end_date,
        }),
      });

      const data = await response.json();

      if (data.error && (!data.points || data.points.length === 0)) {
        throw new Error(data.error);
      }

      if (data.points && data.points.length > 0) {
        setResults(data);
        setShowResults(true);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      clearInterval(interval);
      setLoading(false);
      setLoadingMsg('');
    }
  }, [roi, params]);

  const exportData = useCallback(async (format) => {
    if (!results) return;
    try {
      const response = await fetch(`${API_BASE}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: results.points, format }),
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cshelph_bathymetry.${format === 'geojson' ? 'geojson' : 'csv'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Export failed: ${err.message}`);
    }
  }, [results]);

  const resetAll = useCallback(() => {
    setRoi(null);
    setResults(null);
    setShowResults(false);
    setError(null);
    setSearchResults(null);
  }, []);

  return (
    <div style={{
      height: '100vh',
      display: 'grid',
      gridTemplateRows: '56px 1fr',
      gridTemplateColumns: showResults ? '360px 1fr 400px' : '360px 1fr',
      background: 'var(--bg-primary)',
      overflow: 'hidden',
    }}>
      <Header view={view} setView={setView} hasResults={!!results} onReset={resetAll} />

      <Sidebar
        roi={roi}
        params={params}
        setParams={setParams}
        onExtract={extractBathymetry}
        onSearch={searchTracks}
        loading={loading}
        error={error}
        results={results}
        searchResults={searchResults}
        onExport={exportData}
      />

      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {(view === 'map' || view === 'split') && (
          <MapPanel roi={roi} setRoi={setRoi} results={results}
            style={{ height: view === 'split' ? '50%' : '100%', width: '100%' }} />
        )}
        {(view === '3d' || view === 'split') && results && (
          <div style={{ height: view === 'split' ? '50%' : '100%', width: '100%', background: 'var(--bg-primary)' }}>
            <ThreeDView data={results} />
          </div>
        )}
        {view === '3d' && !results && (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', color: 'var(--text-dim)' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>Draw ROI → Extract → 3D view</p>
          </div>
        )}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(10, 14, 23, 0.9)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '24px', zIndex: 1000,
          }}>
            <div style={{ width: '64px', height: '64px', border: '3px solid var(--border-dim)', borderTopColor: 'var(--accent-cyan)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 600, color: 'var(--accent-cyan)', marginBottom: '8px' }}>
                C-SHELPh Processing
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)', maxWidth: '300px' }}>
                {loadingMsg}
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', marginTop: '12px', opacity: 0.6 }}>
                Downloading real ICESat-2 data may take a few minutes...
              </p>
            </div>
          </div>
        )}
      </div>

      {showResults && results && (
        <ResultsPanel results={results} onClose={() => setShowResults(false)} onExport={exportData} />
      )}
    </div>
  );
}

export default App;
