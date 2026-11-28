import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const getInitialGeometry = () => {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const isMobile = vw < 768;
  const width = isMobile ? Math.min(vw - 20, 360) : 440;
  const height = isMobile ? 250 : 330;
  return {
    x: Math.max(10, vw - width - (isMobile ? 10 : 20)),
    y: Math.max(60, vh - height - (isMobile ? 70 : 24)),
    width,
    height,
  };
};

const FloatingStreetView = ({
  open,
  onClose,
  deviceName,
  course,
  embedUrl,
  fullUrl,
  address,
  lat,
  lon,
}) => {
  const [geom, setGeom] = useState(getInitialGeometry);
  const [minimized, setMinimized] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  const interactionRef = useRef(null); // { mode: 'drag'|'resize', startX, startY, origX, origY, origW, origH }

  // Al abrir de nuevo, asegurar que quede dentro de la pantalla
  useEffect(() => {
    if (!open) return;
    setMinimized(false);
    setGeom((prev) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = Math.min(prev.width, vw - 20);
      const h = Math.min(prev.height, vh - 80);
      return {
        x: Math.min(Math.max(10, prev.x), Math.max(10, vw - w - 10)),
        y: Math.min(Math.max(10, prev.y), Math.max(10, vh - h - 10)),
        width: w,
        height: h,
      };
    });
  }, [open]);

  useEffect(() => {
    const handlePointerMove = (e) => {
      const state = interactionRef.current;
      if (!state) return;

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      if (state.mode === 'drag') {
        const nextX = Math.min(Math.max(6, state.origX + dx), Math.max(6, vw - state.origW - 6));
        const nextY = Math.min(Math.max(6, state.origY + dy), Math.max(6, vh - 46));
        setGeom((prev) => ({ ...prev, x: nextX, y: nextY }));
      } else if (state.mode === 'resize') {
        const nextW = Math.min(Math.max(260, state.origW + dx), vw - state.origX - 10);
        const nextH = Math.min(Math.max(190, state.origH + dy), vh - state.origY - 10);
        setGeom((prev) => ({ ...prev, width: nextW, height: nextH }));
      }
    };

    const handlePointerUp = () => {
      if (interactionRef.current) {
        interactionRef.current = null;
        setIsInteracting(false);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const startDrag = (e) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    e.preventDefault();
    interactionRef.current = {
      mode: 'drag',
      startX: e.clientX,
      startY: e.clientY,
      origX: geom.x,
      origY: geom.y,
      origW: minimized ? 280 : geom.width,
      origH: minimized ? 42 : geom.height,
    };
    setIsInteracting(true);
  };

  const startResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    interactionRef.current = {
      mode: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      origX: geom.x,
      origY: geom.y,
      origW: geom.width,
      origH: geom.height,
    };
    setIsInteracting(true);
  };

  const applyPreset = (targetW, targetH) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(targetW, vw - 20);
    const h = Math.min(targetH, vh - 80);
    setMinimized(false);
    setGeom((prev) => ({
      x: Math.min(Math.max(10, prev.x), Math.max(10, vw - w - 10)),
      y: Math.min(Math.max(10, prev.y), Math.max(10, vh - h - 10)),
      width: w,
      height: h,
    }));
  };

  const miniBtnStyle = {
    background: 'rgba(255,255,255,0.12)',
    color: '#e2e8f0',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    lineHeight: 1.2,
  };

  return createPortal(
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate3d(${Math.round(geom.x)}px, ${Math.round(geom.y)}px, 0)`,
        width: minimized ? '290px' : `${Math.round(geom.width)}px`,
        height: minimized ? 'auto' : `${Math.round(geom.height)}px`,
        zIndex: 1350,
        backgroundColor: '#0f172a',
        borderRadius: '10px',
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.35)',
        border: '1px solid rgba(56, 189, 248, 0.55)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        isolation: 'isolate',
        backfaceVisibility: 'hidden',
        willChange: isInteracting ? 'transform' : 'auto',
        userSelect: isInteracting ? 'none' : 'auto',
      }}
    >
      {/* Barra superior arrastrable */}
      <div
        onPointerDown={startDrag}
        style={{
          backgroundColor: '#0f172a',
          color: '#ffffff',
          padding: '7px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          cursor: isInteracting ? 'grabbing' : 'grab',
          touchAction: 'none',
          borderBottom: minimized ? 'none' : '1px solid #1e293b',
        }}
        title="Arrastra desde aquí para mover la ventana sobre el mapa"
      >
        <div
          style={{
            fontSize: '12px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
          }}
        >
          🧍 {deviceName} {!minimized && `(${course}°)`}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {!minimized && (
            <>
              <button type="button" style={miniBtnStyle} onClick={() => applyPreset(320, 230)} title="Tamaño pequeño (S)">
                S
              </button>
              <button type="button" style={miniBtnStyle} onClick={() => applyPreset(460, 350)} title="Tamaño mediano (M)">
                M
              </button>
              <button type="button" style={miniBtnStyle} onClick={() => applyPreset(700, 490)} title="Tamaño grande (L)">
                L
              </button>
              <a
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...miniBtnStyle,
                  color: '#38bdf8',
                  borderColor: 'rgba(56,189,248,0.45)',
                  textDecoration: 'none',
                }}
                title="Abrir en Google Maps en nueva pestaña"
              >
                ↗
              </a>
            </>
          )}
          <button
            type="button"
            style={miniBtnStyle}
            onClick={() => setMinimized((m) => !m)}
            title={minimized ? 'Restaurar vista Street View' : 'Minimizar a barra compacta'}
          >
            {minimized ? '▢' : '—'}
          </button>
          <button
            type="button"
            style={{
              ...miniBtnStyle,
              background: 'rgba(220, 38, 38, 0.8)',
              borderColor: 'rgba(248, 113, 113, 0.6)',
              color: '#fff',
            }}
            onClick={onClose}
            title="Cerrar Street View"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Cuerpo Street View 360° */}
      {!minimized && (
        <>
          <div style={{ flex: 1, position: 'relative', backgroundColor: '#000' }}>
            <iframe
              title={`Street View ${deviceName}`}
              src={embedUrl}
              width="100%"
              height="100%"
              style={{
                border: 0,
                display: 'block',
                visibility: isInteracting ? 'hidden' : 'visible',
              }}
              allowFullScreen
              loading="lazy"
            />
            {isInteracting && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: '#0f172a',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                Moviendo vista 360°...
              </div>
            )}
          </div>

          {/* Pie con dirección + tirador de redimensión */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              color: '#334155',
              padding: '5px 24px 5px 10px',
              fontSize: '11px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              position: 'relative',
              borderTop: '1px solid #e2e8f0',
            }}
          >
            📍 {address || `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}`}

            {/* Esquina arrastrable para redimensionar */}
            <div
              onPointerDown={startResize}
              title="Arrastra para cambiar el tamaño"
              style={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                width: '22px',
                height: '22px',
                cursor: 'nwse-resize',
                touchAction: 'none',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'flex-end',
                padding: '3px',
                color: '#64748b',
                fontSize: '12px',
                lineHeight: 1,
                fontWeight: 900,
              }}
            >
              ◢
            </div>
          </div>
        </>
      )}
    </div>,
    document.body
  );
};

export default FloatingStreetView;

