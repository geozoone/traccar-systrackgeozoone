import { useEffect } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import dimensions from '../../common/theme/dimensions';
import { map } from '../core/MapView';
import { usePrevious } from '../../reactHelper';
import { useAttributePreference } from '../../common/util/preferences';
import { sessionActions } from '../../store';

const MapSelectedDevice = () => {
  const dispatch = useDispatch();
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const previousDeviceId = usePrevious(selectedDeviceId);

  const selectZoom = useAttributePreference('web.selectZoom', 10);
  const mapFollow = useAttributePreference('mapFollow', false);
  const liveRoutesLimit = useAttributePreference('web.liveRouteLength', 10);

  const position = useSelector((state) => state.session.positions[selectedDeviceId]);

  // Centrar mapa al seleccionar el dispositivo
  useEffect(() => {
    if ((selectedDeviceId !== previousDeviceId || mapFollow) && position) {
      map.easeTo({
        center: [position.longitude, position.latitude],
        zoom: Math.max(map.getZoom(), selectZoom),
        offset: [0, -dimensions.popupMapOffset / 2],
      });
    }
  });

  // Carga inmediata de los últimos 10 puntos (estilo OpenGTS) al hacer clic en el vehículo
  useEffect(() => {
    if (selectedDeviceId && selectedDeviceId !== previousDeviceId) {
      const from = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const to = new Date().toISOString();
      fetch(`/api/positions?deviceId=${selectedDeviceId}&from=${from}&to=${to}`)
        .then((response) => (response.ok ? response.json() : []))
        .then((items) => {
          if (items && items.length > 0) {
            const limit = Number(liveRoutesLimit) || 10;
            const coordinates = items.slice(-limit).map((p) => [p.longitude, p.latitude]);
            dispatch(sessionActions.setHistory({ deviceId: selectedDeviceId, coordinates }));
          }
        })
        .catch(() => {});
    }
  }, [selectedDeviceId, previousDeviceId, liveRoutesLimit, dispatch]);

  return null;
};

export default MapSelectedDevice;
