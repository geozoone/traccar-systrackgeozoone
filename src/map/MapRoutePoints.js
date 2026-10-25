import { useId, useCallback, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { map } from './core/MapView';
import { formatTime, formatDistance } from '../common/util/formatter';
import { usePreference } from '../common/util/preferences';
import { resolveStreetAddress } from './main/MapDevicePopup';

const getCompassName = (course) => {
  if (course == null) return '-';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const idx = Math.round(((course %= 360) < 0 ? course + 360 : course) / 45) % 8;
  return dirs[idx];
};

const MapRoutePoints = ({ positions, onClick }) => {
  const id = useId();
  const pushpinLayerId = `${id}-pushpins`;
  const hours12 = usePreference('twelveHourFormat');
  const popupRef = useRef(null);

  const onMouseEnter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };
  const onMouseLeave = () => {
    map.getCanvas().style.cursor = '';
  };

  const onMarkerClick = useCallback(async (event) => {
    event.preventDefault();
    const feature = event.features && event.features[0];
    if (!feature) return;

    const p = feature.properties;
    const coords = feature.geometry.coordinates;

    if (onClick) {
      onClick(Number(p.id), Number(p.index));
    }

    if (popupRef.current) {
      popupRef.current.remove();
    }

    const popupNode = document.createElement('div');
    popupNode.style.fontFamily = 'Inter, Roboto, sans-serif';
    popupNode.style.padding = '0';
    popupNode.style.minWidth = '220px';
    popupNode.style.maxWidth = '290px';
    popupNode.style.fontSize = '12px';
    popupNode.style.color = '#1e293b';

    const formattedTime = p.fixTime ? formatTime(p.fixTime, 'seconds', hours12) : '-';
    const ignitionBadge = p.ignition === 'ON'
      ? '<span style="color:#10b981;font-weight:700;">🟢 Encendido</span>'
      : '<span style="color:#ef4444;font-weight:700;">🔴 Apagado</span>';

    popupNode.innerHTML = `
      <div style="background:linear-gradient(135deg, #1e293b, #0f172a); color:#fff; padding:8px 12px; border-radius:6px 6px 0 0; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:700; font-size:12px; letter-spacing:0.3px;">📍 Punto #${p.index} <span style="font-weight:400; font-size:11px; opacity:0.75;">/ ${p.total}</span></span>
        <span style="background:rgba(255,255,255,0.2); font-size:10px; padding:2px 6px; border-radius:10px; font-weight:600;">${p.speedKmh} km/h</span>
      </div>
      <div style="padding:10px 12px; background:#ffffff; border-radius:0 0 6px 6px; line-height:1.6;">
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f1f5f9; padding-bottom:4px; margin-bottom:4px;">
          <span style="color:#64748b;">🕒 Hora:</span>
          <span style="font-weight:600;">${formattedTime}</span>
        </div>
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f1f5f9; padding-bottom:4px; margin-bottom:4px;">
          <span style="color:#64748b;">🧭 Rumbo:</span>
          <span style="font-weight:600;">${p.course}° (${getCompassName(p.course)})</span>
        </div>
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f1f5f9; padding-bottom:4px; margin-bottom:4px;">
          <span style="color:#64748b;">🔑 Motor:</span>
          <span>${ignitionBadge}</span>
        </div>
        ${p.odometer ? `
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f1f5f9; padding-bottom:4px; margin-bottom:4px;">
          <span style="color:#64748b;">📏 Odómetro:</span>
          <span style="font-weight:600;">${formatDistance(p.odometer)}</span>
        </div>` : ''}
        <div style="margin-top:6px; font-size:11px; color:#475569; background:#f8fafc; padding:5px 8px; border-radius:4px; border:1px solid #e2e8f0;" id="opengts-addr-${p.id}">
          📍 ${p.address || 'Buscando dirección...'}
        </div>
      </div>
    `;

    const popup = new maplibregl.Popup({
      offset: [0, -10],
      closeButton: true,
      closeOnClick: false,
      maxWidth: '300px',
    })
      .setLngLat(coords)
      .setDOMContent(popupNode)
      .addTo(map);

    popupRef.current = popup;

    if (!p.address) {
      resolveStreetAddress(coords[1], coords[0]).then((resolvedAddr) => {
        const addrEl = document.getElementById(`opengts-addr-${p.id}`);
        if (addrEl && resolvedAddr) {
          addrEl.innerText = `📍 ${resolvedAddr}`;
        }
      });
    }
  }, [onClick, hours12]);

  useEffect(() => {
    map.addSource(id, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    map.addLayer({
      id: pushpinLayerId,
      type: 'symbol',
      source: id,
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': 0.75,
        'icon-rotate': ['get', 'course'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': false,
        'icon-ignore-placement': false,
      },
    });

    map.on('mouseenter', pushpinLayerId, onMouseEnter);
    map.on('mouseleave', pushpinLayerId, onMouseLeave);
    map.on('click', pushpinLayerId, onMarkerClick);

    return () => {
      if (popupRef.current) {
        popupRef.current.remove();
      }
      map.off('mouseenter', pushpinLayerId, onMouseEnter);
      map.off('mouseleave', pushpinLayerId, onMouseLeave);
      map.off('click', pushpinLayerId, onMarkerClick);

      if (map.getLayer(pushpinLayerId)) {
        map.removeLayer(pushpinLayerId);
      }
      if (map.getSource(id)) {
        map.removeSource(id);
      }
    };
  }, [pushpinLayerId, onMarkerClick]);

  useEffect(() => {
    if (!positions || !positions.length) {
      map.getSource(id)?.setData({
        type: 'FeatureCollection',
        features: [],
      });
      return;
    }

    const total = positions.length;
    const features = positions.map((pos, idx) => {
      const speedKmh = pos.speed != null ? Math.round(pos.speed * 1.852) : 0;
      let icon = 'pushpin-arrow-green';
      if (speedKmh === 0) {
        icon = 'pushpin-stop-red';
      } else if (speedKmh < 20) {
        icon = 'pushpin-arrow-yellow';
      }

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [pos.longitude, pos.latitude],
        },
        properties: {
          id: pos.id,
          index: idx + 1,
          total,
          speedKmh,
          course: pos.course || 0,
          icon,
          fixTime: pos.fixTime,
          ignition: pos.attributes?.ignition ? 'ON' : 'OFF',
          odometer: pos.attributes?.totalDistance || pos.attributes?.distance || null,
          address: pos.address || '',
        },
      };
    });

    map.getSource(id)?.setData({
      type: 'FeatureCollection',
      features,
    });
  }, [id, positions]);

  return null;
};

export default MapRoutePoints;
