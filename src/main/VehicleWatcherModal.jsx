import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Typography,
  Box,
  Chip,
  IconButton,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SpeedIcon from '@mui/icons-material/Speed';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HubIcon from '@mui/icons-material/Hub';

import {
  getContainingGeofencesSorted,
  calculateGeofenceArea,
  isPositionInGeofence,
} from './voiceAssistantUtil';
import { speedFromKnots } from '../common/util/converter';

const VehicleWatcherModal = () => {
  const [open, setOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [eventType, setEventType] = useState('DEPARTURE'); // 'DEPARTURE', 'ARRIVAL', 'TWO_PHASE', 'MOTION'
  const [targetGeofenceId, setTargetGeofenceId] = useState('');

  const user = useSelector((state) => state.session.user);
  const devicesMap = useSelector((state) => state.devices.items || {});
  const positionsMap = useSelector((state) => state.session.positions || {});
  const geofencesMap = useSelector((state) => state.geofences.items || {});

  // Sandbox guard
  const isAuthorized = Boolean(
    user?.administrator
    || user?.attributes?.voiceBeta === true
    || user?.id === 2
    || user?.email?.toLowerCase() === 'dyd@dydtransportes.com'
    || user?.name?.toLowerCase().includes('durand'),
  );

  const device = devicesMap[selectedDeviceId] || null;
  const position = positionsMap[selectedDeviceId] || null;
  const geofenceList = useMemo(() => Object.values(geofencesMap), [geofencesMap]);

  // Geocercas en las que el vehículo se encuentra actualmente (de menor a mayor superficie)
  const currentInsideGeos = useMemo(() => {
    if (!position || !geofenceList.length) return [];
    return getContainingGeofencesSorted(position, geofenceList);
  }, [position, geofenceList]);

  const isCurrentlyInside = currentInsideGeos.length > 0;
  const currentPrimaryGeo = isCurrentlyInside ? currentInsideGeos[0] : null;

  // Escuchar el evento de clic derecho en el pushpin
  useEffect(() => {
    if (!isAuthorized) return;

    const handleOpen = (e) => {
      const devId = e.detail?.deviceId;
      if (!devId) return;

      setSelectedDeviceId(devId);
      const pos = positionsMap[devId];
      const insideGeos = getContainingGeofencesSorted(pos, geofenceList);

      if (insideGeos.length > 0) {
        setEventType('DEPARTURE');
        setTargetGeofenceId(insideGeos[0].id);
      } else {
        setEventType('ARRIVAL');
        if (geofenceList.length > 0) {
          setTargetGeofenceId(geofenceList[0].id);
        }
      }

      setOpen(true);
    };

    window.addEventListener('geozoone-open-watcher-modal', handleOpen);
    return () => window.removeEventListener('geozoone-open-watcher-modal', handleOpen);
  }, [isAuthorized, positionsMap, geofenceList]);

  if (!isAuthorized || !device) return null;

  const targetGeofence = geofencesMap[targetGeofenceId] || null;
  const speedKmh = position ? Math.round(speedFromKnots(position.speed || 0, 'kmh')) : 0;
  const ignition = Boolean(position?.attributes?.ignition);

  // Identificar posible macro-geocerca para Vigilancia Escalonada en 2 fases
  const findMacroZoneForGeofence = (baseGeo) => {
    if (!baseGeo) return null;
    const baseArea = calculateGeofenceArea(baseGeo);
    // Buscar geocercas que contengan el centroide o que sean de mayor tamaño
    const largerGeos = geofenceList.filter((g) => g.id !== baseGeo.id && calculateGeofenceArea(g) > baseArea * 1.5);
    // Si hay alguna con nombre relacionado (ej. "Zona ...")
    const matchName = largerGeos.find((g) => g.name.toLowerCase().includes(baseGeo.name.toLowerCase()) || baseGeo.name.toLowerCase().includes(g.name.toLowerCase()));
    return matchName || (largerGeos.length > 0 ? largerGeos[0] : null);
  };

  const handleActivateWatcher = () => {
    let confirmationSpeech = '';
    const macroGeo = eventType === 'TWO_PHASE' ? findMacroZoneForGeofence(targetGeofence) : null;

    if (eventType === 'DEPARTURE') {
      confirmationSpeech = `Listo. He programado la alerta. Te avisaré inmediatamente cuando el móvil ${device.name} salga de ${targetGeofence?.name || 'la geocerca'}.`;
    } else if (eventType === 'ARRIVAL') {
      confirmationSpeech = `Entendido. Te avisaré tan pronto el móvil ${device.name} ingrese a ${targetGeofence?.name || 'la geocerca'}.`;
    } else if (eventType === 'TWO_PHASE') {
      const macroName = macroGeo?.name || 'su zona colindante';
      confirmationSpeech = `Vigilancia escalonada activada para el móvil ${device.name}. Te avisaré primero al ingresar a ${macroName} y luego al entrar al almacén ${targetGeofence?.name}.`;
    } else if (eventType === 'MOTION') {
      confirmationSpeech = `Perfecto. Vigilaré el móvil ${device.name}. Te avisaré en cuanto encienda el motor o inicie movimiento.`;
    }

    const newWatcher = {
      id: `watch_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type: eventType,
      deviceId: device.id,
      deviceName: device.name,
      geofenceId: targetGeofence?.id || null,
      geofenceName: targetGeofence?.name || null,
      macroGeofenceId: macroGeo?.id || null,
      macroGeofenceName: macroGeo?.name || null,
      stage: 0,
      createdAt: Date.now(),
      triggered: false,
      confirmationSpeech,
    };

    window.dispatchEvent(new CustomEvent('geozoone-add-watcher', { detail: newWatcher }));
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          p: 1,
          boxShadow: '0 20px 45px rgba(0,0,0,0.22)',
          border: '1px solid #e2e8f0',
        },
      }}
    >
      <DialogTitle sx={{ m: 0, p: 1.5, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NotificationsActiveIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
            Vigilar {device.name}
          </Typography>
        </Box>
        <IconButton size="small" onClick={() => setOpen(false)}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2, pt: 1 }}>
        {/* Ficha rápida de estado actual del vehículo */}
        <Box sx={{ mb: 2, p: 1.5, backgroundColor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block', mb: 0.5 }}>
            ESTADO ACTUAL DEL VEHÍCULO:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            {isCurrentlyInside ? (
              <Chip
                size="small"
                icon={<LocationOnIcon style={{ fontSize: '0.85rem' }} />}
                label={`Dentro de: ${currentPrimaryGeo.name}`}
                color="success"
                sx={{ fontWeight: 700, fontSize: '0.75rem' }}
              />
            ) : (
              <Chip
                size="small"
                icon={<SpeedIcon style={{ fontSize: '0.85rem' }} />}
                label={speedKmh > 1 ? `En ruta a ${speedKmh} km/h` : ignition ? 'Ralentí (Motor encendido)' : 'Estacionado'}
                color={speedKmh > 1 ? 'info' : 'default'}
                sx={{ fontWeight: 600, fontSize: '0.75rem' }}
              />
            )}
            {currentInsideGeos.length > 1 && (
              <Chip
                size="small"
                icon={<HubIcon style={{ fontSize: '0.85rem' }} />}
                label={`En ${currentInsideGeos.length} geocercas concéntricas`}
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            )}
          </Box>
        </Box>

        {/* LISTA DESPLEGABLE 1: ACCIÓN / TIPO DE VIGILANCIA */}
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel id="watcher-event-label" sx={{ fontWeight: 600 }}>1. ¿Qué evento deseas vigilar?</InputLabel>
          <Select
            labelId="watcher-event-label"
            value={eventType}
            label="1. ¿Qué evento deseas vigilar?"
            onChange={(e) => setEventType(e.target.value)}
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            <MenuItem value="DEPARTURE">
              🚪 Avisarme al Salir de la Geocerca {isCurrentlyInside ? '(Recomendado)' : ''}
            </MenuItem>
            <MenuItem value="ARRIVAL">
              🏁 Avisarme al Llegar a la Geocerca {!isCurrentlyInside ? '(Recomendado)' : ''}
            </MenuItem>
            <MenuItem value="TWO_PHASE">
              🎯 Vigilancia Escalonada (Aproximación + Rampa 2 Fases)
            </MenuItem>
            <MenuItem value="MOTION">
              ⚡ Avisarme si Inicia Movimiento / Enciende Motor
            </MenuItem>
          </Select>
        </FormControl>

        {/* LISTA DESPLEGABLE 2: GEOCERCA OBJETIVO */}
        {eventType !== 'MOTION' && (
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel id="watcher-geofence-label" sx={{ fontWeight: 600 }}>2. Selecciona la Geocerca</InputLabel>
            <Select
              labelId="watcher-geofence-label"
              value={targetGeofenceId}
              label="2. Selecciona la Geocerca"
              onChange={(e) => setTargetGeofenceId(e.target.value)}
              sx={{ borderRadius: 2, fontWeight: 600 }}
            >
              {geofenceList.map((geo) => {
                const isInsideThis = isPositionInGeofence(position, geo);
                return (
                  <MenuItem key={geo.id} value={geo.id}>
                    {geo.name} {isInsideThis ? '📍 (Ubicación Actual)' : ''}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        )}

        {/* Resumen explicativo */}
        <Alert severity="info" sx={{ py: 0.5, fontSize: '0.78rem', borderRadius: 2 }}>
          {eventType === 'DEPARTURE' && (
            <span>GeoZoone Voice emitirá un timbre y hablará por voz en cuanto <strong>{device.name}</strong> cruce el perímetro hacia afuera de <strong>{targetGeofence?.name || 'la geocerca'}</strong>.</span>
          )}
          {eventType === 'ARRIVAL' && (
            <span>Se notificará inmediatamente cuando <strong>{device.name}</strong> entre en el radio de <strong>{targetGeofence?.name || 'la geocerca'}</strong>.</span>
          )}
          {eventType === 'TWO_PHASE' && (
            <span>Recibirás dos avisos consecutivos: 1° al entrar a la zona de aproximación y 2° al ingresar exactamente a la rampa de <strong>{targetGeofence?.name || 'la geocerca'}</strong>.</span>
          )}
          {eventType === 'MOTION' && (
            <span>Recibirás una alerta en cuanto <strong>{device.name}</strong> encienda el contacto o supere 3 km/h.</span>
          )}
        </Alert>
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
        <Button
          onClick={() => setOpen(false)}
          color="inherit"
          size="small"
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleActivateWatcher}
          variant="contained"
          color="primary"
          size="small"
          startIcon={<CheckCircleOutlineIcon />}
          disabled={eventType !== 'MOTION' && !targetGeofenceId}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, px: 2 }}
        >
          Activar Vigilancia
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VehicleWatcherModal;
