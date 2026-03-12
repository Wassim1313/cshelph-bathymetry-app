import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet-draw';

function depthColor(depth, maxDepth) {
  const t = Math.min(Math.abs(depth) / (maxDepth || 30), 1);
  if (t < 0.15) return `rgba(56, 189, 248, ${0.6 + t * 2})`;
  if (t < 0.35) return `rgba(59, 130, 246, ${0.7 + t})`;
  if (t < 0.55) return `rgba(99, 102, 241, ${0.8 + t * 0.2})`;
  if (t < 0.75) return `rgba(139, 92, 246, ${0.85 + t * 0.15})`;
  return `rgba(30, 27, 75, ${0.9 + t * 0.1})`;
}

export default function MapPanel({ roi, setRoi, results, style }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layersRef = useRef({});
  const [layerVis, setLayerVis] = useState({ bathymetry: true, surface: false, noise: false, tracks: true });

  useEffect(() => {
    if (mapInstance.current) return;
    const map = L.map(mapRef.current, { center: [24.7, -77.8], zoom: 10, zoomControl: true, attributionControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);

    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        rectangle: { shapeOptions: { color: '#38bdf8', weight: 2, fillOpacity: 0.1, dashArray: '6,6' } },
        polygon: false, circle: false, circlemarker: false, marker: false, polyline: false,
      },
      edit: { featureGroup: drawnItems },
    });
    map.addControl(drawControl);

    map.on('draw:created', e => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);
      const b = e.layer.getBounds();
      setRoi({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
    });
    map.on('draw:deleted', () => setRoi(null));

    // Satellite toggle
    const lc = L.control({ position: 'bottomright' });
    lc.onAdd = () => {
      const div = L.DomUtil.create('div');
      div.innerHTML = `<button id="sat-toggle" style="padding:5px 9px;font-size:10px;font-family:'JetBrains Mono',monospace;background:rgba(20,28,46,0.9);border:1px solid rgba(56,189,248,0.2);color:#94a3b8;border-radius:6px;cursor:pointer;backdrop-filter:blur(8px)">🛰 Satellite</button>`;
      let vis = false;
      div.querySelector('#sat-toggle').addEventListener('click', () => {
        vis ? map.removeLayer(satellite) : satellite.addTo(map);
        vis = !vis;
      });
      L.DomEvent.disableClickPropagation(div);
      return div;
    };
    lc.addTo(map);
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

    mapInstance.current = map;
    layersRef.current.drawnItems = drawnItems;
    return () => { map.remove(); mapInstance.current = null; };
  }, [setRoi]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !results) return;
    ['bathyPoints', 'surfacePoints', 'noisePoints', 'trackLines'].forEach(k => {
      if (layersRef.current[k]) map.removeLayer(layersRef.current[k]);
    });

    const pts = results.points || [];
    const maxDepth = results.stats?.max_depth || 30;
    const bathyG = L.layerGroup(), surfG = L.layerGroup(), noiseG = L.layerGroup(), trackG = L.layerGroup();

    pts.forEach(p => {
      const color = p.photon_class === 'bathymetry' ? depthColor(p.depth, maxDepth) : p.photon_class === 'surface' ? '#34d399' : '#64748b';
      const r = p.photon_class === 'bathymetry' ? 3 : 2;
      const o = p.photon_class === 'noise' ? 0.2 : 0.8;
      const m = L.circleMarker([p.lat, p.lon], { radius: r, fillColor: color, fillOpacity: o, stroke: false });
      if (p.photon_class === 'bathymetry') {
        m.bindPopup(`<div style="font-family:'JetBrains Mono',monospace;font-size:11px"><b style="color:#38bdf8">Bathy Photon</b><br>Depth: <b>${p.depth.toFixed(2)}m</b><br>Lat: ${p.lat.toFixed(6)}°<br>Lon: ${p.lon.toFixed(6)}°<br>Track: ${p.track_id||''}</div>`);
        bathyG.addLayer(m);
      } else if (p.photon_class === 'surface') surfG.addLayer(m);
      else noiseG.addLayer(m);
    });

    // Track lines
    const trackIds = [...new Set(pts.filter(p => p.photon_class === 'bathymetry').map(p => p.track_id))];
    trackIds.forEach(tid => {
      const tp = pts.filter(p => p.track_id === tid && p.photon_class === 'bathymetry').sort((a,b) => a.lat - b.lat);
      if (tp.length > 1) L.polyline(tp.map(p => [p.lat, p.lon]), { color: '#38bdf8', weight: 1.5, opacity: 0.4, dashArray: '4,4' }).addTo(trackG);
    });

    layersRef.current = { ...layersRef.current, bathyPoints: bathyG, surfacePoints: surfG, noisePoints: noiseG, trackLines: trackG };
    if (layerVis.bathymetry) bathyG.addTo(map);
    if (layerVis.surface) surfG.addTo(map);
    if (layerVis.noise) noiseG.addTo(map);
    if (layerVis.tracks) trackG.addTo(map);

    // Fit bounds to data
    const bathyPts = pts.filter(p => p.photon_class === 'bathymetry');
    if (bathyPts.length > 0) {
      const lats = bathyPts.map(p => p.lat), lons = bathyPts.map(p => p.lon);
      map.fitBounds([[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]], { padding: [30, 30] });
    } else if (results.bbox) {
      map.fitBounds([[results.bbox.south, results.bbox.west], [results.bbox.north, results.bbox.east]], { padding: [30, 30] });
    }
  }, [results, layerVis]);

  const toggle = key => {
    const nv = { ...layerVis, [key]: !layerVis[key] };
    setLayerVis(nv);
    const map = mapInstance.current;
    if (!map) return;
    const lkm = { bathymetry: 'bathyPoints', surface: 'surfacePoints', noise: 'noisePoints', tracks: 'trackLines' };
    const layer = layersRef.current[lkm[key]];
    if (layer) { nv[key] ? layer.addTo(map) : map.removeLayer(layer); }
  };

  return (
    <div style={{ ...style, position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {results && (
        <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 1000, background: 'rgba(20,28,46,0.92)', backdropFilter: 'blur(12px)', borderRadius: '10px', border: '1px solid var(--border-dim)', padding: '10px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <p style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>Layers</p>
          {[
            { key: 'bathymetry', label: 'Bathy', color: '#38bdf8' },
            { key: 'surface', label: 'Surface', color: '#34d399' },
            { key: 'noise', label: 'Noise', color: '#64748b' },
            { key: 'tracks', label: 'Tracks', color: '#38bdf8' },
          ].map(l => (
            <button key={l.key} onClick={() => toggle(l.key)} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', fontSize: '10px', fontFamily: 'var(--font-mono)',
              background: layerVis[l.key] ? 'rgba(56,189,248,0.08)' : 'transparent', border: 'none', borderRadius: '4px',
              color: layerVis[l.key] ? 'var(--text-primary)' : 'var(--text-dim)', cursor: 'pointer',
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: layerVis[l.key] ? l.color : 'var(--text-dim)', opacity: layerVis[l.key] ? 1 : 0.3 }} />
              {l.label}
            </button>
          ))}
        </div>
      )}
      {results && (
        <div style={{ position: 'absolute', bottom: '40px', right: '12px', zIndex: 1000, background: 'rgba(20,28,46,0.92)', backdropFilter: 'blur(12px)', borderRadius: '10px', border: '1px solid var(--border-dim)', padding: '10px 14px' }}>
          <p style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Depth (m)</p>
          <div style={{ width: '120px', height: '10px', borderRadius: '3px', background: 'linear-gradient(to right, #38bdf8, #3b82f6, #6366f1, #8b5cf6, #1e1b4b)', marginBottom: '3px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
            <span>0</span><span>{(results.stats?.max_depth || 30).toFixed(0)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
