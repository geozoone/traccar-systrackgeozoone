import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { map } from '../../map/core/MapView';

const SOURCE_ID = 'geozoone-ruler-source';
const LINE_LAYER_ID = 'geozoone-ruler-line';
const POINT_LAYER_ID = 'geozoone-ruler-points';

function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

class RulerButtonControl {
  constructor(onToggle) {
    this.onToggle = onToggle;
    this.active = false;
  }

  getDefaultPosition() {
    return 'top-right';
  }

  onAdd() {
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.title = 'Regla de Distancia (Medir kilómetros en el mapa)';
    this.button.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:15px;cursor:pointer;';
    this.button.innerText = '📐';
    this.button.onclick = () => this.onToggle();

    this.container.appendChild(this.button);
    return this.container;
  }

  setActive(isActive) {
    this.active = isActive;
    if (this.button) {
      this.button.style.backgroundColor = isActive ? '#0284c7' : '';
      this.button.style.color = isActive ? '#ffffff' : '';
    }
  }

  onRemove() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

const MapRulerControl = () => {
  const [active, setActive] = useState(false);
  const [points, setPoints] = useState([]);
  const controlRef = useRef(null);

  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const positions = useSelector((state) => state.session.positions);
  const selectedPosition = selectedDeviceId ? positions[selectedDeviceId] : null;

  const ensureLayers = useCallback(() => {
    if (!map || !map.getStyle()) return;
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }
    if (!map.getLayer(LINE_LAYER_ID)) {
      map.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        filter: ['==', '$type', 'LineString'],
        paint: {
          'line-color': '#0284c7',
          'line-width': 3,
          'line-dasharray': [2, 2],
        },
      });
    }
    if (!map.getLayer(POINT_LAYER_ID)) {
      map.addLayer({
        id: POINT_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 5,
          'circle-color': '#0284c7',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
    }
  }, []);

  const clearLayers = useCallback(() => {
    try {
      if (map.getLayer(POINT_LAYER_ID)) map.removeLayer(POINT_LAYER_ID);
      if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    } catch {}
  }, []);

  // Actualizar dibujo GeoJSON cuando cambian los puntos
  useEffect(() => {
    if (!active) {
      clearLayers();
      return;
    }

    ensureLayers();
    const source = map.getSource(SOURCE_ID);
    if (!source) return;

    const features = points.map((pt) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pt.lon, pt.lat] },
    }));

    if (points.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: points.map((pt) => [pt.lon, pt.lat]),
        },
      });
    }

    source.setData({ type: 'FeatureCollection', features });
  }, [active, points, ensureLayers, clearLayers]);

  // Escuchar clics en el mapa cuando la regla está activa
  useEffect(() => {
    if (!active) {
      map.getCanvas().style.cursor = '';
      return undefined;
    }

    map.getCanvas().style.cursor = 'crosshair';

    const handleMapClick = (e) => {
      const { lng, lat } = e.lngLat;
      setPoints((prev) => [...prev, { lat, lon: lng }]);
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
      map.getCanvas().style.cursor = '';
    };
  }, [active]);

  const handleToggle = useCallback(() => {
    setActive((prev) => {
      const next = !prev;
      if (controlRef.current) {
        controlRef.current.setActive(next);
      }
      if (next) {
        // Si hay un vehículo seleccionado con coordenadas, usarlo como Punto A inicial
        if (selectedPosition && selectedPosition.latitude != null && selectedPosition.longitude != null) {
          setPoints([{ lat: Number(selectedPosition.latitude), lon: Number(selectedPosition.longitude) }]);
        } else {
          setPoints([]);
        }
      } else {
        setPoints([]);
      }
      return next;
    });
  }, [selectedPosition]);

  // Registrar botón en la columna derecha del mapa
  useEffect(() => {
    const ctrl = new RulerButtonControl(handleToggle);
    controlRef.current = ctrl;
    map.addControl(ctrl, 'top-right');
    return () => {
      clearLayers();
      map.removeControl(ctrl);
    };
  }, [handleToggle, clearLayers]);

  if (!active) return null;

  // Calcular distancia total acumulada
  let totalKm = 0;
  for (let i = 1; i < points.length; i += 1) {
    totalKm += calculateHaversineKm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
  }

  const distanceText = totalKm >= 1
    ? `${totalKm.toFixed(2)} km`
    : `${Math.round(totalKm * 1000)} m`;
  const estMinutes = totalKm > 0 ? Math.max(1, Math.round(((totalKm * 1.25) / 40) * 60)) : 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: 68,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1300,
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        color: '#ffffff',
        padding: '6px 12px',
        borderRadius: '20px',
        boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '12px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <span>
        📐 {points.length < 2 ? 'Toca un punto en el mapa para medir' : `${distanceText} (~${estMinutes} min)`}
      </span>
      {points.length > 0 && (
        <button
          type="button"
          onClick={() => setPoints([])}
          style={{
            background: '#334155',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '2px 8px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          Reiniciar
        </button>
      )}
      <button
        type="button"
        onClick={handleToggle}
        style={{
          background: '#ef4444',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: 20,
          height: 20,
          fontSize: '11px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Cerrar regla"
      >
        ✕
      </button>
    </div>
  );
};

export default MapRulerControl;

