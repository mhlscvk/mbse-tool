import React from 'react';
import { useTheme } from '../../store/theme.js';

export default function GeometryRenderer() {
  const t = useTheme();

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#f8f8ff',
    }}>
      {/* Wireframe cube icon */}
      <svg width={120} height={120} viewBox="0 0 120 120" style={{ marginBottom: 16, opacity: 0.5 }}>
        {/* Front face */}
        <rect x={20} y={40} width={60} height={60} fill="none" stroke="#8aa0c0" strokeWidth={1.5} />
        {/* Back face */}
        <rect x={40} y={20} width={60} height={60} fill="none" stroke="#8aa0c0" strokeWidth={1.5} />
        {/* Connecting lines */}
        <line x1={20} y1={40} x2={40} y2={20} stroke="#8aa0c0" strokeWidth={1.5} />
        <line x1={80} y1={40} x2={100} y2={20} stroke="#8aa0c0" strokeWidth={1.5} />
        <line x1={80} y1={100} x2={100} y2={80} stroke="#8aa0c0" strokeWidth={1.5} />
        <line x1={20} y1={100} x2={40} y2={80} stroke="#8aa0c0" strokeWidth={1.5} strokeDasharray="4,3" />
      </svg>
      <div style={{ color: '#4a6a8a', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
        Geometry View
      </div>
      <div style={{ color: '#aaa', fontSize: 12, textAlign: 'center', maxWidth: 320, lineHeight: 1.6 }}>
        3D spatial visualization of physical items with shapes, coordinate frames, and quantity features.
        <br /><br />
        This view will be available in a future release.
      </div>
    </div>
  );
}
