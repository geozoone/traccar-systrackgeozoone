import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import dayjs from 'dayjs';
import {
  Fab,
  Tooltip,
  Paper,
  Typography,
  Box,
  IconButton,
  Slide,
  Chip,
  Button,
  TextField,
  InputAdornment,
  Alert,
  LinearProgress,
} from '@mui/material';
import { makeStyles } from '@mui/styles';
import MicIcon from '@mui/icons-material/Mic';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import CloseIcon from '@mui/icons-material/Close';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ReplayIcon from '@mui/icons-material/Replay';
import SendIcon from '@mui/icons-material/Send';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';

import { devicesActions, geofencesActions } from '../store';
import { speedFromKnots } from '../common/util/converter';
import { resolveStreetAddress } from '../map/main/MapDevicePopup';

const useStyles = makeStyles((theme) => ({
  fabContainer: {
    position: 'fixed',
    right: 24,
    bottom: 32,
    zIndex: 1200,
    [theme.breakpoints.down('md')]: {
      bottom: 84,
      right: 18,
    },
  },
  pulseFab: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    boxShadow: '0 8px 24px rgba(59, 130, 246, 0.45)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      backgroundColor: '#2563eb',
      transform: 'scale(1.06)',
    },
  },
  listeningFab: {
    backgroundColor: '#ef4444 !important',
    color: '#ffffff',
    animation: '$pulseRing 1.4s infinite cubic-bezier(0.4, 0, 0.6, 1)',
    boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.7)',
  },
  speakingFab: {
    backgroundColor: '#10b981 !important',
    color: '#ffffff',
    boxShadow: '0 8px 24px rgba(16, 185, 129, 0.45)',
  },
  watchingFab: {
    backgroundColor: '#f59e0b !important',
    color: '#ffffff',
    boxShadow: '0 8px 24px rgba(245, 158, 11, 0.45)',
  },
  '@keyframes pulseRing': {
    '0%': {
      boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.7)',
      transform: 'scale(1)',
    },
    '50%': {
      boxShadow: '0 0 0 16px rgba(239, 68, 68, 0)',
      transform: 'scale(1.08)',
    },
    '100%': {
      boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)',
      transform: 'scale(1)',
    },
  },
  dialogCard: {
    position: 'fixed',
    right: 24,
    bottom: 104,
    width: 430,
    maxWidth: 'calc(100vw - 48px)',
    borderRadius: 16,
    padding: theme.spacing(2.2),
    zIndex: 1201,
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.18)',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    [theme.breakpoints.down('md')]: {
      bottom: 156,
      right: 18,
    },
  },
}));

// Normalizar texto eliminando tildes y caracteres especiales
const normalizeText = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Formato de fecha y hora natural para voz hablada
const formatSpokenDateTime = (timestamp) => {
  if (!timestamp) return '';
  try {
    const date = dayjs(timestamp);
    const now = dayjs();
    const diffMinutes = now.diff(date, 'minute');
    const diffHours = now.diff(date, 'hour');
    const timeFormatted = date.format('h:mm A');

    if (diffMinutes < 2) {
      return `hace un momento a las ${timeFormatted}`;
    }
    if (diffMinutes < 60) {
      return `hace ${diffMinutes} minutos, a las ${timeFormatted}`;
    }
    if (now.isSame(date, 'day')) {
      return `hoy a las ${timeFormatted} (hace ${diffHours} horas)`;
    }
    if (now.subtract(1, 'day').isSame(date, 'day')) {
      return `ayer a las ${timeFormatted}`;
    }
    return `el ${date.format('D [de] MMMM [a las] h:mm A')}`;
  } catch (e) {
    return '';
  }
};

// Convertir rumbo en grados a dirección cardinal en español
const getCardinalDirection = (course) => {
  if (course == null) return '';
  const directions = [
    'hacia el norte',
    'hacia el noreste',
    'hacia el este',
    'hacia el sureste',
    'hacia el sur',
    'hacia el suroeste',
    'hacia el oeste',
    'hacia el noroeste',
  ];
  const index = Math.round(course / 45) % 8;
  return directions[index];
};

// Tocar timbre/chime sonoro nativo con Web Audio API (0 costo, 100% offline)
const playNotificationChime = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Acorde de atención: D5 (587 Hz) -> A5 (880 Hz)
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.65);
  } catch (e) {
    console.warn('Audio chime error:', e);
  }
};

// Algoritmo matemático para comprobar si un punto (lat, lon) está dentro de una geocerca
const isPositionInGeofence = (pos, geo) => {
  if (!pos || !geo) return false;

  // 1. Si Traccar ya lo tiene emparejado en geofenceIds
  if (Array.isArray(pos.geofenceIds) && pos.geofenceIds.includes(geo.id)) {
    return true;
  }

  const lat = pos.latitude;
  const lon = pos.longitude;
  if (lat == null || lon == null || !geo.area) return false;

  const area = geo.area.trim();

  // 2. Geocerca tipo CÍRCULO: CIRCLE (lat, lon, radio_en_metros)
  if (area.startsWith('CIRCLE')) {
    try {
      const raw = area.replace(/CIRCLE|\(|\)|,/g, ' ').trim().split(/\s+/);
      if (raw.length >= 3) {
        const cLat = Number(raw[0]);
        const cLon = Number(raw[1]);
        const radius = Number(raw[2]);
        if (!isNaN(cLat) && !isNaN(cLon) && !isNaN(radius)) {
          const R = 6371000;
          const dLat = ((cLat - lat) * Math.PI) / 180;
          const dLon = ((cLon - lon) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
            + Math.cos((lat * Math.PI) / 180) * Math.cos((cLat * Math.PI) / 180)
            * Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return (R * c) <= (radius + 20); // +20 metros de tolerancia GPS
        }
      }
    } catch (e) {
      console.warn('Error evaluating circle geofence:', e);
    }
  }

  // 3. Geocerca tipo POLÍGONO: POLYGON ((lon lat, lon lat, ...))
  if (area.startsWith('POLYGON')) {
    try {
      const coordStr = area.replace(/POLYGON|\(|\)/g, ' ').trim();
      const pairs = coordStr.split(',').map((p) => p.trim().split(/\s+/));
      const vs = pairs.map((p) => [Number(p[0]), Number(p[1])]).filter((p) => !isNaN(p[0]) && !isNaN(p[1]));

      if (vs.length >= 3) {
        const x = lon;
        const y = lat;
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
          const xi = vs[i][0];
          const yi = vs[i][1];
          const xj = vs[j][0];
          const yj = vs[j][1];
          const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
        return inside;
      }
    } catch (e) {
      console.warn('Error evaluating polygon geofence:', e);
    }
  }

  return false;
};

const VoiceAssistantFab = () => {
  const classes = useStyles();
  const dispatch = useDispatch();

  const user = useSelector((state) => state.session.user);
  const devicesMap = useSelector((state) => state.devices.items || {});
  const positionsMap = useSelector((state) => state.session.positions || {});
  const geofencesMap = useSelector((state) => state.geofences.items || {});
  const driversMap = useSelector((state) => state.drivers.items || {});

  // 1. CANDADO SANDBOX: Autorizado para Superadministrador, voiceBeta explícito y Transportes Durand Durand (ID: 2)
  const isAuthorized = Boolean(
    user?.administrator
    || user?.attributes?.voiceBeta === true
    || user?.id === 2
    || user?.email?.toLowerCase() === 'dyd@dydtransportes.com'
    || user?.name?.toLowerCase().includes('durand')
  );

  const [isSupported, setIsSupported] = useState(true);
  const [isSecure, setIsSecure] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [responseMessage, setResponseMessage] = useState('');
  const [targetDevice, setTargetDevice] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [textInput, setTextInput] = useState('');

  // 2. FASE 5.2: Estado de Observadores Proactivos ("Avísame cuando...")
  const [watchers, setWatchers] = useState([]);

  const recognitionInstanceRef = useRef(null);

  // Asegurar que las geocercas se carguen en Redux si estuvieran vacías
  useEffect(() => {
    if (isAuthorized && Object.keys(geofencesMap).length === 0) {
      fetch('/api/geofences')
        .then((res) => (res.ok ? res.json() : []))
        .then((items) => {
          if (items && items.length > 0) {
            dispatch(geofencesActions.update(items));
          }
        })
        .catch((e) => console.warn('Error loading geofences:', e));
    }
  }, [isAuthorized, geofencesMap, dispatch]);

  // Validar soporte y contexto HTTPS
  useEffect(() => {
    if (!isAuthorized) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
    }

    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setIsSecure(false);
    }
  }, [isAuthorized]);

  // Motor de Síntesis de Voz (Text-to-Speech)
  const speak = (text) => {
    if (!('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-PE';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const esVoice = voices.find((v) => v.lang.startsWith('es')) || null;
      if (esVoice) utterance.voice = esVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
      setIsSpeaking(false);
    }
  };

  // Listas cacheadas para búsqueda rápida
  const deviceList = useMemo(() => Object.values(devicesMap), [devicesMap]);
  const geofenceList = useMemo(() => Object.values(geofencesMap), [geofencesMap]);
  const driverList = useMemo(() => Object.values(driversMap), [driversMap]);

  // Observadores activos no disparados
  const activeWatchers = useMemo(() => watchers.filter((w) => !w.triggered), [watchers]);

  // =========================================================================
  // FASE 5.2: MOTOR DE VIGILANCIA EN TIEMPO REAL (WEBSOCKET EVALUATOR)
  // =========================================================================
  useEffect(() => {
    if (!watchers.length) return;

    watchers.forEach((watcher) => {
      if (watcher.triggered) return;

      const pos = positionsMap[watcher.deviceId];
      if (!pos) return;

      let shouldTrigger = false;
      let alertMessage = '';

      if (watcher.type === 'ARRIVAL') {
        const geo = geofencesMap[watcher.geofenceId];
        if (geo && isPositionInGeofence(pos, geo)) {
          shouldTrigger = true;
          alertMessage = `¡Atención! El móvil ${watcher.deviceName} acaba de ingresar a ${watcher.geofenceName}.`;
        }
      } else if (watcher.type === 'DEPARTURE') {
        const geo = geofencesMap[watcher.geofenceId];
        if (geo && !isPositionInGeofence(pos, geo)) {
          shouldTrigger = true;
          alertMessage = `¡Alerta! El móvil ${watcher.deviceName} acaba de salir de ${watcher.geofenceName}.`;
        }
      } else if (watcher.type === 'MOTION') {
        const speedKmh = Math.round(speedFromKnots(pos.speed || 0, 'kmh'));
        const ignition = Boolean(pos.attributes?.ignition);
        if (speedKmh >= 3 || ignition) {
          shouldTrigger = true;
          alertMessage = `¡Atención! El móvil ${watcher.deviceName} ha encendido el motor y se puso en movimiento a ${speedKmh} km por hora.`;
        }
      }

      if (shouldTrigger) {
        // 1. Marcar observador como disparado
        setWatchers((prev) => prev.map((w) => (w.id === watcher.id ? { ...w, triggered: true } : w)));

        // 2. Tocar chime sonoro
        playNotificationChime();

        // 3. Desplegar diálogo y cantar alerta por altavoz
        setResponseMessage(alertMessage);
        setTargetDevice(devicesMap[watcher.deviceId] || null);
        setDialogOpen(true);
        speak(alertMessage);

        // 4. Centrar automáticamente el vehículo en el mapa
        dispatch(devicesActions.selectId(watcher.deviceId));
      }
    });
  }, [positionsMap, watchers, geofencesMap, devicesMap, dispatch]);

  // Cancelar un observador activo
  const handleRemoveWatcher = (id) => {
    setWatchers((prev) => prev.filter((w) => w.id !== id));
  };

  // Buscar coincidencia de vehículo o conductor
  const findMatchingDevice = (rawQuery) => {
    const q = normalizeText(rawQuery);

    const stopWords = [
      'que', 'vehiculos', 'vehiculo', 'unidades', 'unidad', 'carros', 'carro', 'moviles', 'movil',
      'estan', 'dentro', 'fuera', 'donde', 'esta', 'quienes', 'quien', 'como', 'flota', 'base',
      'chorrillos', 'hay', 'en', 'la', 'el', 'avisame', 'cuando', 'llegue', 'salga', 'se', 'mueva',
      'arranque', 'si', 'notificame', 'alerta',
    ];

    // 1. Coincidencia exacta o parcial por nombre/placa del vehículo
    for (const dev of deviceList) {
      const devName = normalizeText(dev.name);
      const devPlate = devName.replace(/\s+/g, '');
      const queryNoSpaces = q.replace(/\s+/g, '');

      if (devName && (q.includes(devName) || devName.includes(q))) {
        return dev;
      }
      if (devPlate.length >= 3 && queryNoSpaces.includes(devPlate)) {
        return dev;
      }
      const parts = devName.split(/[-\s]+/);
      for (const part of parts) {
        if (part.length >= 2 && !stopWords.includes(part) && q.includes(part)) {
          return dev;
        }
      }
    }

    // 2. Coincidencia por conductor
    for (const driver of driverList) {
      const driverName = normalizeText(driver.name);
      if (driverName.length >= 3 && q.includes(driverName)) {
        const linkedDev = deviceList.find((d) =>
          d.attributes?.driverUniqueId === driver.uniqueId
          || d.attributes?.driverId === driver.id
          || normalizeText(d.attributes?.driverName || '').includes(driverName)
          || normalizeText(d.name).includes(driverName)
        );
        if (linkedDev) return linkedDev;
      }
    }

    // 3. Coincidencia difusa por palabras en la consulta
    const words = q.split(' ').filter((w) => w.length >= 3 && !stopWords.includes(w));
    for (const word of words) {
      const found = deviceList.find((d) => normalizeText(d.name).includes(word));
      if (found) return found;
    }

    return null;
  };

  // Buscar coincidencia inteligente de geocerca (Puntaje por palabras y coincidencia exacta)
  const findMatchingGeofence = (rawQuery) => {
    const q = normalizeText(rawQuery);
    if (!geofenceList.length) return null;

    let bestGeo = null;
    let maxScore = 0;

    for (const geo of geofenceList) {
      const geoName = normalizeText(geo.name);
      if (!geoName) continue;

      if (q.includes(geoName)) {
        const score = 100 + geoName.length;
        if (score > maxScore) {
          maxScore = score;
          bestGeo = geo;
        }
        continue;
      }

      const geoWords = geoName.split(' ').filter((w) => w.length >= 3);
      let matchCount = 0;
      for (const word of geoWords) {
        if (q.includes(word)) {
          matchCount += (word === 'base' ? 5 : 20);
        }
      }

      if (matchCount > 0 && matchCount > maxScore) {
        maxScore = matchCount;
        bestGeo = geo;
      }
    }

    if (!bestGeo && (q.includes('base') || q.includes('cochera') || q.includes('patio') || q.includes('planta'))) {
      bestGeo = geofenceList.find((g) => {
        const gn = normalizeText(g.name);
        return gn.includes('base') || gn.includes('cochera') || gn.includes('patio') || gn.includes('planta');
      });
    }

    return bestGeo;
  };

  // =========================================================================
  // CEREBRO TELEMÁTICO (PASO 2 + FASE 5.2): MOTOR DETERMINISTA Y PROACTIVO
  // =========================================================================
  const processVoiceIntent = async (rawText) => {
    const text = normalizeText(rawText);
    setTranscript(rawText);
    setErrorMessage('');
    setTargetDevice(null);
    setIsProcessing(true);

    try {
      const targetGeo = findMatchingGeofence(text);
      const targetDev = findMatchingDevice(text);

      // =====================================================================
      // FASE 5.2: DISPARADORES PROACTIVOS ("Avísame cuando...")
      // =====================================================================
      const isWatchRequest =
        text.includes('avisame')
        || text.includes('notificame')
        || text.includes('alertame')
        || text.includes('dime cuando')
        || text.includes('avisame si')
        || text.includes('avisame cuando');

      if (isWatchRequest) {
        // 1. Caso: "Avísame cuando [móvil] llegue / entre a [geocerca]"
        const isArrival = text.includes('llegue') || text.includes('entre') || text.includes('ingrese') || text.includes('llegar');
        // 2. Caso: "Avísame cuando [móvil] salga / abandone [geocerca]"
        const isDeparture = text.includes('salga') || text.includes('abandone') || text.includes('se vaya') || text.includes('salida');
        // 3. Caso: "Avísame si [móvil] se mueve / arranca / enciende"
        const isMotion = text.includes('mueva') || text.includes('arranque') || text.includes('encienda') || text.includes('avance');

        if (targetDev && (isArrival || isDeparture) && targetGeo) {
          const pos = positionsMap[targetDev.id];
          const isCurrentlyInside = isPositionInGeofence(pos, targetGeo);

          if (isArrival && isCurrentlyInside) {
            const reply = `El móvil ${targetDev.name} ya se encuentra actualmente dentro de ${targetGeo.name}.`;
            setResponseMessage(reply);
            speak(reply);
            return;
          }

          if (isDeparture && !isCurrentlyInside) {
            const reply = `El móvil ${targetDev.name} ya está actualmente fuera de ${targetGeo.name}.`;
            setResponseMessage(reply);
            speak(reply);
            return;
          }

          const watcherType = isArrival ? 'ARRIVAL' : 'DEPARTURE';
          const newWatcher = {
            id: `watch_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            type: watcherType,
            deviceId: targetDev.id,
            deviceName: targetDev.name,
            geofenceId: targetGeo.id,
            geofenceName: targetGeo.name,
            createdAt: Date.now(),
            triggered: false,
          };

          setWatchers((prev) => [...prev, newWatcher]);
          setTargetDevice(targetDev);

          const reply = isArrival
            ? `Entendido. He programado la alerta. Te avisaré tan pronto el móvil ${targetDev.name} ingrese a ${targetGeo.name}.`
            : `Listo. He programado la alerta. Te avisaré inmediatamente cuando el móvil ${targetDev.name} salga de ${targetGeo.name}.`;

          setResponseMessage(reply);
          speak(reply);
          return;
        }

        if (targetDev && isMotion) {
          const newWatcher = {
            id: `watch_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            type: 'MOTION',
            deviceId: targetDev.id,
            deviceName: targetDev.name,
            createdAt: Date.now(),
            triggered: false,
          };

          setWatchers((prev) => [...prev, newWatcher]);
          setTargetDevice(targetDev);

          const reply = `Perfecto. Vigilaré el móvil ${targetDev.name}. Te avisaré en cuanto encienda el motor o inicie movimiento.`;
          setResponseMessage(reply);
          speak(reply);
          return;
        }

        if (!targetDev) {
          const sampleDev = deviceList[0]?.name || 'AJB';
          const reply = `¿De qué vehículo deseas que te avise? Puedes decir por ejemplo: "Avísame cuando el ${sampleDev} llegue a la Base Chorrillos".`;
          setResponseMessage(reply);
          speak(reply);
          return;
        }

        if (!targetGeo && !isMotion) {
          const sampleGeo = geofenceList[0]?.name || 'Base Chorrillos';
          const reply = `¿De qué geocerca deseas que te avise? Puedes decir: "Avísame cuando el ${targetDev.name} llegue a la ${sampleGeo}".`;
          setResponseMessage(reply);
          speak(reply);
          return;
        }
      }

      // =====================================================================
      // CASO A: SE MENCIONA UNA GEOCERCA (Ej: "Base Chorrillos")
      // =====================================================================
      if (targetGeo) {
        // A.1: ¿Está un vehículo ESPECÍFICO en la geocerca? (Ej: "¿Está el AJB en la Base Chorrillos?")
        if (targetDev) {
          const pos = positionsMap[targetDev.id];
          const isInside = isPositionInGeofence(pos, targetGeo);

          setTargetDevice(targetDev);
          dispatch(devicesActions.selectId(targetDev.id));

          const rawTime = pos?.fixTime || pos?.deviceTime || targetDev.lastUpdate;
          const timeFormatted = formatSpokenDateTime(rawTime);
          const timeSuffix = timeFormatted ? `, reportado ${timeFormatted}` : '';

          if (isInside) {
            const speedKmh = Math.round(speedFromKnots(pos?.speed || 0, 'kmh'));
            const ignition = Boolean(pos?.attributes?.ignition);
            const stateStr = speedKmh > 3 ? `en marcha a ${speedKmh} km por hora` : ignition ? 'en ralentí con motor encendido' : 'con motor apagado';

            const reply = `Sí, el móvil ${targetDev.name} está dentro de ${targetGeo.name}, ${stateStr}${timeSuffix}.`;
            setResponseMessage(reply);
            speak(reply);
          } else {
            let address = pos?.address;
            if (!address && pos?.latitude && pos?.longitude) {
              address = await resolveStreetAddress(pos.latitude, pos.longitude);
            }
            const speedKmh = Math.round(speedFromKnots(pos?.speed || 0, 'kmh'));
            const locationStr = address ? `en ${address}` : 'en ruta';
            const reply = `No, el móvil ${targetDev.name} no está en ${targetGeo.name}. Actualmente se encuentra ${locationStr} a ${speedKmh} km por hora${timeSuffix}.`;
            setResponseMessage(reply);
            speak(reply);
          }
          return;
        }

        // A.2: ¿Quiénes están FUERA de la geocerca?
        const isOutside = text.includes('fuera') || text.includes('afuera') || text.includes('no estan') || text.includes('salieron');
        if (isOutside) {
          const outsideDevices = deviceList.filter((dev) => {
            const pos = positionsMap[dev.id];
            return !isPositionInGeofence(pos, targetGeo);
          });

          if (outsideDevices.length === 0) {
            const reply = `Todos tus vehículos se encuentran actualmente dentro de ${targetGeo.name}.`;
            setResponseMessage(reply);
            speak(reply);
          } else {
            const names = outsideDevices.slice(0, 4).map((d) => d.name).join(', ');
            const remaining = outsideDevices.length > 4 ? ` y ${outsideDevices.length - 4} más` : '';
            const reply = `Hay ${outsideDevices.length} vehículos fuera de ${targetGeo.name}: ${names}${remaining}.`;
            setResponseMessage(reply);
            speak(reply);
          }
          return;
        }

        // A.3: ¿Quiénes / Qué vehículos están DENTRO de la geocerca?
        const insideDevices = deviceList.filter((dev) => {
          const pos = positionsMap[dev.id];
          return isPositionInGeofence(pos, targetGeo);
        });

        if (insideDevices.length === 0) {
          const reply = `No hay ningún vehículo dentro de ${targetGeo.name} en este momento.`;
          setResponseMessage(reply);
          speak(reply);
        } else {
          const names = insideDevices.slice(0, 5).map((d) => d.name).join(', ');
          const remaining = insideDevices.length > 5 ? ` y ${insideDevices.length - 5} más` : '';
          const reply = `Dentro de ${targetGeo.name} se encuentran ${insideDevices.length} vehículos: ${names}${remaining}.`;
          setResponseMessage(reply);
          speak(reply);
        }
        return;
      }

      // =====================================================================
      // CASO B: SE MENCIONA UN VEHÍCULO / CONDUCTOR (Ej: "¿Dónde está el AJB?")
      // =====================================================================
      if (targetDev) {
        setTargetDevice(targetDev);
        dispatch(devicesActions.selectId(targetDev.id));

        const pos = positionsMap[targetDev.id];
        if (!pos) {
          const rawTime = targetDev.lastUpdate;
          const timeStr = formatSpokenDateTime(rawTime);
          const reply = `El vehículo ${targetDev.name} se encuentra registrado pero no tiene coordenadas recientes de GPS${timeStr ? `, última conexión ${timeStr}` : ''}.`;
          setResponseMessage(reply);
          speak(reply);
          return;
        }

        const speedKmh = Math.round(speedFromKnots(pos.speed || 0, 'kmh'));
        const ignition = Boolean(pos.attributes?.ignition);
        const cardinal = getCardinalDirection(pos.course);

        let resolvedAddress = pos.address;
        if ((!resolvedAddress || resolvedAddress.trim().length === 0) && pos.latitude && pos.longitude) {
          resolvedAddress = await resolveStreetAddress(pos.latitude, pos.longitude);
        }

        let geoInfo = '';
        const currentGeo = geofenceList.find((g) => isPositionInGeofence(pos, g));
        if (currentGeo) {
          geoInfo = `dentro de ${currentGeo.name}`;
        }

        let locationStr = '';
        if (resolvedAddress && geoInfo) {
          locationStr = `en ${resolvedAddress}, ${geoInfo}`;
        } else if (resolvedAddress) {
          locationStr = `en ${resolvedAddress}`;
        } else if (geoInfo) {
          locationStr = geoInfo;
        } else if (pos.latitude && pos.longitude) {
          locationStr = `en coordenadas ${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}`;
        } else {
          locationStr = 'en ruta';
        }

        const rawTimestamp = pos.fixTime || pos.deviceTime || targetDev.lastUpdate;
        const timeFormatted = formatSpokenDateTime(rawTimestamp);
        const timeStr = timeFormatted ? `, reportado ${timeFormatted}` : '';

        let reply = '';
        if (speedKmh >= 3) {
          reply = `El móvil ${targetDev.name} está en movimiento a ${speedKmh} km por hora ${locationStr} ${cardinal}${timeStr}.`;
        } else if (ignition) {
          reply = `El móvil ${targetDev.name} está detenido en ralentí con motor encendido ${locationStr}${timeStr}.`;
        } else {
          reply = `El móvil ${targetDev.name} está estacionado con motor apagado ${locationStr}${timeStr}.`;
        }

        setResponseMessage(reply);
        speak(reply);
        return;
      }

      // =====================================================================
      // CASO C: RESUMEN GENERAL DE LA FLOTA ("¿Cómo está la flota?")
      // =====================================================================
      if (text.includes('como esta la flota') || text.includes('estado de la flota') || text.includes('cuantos vehiculos') || text.includes('cuantos estan')) {
        const total = deviceList.length;
        let moving = 0;
        let idling = 0;
        let parked = 0;
        let offline = 0;

        deviceList.forEach((d) => {
          const p = positionsMap[d.id];
          if (!p || d.status === 'offline') {
            offline++;
          } else {
            const spd = Math.round(speedFromKnots(p.speed || 0, 'kmh'));
            const ign = Boolean(p.attributes?.ignition);
            if (spd >= 3) moving++;
            else if (ign) idling++;
            else parked++;
          }
        });

        const reply = `Tienes un total de ${total} vehículos: ${moving} en movimiento, ${idling} en ralentí, ${parked} estacionados y ${offline} sin señal.`;
        setResponseMessage(reply);
        speak(reply);
        return;
      }

      // =====================================================================
      // CASO D: FALLBACK INTELIGENTE
      // =====================================================================
      const sampleDevice = deviceList[0]?.name || 'AJB';
      const availableGeos = geofenceList.map((g) => g.name).slice(0, 3).join(', ') || 'Base Chorrillos';

      const reply = `Te escuché, pero no identifiqué la consulta. Puedes pedirme: "Avísame cuando el ${sampleDevice} llegue a la ${availableGeos}", "¿Qué vehículos están en la ${availableGeos}?" o "¿Dónde está el ${sampleDevice}?".`;
      setResponseMessage(reply);
      speak(reply);
    } finally {
      setIsProcessing(false);
    }
  };

  // Detener reconocimiento
  const stopListening = () => {
    try {
      if (recognitionInstanceRef.current) {
        recognitionInstanceRef.current.abort();
        recognitionInstanceRef.current = null;
      }
    } catch (e) {
      console.warn('Error stopping recognition:', e);
    }
    setIsListening(false);
  };

  // Iniciar reconocimiento creando instancia nueva
  const startListening = async () => {
    stopListening();
    setErrorMessage('');
    setTranscript('');
    setResponseMessage('');
    setDialogOpen(true);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMessage('Tu navegador no soporta SpeechRecognition. Usa Google Chrome o Microsoft Edge.');
      return;
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMessage('Permiso de micrófono bloqueado. Habilita el acceso en el candado de la URL.');
          return;
        }
      }
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-PE';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage('');
      };

      recognition.onresult = (event) => {
        let liveTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          liveTranscript += event.results[i][0].transcript;
        }
        setTranscript(liveTranscript);

        if (event.results[0].isFinal) {
          processVoiceIntent(event.results[0][0].transcript);
        }
      };

      recognition.onerror = (event) => {
        console.warn('SpeechRecognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setErrorMessage('Permiso de micrófono denegado en el navegador.');
        } else if (event.error === 'no-speech') {
          setErrorMessage('No se escuchó ningún sonido. Intenta hablar más cerca.');
        } else {
          setErrorMessage(`Aviso: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionInstanceRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Error starting recognition:', err);
      setIsListening(false);
      setErrorMessage(`No se pudo iniciar el micrófono: ${err.message || err}`);
    }
  };

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSendText = (e) => {
    e.preventDefault();
    if (textInput.trim()) {
      processVoiceIntent(textInput);
      setTextInput('');
    }
  };

  const handleLocateTarget = () => {
    if (targetDevice) {
      dispatch(devicesActions.selectId(targetDevice.id));
    }
  };

  if (!isAuthorized) {
    return null;
  }

  return (
    <>
      {/* Tarjeta Flotante con la conversación y feedback */}
      <Slide direction="up" in={dialogOpen} mountOnEnter unmountOnExit>
        <Paper elevation={4} className={classes.dialogCard}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SmartToyIcon color="primary" fontSize="small" />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                GeoZoone Voice (Telemetría y Alertas)
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => { stopListening(); setDialogOpen(false); }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Aviso si no es HTTPS */}
          {!isSecure && (
            <Alert severity="warning" icon={<WarningAmberIcon fontSize="small" />} sx={{ mb: 1.5, py: 0.5, fontSize: '0.78rem' }}>
              Usa <strong>https://</strong> en la URL para que el micrófono funcione siempre sin bloqueos.
            </Alert>
          )}

          {/* Estado del Micrófono y Observadores */}
          <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              size="small"
              label={isListening ? '🎙️ Escuchando... ¡Habla ahora!' : isProcessing ? '⏳ Procesando...' : isSpeaking ? '🔊 Respondiendo...' : 'Listo'}
              color={isListening ? 'error' : isProcessing ? 'warning' : isSpeaking ? 'success' : 'primary'}
              sx={{ fontWeight: 600, fontSize: '0.72rem' }}
            />
            {activeWatchers.length > 0 && (
              <Chip
                size="small"
                icon={<NotificationsActiveIcon style={{ fontSize: '0.9rem' }} />}
                label={`${activeWatchers.length} alerta${activeWatchers.length > 1 ? 's' : ''} activa${activeWatchers.length > 1 ? 's' : ''}`}
                color="warning"
                sx={{ fontWeight: 700, fontSize: '0.72rem' }}
              />
            )}
          </Box>

          {(isListening || isProcessing) && (
            <LinearProgress color={isListening ? 'error' : 'primary'} sx={{ mb: 1.5, borderRadius: 1 }} />
          )}

          {/* Error / Diagnóstico */}
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 1.5, py: 0.5, fontSize: '0.8rem' }}>
              {errorMessage}
            </Alert>
          )}

          {/* FASE 5.2: Panel de Observadores Activos */}
          {activeWatchers.length > 0 && (
            <Box sx={{ mb: 1.5, p: 1.2, backgroundColor: '#fefce8', borderRadius: 2, border: '1px solid #fef08a' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#854d0e', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.8 }}>
                <NotificationsActiveIcon fontSize="inherit" /> VIGILANCIA EN VIVO ACTIVA ({activeWatchers.length}):
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                {activeWatchers.map((w) => (
                  <Chip
                    key={w.id}
                    size="small"
                    label={`${w.deviceName} ➔ ${w.type === 'ARRIVAL' ? 'Llegada a ' : w.type === 'DEPARTURE' ? 'Salida de ' : 'Movimiento '}${w.geofenceName || ''}`}
                    onDelete={() => handleRemoveWatcher(w.id)}
                    color="warning"
                    variant="outlined"
                    sx={{ fontSize: '0.72rem', fontWeight: 600, backgroundColor: '#ffffff' }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Lo que dijo el usuario */}
          {transcript && (
            <Box sx={{ mb: 1.5, p: 1.2, backgroundColor: '#f1f5f9', borderRadius: 2 }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>
                PREGUNTA / COMANDO:
              </Typography>
              <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: 500, fontStyle: 'italic' }}>
                "{transcript}"
              </Typography>
            </Box>
          )}

          {/* Respuesta inteligente del asistente */}
          {responseMessage && (
            <Box sx={{ p: 1.2, backgroundColor: '#eff6ff', borderRadius: 2, borderLeft: '4px solid #3b82f6', mb: 1.5 }}>
              <Typography variant="caption" sx={{ color: '#1d4ed8', fontWeight: 600, display: 'block' }}>
                RESPUESTA:
              </Typography>
              <Typography variant="body2" sx={{ color: '#1e3a8a', mt: 0.3, fontWeight: 500 }}>
                {responseMessage}
              </Typography>
            </Box>
          )}

          {/* Botón de centrado si hay un vehículo identificado */}
          {targetDevice && (
            <Button
              fullWidth
              size="small"
              variant="outlined"
              color="primary"
              startIcon={<MyLocationIcon />}
              onClick={handleLocateTarget}
              sx={{ mb: 1.5, textTransform: 'none', fontWeight: 600 }}
            >
              Centrar {targetDevice.name} en el Mapa
            </Button>
          )}

          {/* Botones de acción rápida */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1.5 }}>
            {responseMessage ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<ReplayIcon />}
                onClick={() => speak(responseMessage)}
                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
              >
                Repetir audio
              </Button>
            ) : <Box />}

            <Button
              size="small"
              variant="contained"
              color={isListening ? 'error' : 'primary'}
              startIcon={isListening ? <GraphicEqIcon /> : <MicIcon />}
              onClick={handleToggleListening}
              sx={{ textTransform: 'none', fontSize: '0.75rem' }}
            >
              {isListening ? 'Detener' : 'Hablar por Micrófono'}
            </Button>
          </Box>

          {/* Entrada de texto alternativa para probar escribiendo */}
          <Box component="form" onSubmit={handleSendText} sx={{ pt: 1, borderTop: '1px solid #f1f5f9' }}>
            <TextField
              size="small"
              fullWidth
              placeholder='Ej: "Avísame cuando el AJB llegue a la Base Chorrillos"'
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" type="submit" color="primary" disabled={!textInput.trim()}>
                      <SendIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
                style: { fontSize: '0.82rem' },
              }}
            />
          </Box>
        </Paper>
      </Slide>

      {/* Botón Flotante Principal de Micrófono */}
      <div className={classes.fabContainer}>
        <Tooltip title={isListening ? 'Escuchando tu voz...' : activeWatchers.length > 0 ? `Vigilando ${activeWatchers.length} alertas en vivo` : 'GeoZoone Voice (Consultas y Alertas)'} placement="left">
          <Fab
            className={`${classes.pulseFab} ${isListening ? classes.listeningFab : ''} ${isSpeaking ? classes.speakingFab : ''} ${activeWatchers.length > 0 && !isListening && !isSpeaking ? classes.watchingFab : ''}`}
            onClick={handleToggleListening}
            aria-label="voice-assistant"
          >
            {isListening ? (
              <GraphicEqIcon fontSize="medium" />
            ) : isSpeaking ? (
              <VolumeUpIcon fontSize="medium" />
            ) : activeWatchers.length > 0 ? (
              <NotificationsActiveIcon fontSize="medium" />
            ) : (
              <MicIcon fontSize="medium" />
            )}
          </Fab>
        </Tooltip>
      </div>
    </>
  );
};

export default VoiceAssistantFab;
