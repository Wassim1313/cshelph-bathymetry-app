import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

function BathymetryPoints({ points, maxDepth }) {
  const { positions, colors } = useMemo(() => {
    const bp = points.filter(p => p.photon_class === 'bathymetry');
    if (bp.length === 0) return { positions: new Float32Array(0), colors: new Float32Array(0) };
    const pos = new Float32Array(bp.length * 3), col = new Float32Array(bp.length * 3);
    const lats = bp.map(p => p.lat), lons = bp.map(p => p.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const lr = maxLat - minLat || 1, lonr = maxLon - minLon || 1;
    bp.forEach((p, i) => {
      const idx = i * 3;
      pos[idx] = ((p.lon - minLon) / lonr - 0.5) * 10;
      pos[idx+2] = ((p.lat - minLat) / lr - 0.5) * 10;
      pos[idx+1] = -(Math.abs(p.depth) / (maxDepth || 30)) * 3;
      const t = Math.min(Math.abs(p.depth) / (maxDepth || 30), 1);
      col[idx] = 0.22 + (1-t)*0.7; col[idx+1] = 0.74*(1-t*0.5); col[idx+2] = 0.97;
    });
    return { positions: pos, colors: col };
  }, [points, maxDepth]);

  if (positions.length === 0) return null;
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length/3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={colors.length/3} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.05} vertexColors transparent opacity={0.8} sizeAttenuation />
    </points>
  );
}

function SurfacePoints({ points }) {
  const positions = useMemo(() => {
    const sp = points.filter(p => p.photon_class === 'surface');
    if (sp.length === 0) return new Float32Array(0);
    const bp = points.filter(p => p.photon_class === 'bathymetry');
    const allp = [...bp, ...sp];
    const lats = allp.map(p => p.lat), lons = allp.map(p => p.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const lr = maxLat - minLat || 1, lonr = maxLon - minLon || 1;
    const pos = new Float32Array(sp.length * 3);
    sp.forEach((p, i) => {
      pos[i*3] = ((p.lon - minLon)/lonr - 0.5)*10;
      pos[i*3+2] = ((p.lat - minLat)/lr - 0.5)*10;
      pos[i*3+1] = 0.05;
    });
    return pos;
  }, [points]);
  if (positions.length === 0) return null;
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length/3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#34d399" transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

function WaterPlane() {
  const ref = useRef();
  useFrame(s => { if (ref.current) ref.current.position.y = Math.sin(s.clock.elapsedTime*0.5)*0.02; });
  return (
    <mesh ref={ref} rotation={[-Math.PI/2,0,0]} position={[0,0.1,0]}>
      <planeGeometry args={[12,12]} />
      <meshPhysicalMaterial color="#1e90ff" transparent opacity={0.12} roughness={0.1} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function ThreeDView({ data }) {
  const [showPts, setShowPts] = useState(true);
  const [showSurf, setShowSurf] = useState(true);
  const [showWater, setShowWater] = useState(true);
  const maxD = data.stats?.max_depth || 30;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas camera={{ position: [8,6,8], fov: 50 }} gl={{ antialias: true }} style={{ background: '#0a0e17' }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10,10,5]} intensity={0.8} />
        <pointLight position={[0,5,0]} intensity={0.5} color="#38bdf8" />
        {showPts && <BathymetryPoints points={data.points} maxDepth={maxD} />}
        {showSurf && <SurfacePoints points={data.points} />}
        {showWater && <WaterPlane />}
        <gridHelper args={[12,24,'#1a2744','#0f1a2e']} position={[0,-3.2,0]} />
        <OrbitControls enableDamping dampingFactor={0.05} minDistance={3} maxDistance={25} maxPolarAngle={Math.PI/2.1} target={[0,-1,0]} />
      </Canvas>
      <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(20,28,46,0.92)', backdropFilter: 'blur(12px)', borderRadius: '10px', border: '1px solid rgba(56,189,248,0.1)', padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <p style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>3D Layers</p>
        {[
          { k: 'pts', label: 'Bathy Photons', s: showPts, t: setShowPts },
          { k: 'surf', label: 'Surface Pts', s: showSurf, t: setShowSurf },
          { k: 'water', label: 'Water Plane', s: showWater, t: setShowWater },
        ].map(i => (
          <button key={i.k} onClick={() => i.t(!i.s)} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', fontSize: '10px', fontFamily: 'var(--font-mono)',
            background: i.s ? 'rgba(56,189,248,0.08)' : 'transparent', border: 'none', borderRadius: '4px',
            color: i.s ? 'var(--accent-cyan)' : 'var(--text-dim)', cursor: 'pointer',
          }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: i.s ? 'var(--accent-cyan)' : 'var(--text-dim)', opacity: i.s ? 1 : 0.3 }} />
            {i.label}
          </button>
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(20,28,46,0.8)', borderRadius: '8px', padding: '5px 12px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
        Drag to rotate · Scroll to zoom · Right-click to pan
      </div>
    </div>
  );
}
