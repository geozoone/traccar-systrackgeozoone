import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import maplibregl from 'maplibre-gl';
import { map } from '../core/MapView';
import { devicesActions, sessionActions } from '../../store';
import { formatTime } from '../../common/util/formatter';
import { usePreference } from '../../common/util/preferences';

// Función para resolver la dirección de calle usando Traccar o fallback a OpenStreetMap Nominatim
async function resolveStreetAddress(lat, lon) {
  // 1. Probar primero con el endpoint interno de Traccar
  try {
    const resTraccar = await fetch(`/api/server/geocode?latitude=${lat}&longitude=${lon}`);
    if (resTraccar.ok) {
      const text = await resTraccar.text();
      if (text && text.trim().length > 0 && !text.toLowerCase().includes('error')) {
        return text.trim();
      }
    }
  } catch (e) {
    // Continuar a fallback
  }

  // 2. Fallback directo a OpenStreetMap (Nominatim en español)
  try {
    const resOsm = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'es' } }
    );
    if (resOsm.ok) {
      const data = await resOsm.json();
      if (data && data.address) {
        const a = data.address;
        const street = a.road || a.pedestrian || a.street || a.highway || a.path || '';
        const number = a.house_number ? ` ${a.house_number}` : '';
        const district = a.suburb || a.neighbourhood || a.city_district || a.village || a.town || '';
        const city = a.city || a.county || a.state || '';

        const parts = [
          street ? `${street}${number}` : '',
          district,
          city,
        ].filter(Boolean);

        if (parts.length > 0) {
          return parts.join(', ');
        }
      }
      if (data.display_name) {
        return data.display_name.split(',').slice(0, 3).join(', ');
      }
    }
  } catch (e) {
    console.warn('No se pudo resolver la dirección:', e.message);
  }

  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

const MapDevicePopup = ({ onOpenDetails }) => {
  const dispatch = useDispatch();
  const popupRef = useRef(null);
  const addressCache = useRef(new Map());

  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const hours12 = usePreference('twelveHourFormat');

  const selectedDevice = devices[selectedDeviceId];
  const selectedPosition = positions[selectedDeviceId];

  // Cerrar el popup y deseleccionar vehículo
  const handleClose = () => {
    dispatch(devicesActions.selectId(null));
  };

  // Cargar rastro de 10 puntos estilo OpenGTS
  const handleLoadTrail = () => {
    if (!selectedDeviceId) return;
    const from = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const to = new Date().toISOString();
    fetch(`/api/positions?deviceId=${selectedDeviceId}&from=${from}&to=${to}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((items) => {
        if (items && items.length > 0) {
          const coordinates = items.slice(-10).map((p) => [p.longitude, p.latitude]);
          dispatch(sessionActions.setHistory({ deviceId: selectedDeviceId, coordinates }));
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    // Si no hay vehículo seleccionado o no tiene posición, eliminar popup
    if (!selectedDeviceId || !selectedDevice || !selectedPosition) {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      return;
    }

    const { latitude, longitude } = selectedPosition;
    const lngLat = [longitude, latitude];
    const coordKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;

    const speedKmh = selectedPosition.speed != null ? Math.round(selectedPosition.speed * 1.852) : 0;
    const ignition = selectedPosition.attributes?.ignition;
    const empresa = selectedDevice.attributes?.empresa
      || selectedDevice.attributes?.informacoes?.empresa
      || '';
    const battery = selectedPosition.attributes?.batteryLevel != null
      ? `${selectedPosition.attributes.batteryLevel}%`
      : (selectedPosition.attributes?.battery ? `${selectedPosition.attributes.battery}V` : null);
    const power = selectedPosition.attributes?.power != null
      ? `${Number(selectedPosition.attributes.power).toFixed(1)}V`
      : null;
    const totalDistance = selectedPosition.attributes?.totalDistance != null
      ? `${Math.round(selectedPosition.attributes.totalDistance / 1000).toLocaleString()} km`
      : null;
    const timeFormatted = formatTime(selectedPosition.fixTime, 'seconds', hours12);

    // Determinar la dirección inicial o si hay que resolverla
    let initialAddress = selectedPosition.address || addressCache.current.get(coordKey) || '';

    // Construir contenido HTML estilizado para el globo flotante
    const container = document.createElement('div');
    container.className = 'geozoone-pushpin-balloon';
    container.style.cssText = `
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 10px 12px;
      min-width: 270px;
      max-width: 330px;
      color: #1e293b;
      font-size: 13px;
      line-height: 1.4;
    `;

    const statusBadge = speedKmh > 0
      ? `<span style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 9999px; font-weight: 600; font-size: 11px;">En movimiento (${speedKmh} km/h)</span>`
      : `<span style="background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 9999px; font-weight: 600; font-size: 11px;">Detenido</span>`;

    const ignitionBadge = ignition === true
      ? `<span style="color: #16a34a; font-weight: 600;">🟢 ON</span>`
      : (ignition === false ? `<span style="color: #dc2626; font-weight: 600;">🔴 OFF</span>` : `<span style="color: #64748b;">N/D</span>`);

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
        <div>
          <div style="font-weight: 700; font-size: 15px; color: #0f172a; display: flex; align-items: center; gap: 4px;">
            <span>🚛</span> ${selectedDevice.name}
          </div>
          ${empresa ? `<div style="font-size: 11px; color: #64748b; font-weight: 500;">${empresa}</div>` : ''}
        </div>
        <div>${statusBadge}</div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 8px; font-size: 12px; background: #f8fafc; padding: 6px; border-radius: 6px;">
        <div><strong>Motor:</strong> ${ignitionBadge}</div>
        <div><strong>Velocidad:</strong> ${speedKmh} km/h</div>
        ${totalDistance ? `<div><strong>Odómetro:</strong> ${totalDistance}</div>` : ''}
        ${power ? `<div><strong>Voltaje:</strong> ${power}</div>` : (battery ? `<div><strong>Batería:</strong> ${battery}</div>` : '')}
      </div>

      <div style="font-size: 11.5px; color: #334155; margin-bottom: 5px; line-height: 1.35;">
        <strong>📍 Dirección:</strong> <span id="popup-address-text" style="color: #0369a1; font-weight: 500;">${initialAddress || 'Obteniendo dirección...'}</span>
      </div>
      <div style="font-size: 11px; color: #64748b; margin-bottom: 10px;">
        <strong>🕒 Reporte:</strong> ${timeFormatted}
      </div>

      <div style="display: flex; gap: 6px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
        <button id="btn-trail-10" style="
          flex: 1;
          background: #0284c7;
          color: white;
          border: none;
          padding: 6px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        ">
          🗺️ Rastro 10 pts
        </button>
        <button id="btn-open-details" style="
          flex: 1;
          background: #f1f5f9;
          color: #334155;
          border: 1px solid #cbd5e1;
          padding: 6px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
        ">
          📋 Ficha Completa
        </button>
      </div>
    `;

    // Si la dirección aún no estaba resuelta, obtenerla en segundo plano
    if (!initialAddress) {
      resolveStreetAddress(latitude, longitude).then((resolved) => {
        if (resolved) {
          addressCache.current.set(coordKey, resolved);
          const addressEl = container.querySelector('#popup-address-text');
          if (addressEl) {
            addressEl.textContent = resolved;
          }
        }
      });
    }

    // Asignar eventos a los botones dentro del DOM del Popup
    const btnTrail = container.querySelector('#btn-trail-10');
    if (btnTrail) {
      btnTrail.onclick = (e) => {
        e.stopPropagation();
        handleLoadTrail();
        btnTrail.textContent = '✓ Rastro Cargado';
        setTimeout(() => { btnTrail.textContent = '🗺️ Rastro 10 pts'; }, 1500);
      };
    }

    const btnDetails = container.querySelector('#btn-open-details');
    if (btnDetails) {
      btnDetails.onclick = (e) => {
        e.stopPropagation();
        if (onOpenDetails) onOpenDetails();
      };
    }

    // Si ya existe el popup, actualizamos su posición y contenido
    if (popupRef.current) {
      popupRef.current.setLngLat(lngLat).setDOMContent(container);
    } else {
      // Crear nuevo popup anclado sobre el pushpin
      const popup = new maplibregl.Popup({
        offset: [0, -26],
        closeButton: true,
        closeOnClick: true,
        maxWidth: '350px',
        className: 'geozoone-custom-popup',
      })
        .setLngLat(lngLat)
        .setDOMContent(container)
        .addTo(map);

      popup.on('close', () => {
        popupRef.current = null;
        handleClose();
      });

      popupRef.current = popup;
    }
  }, [selectedDeviceId, selectedDevice, selectedPosition, hours12]);

  // Limpiar popup al desmontar
  useEffect(() => () => {
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  }, []);

  return null;
};

export default MapDevicePopup;
