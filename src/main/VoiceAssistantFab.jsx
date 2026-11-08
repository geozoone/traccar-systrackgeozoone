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
    width: 420,
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

// Algoritmo matemático para comprobar si un punto (lat, lon) está dentro de una geocerca (círculo o polígono)
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
          // Distancia Haversine en metros
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
        // Algoritmo Ray-Casting
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

  // Buscar coincidencia de vehículo o conductor
  const findMatchingDevice = (rawQuery) => {
    const q = normalizeText(rawQuery);

    // Palabras reservadas que no deben considerarse placas
    const stopWords = ['que', 'vehiculos', 'vehiculo', 'unidades', 'unidad', 'carros', 'carro', 'moviles', 'movil', 'estan', 'dentro', 'fuera', 'donde', 'esta', 'quienes', 'quien', 'como', 'flota', 'base', 'chorrillos', 'hay', 'en', 'la', 'el'];

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
      // Coincidencia con palabras clave de la placa (ej: "ajb", "afd", "310", "volvo")
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

      // 1. Coincidencia exacta de la frase entera de la geocerca (ej: "base chorrillos")
      if (q.includes(geoName)) {
        const score = 100 + geoName.length;
        if (score > maxScore) {
          maxScore = score;
          bestGeo = geo;
        }
        continue;
      }

      // 2. Coincidencia si el nombre de la geocerca contiene las palabras clave de la consulta
      // Ej: consulta tiene "chorrillos" y geocerca se llama "Base Chorrillos"
      const geoWords = geoName.split(' ').filter((w) => w.length >= 3);
      let matchCount = 0;
      for (const word of geoWords) {
        if (q.includes(word)) {
          matchCount += (word === 'base' ? 5 : 20); // Palabras distintivas como "chorrillos" pesan mucho más que "base"
        }
      }

      if (matchCount > 0 && matchCount > maxScore) {
        maxScore = matchCount;
        bestGeo = geo;
      }
    }

    // Fallback genérico a base si se menciona "base" y no se encontró otra
    if (!bestGeo && (q.includes('base') || q.includes('cochera') || q.includes('patio') || q.includes('planta'))) {
      bestGeo = geofenceList.find((g) => {
        const gn = normalizeText(g.name);
        return gn.includes('base') || gn.includes('cochera') || gn.includes('patio') || gn.includes('planta');
      });
    }

    return bestGeo;
  };

  // =========================================================================
  // CEREBRO TELEMÁTICO (PASO 2): MOTOR DETERMINISTA Y ROBUSTO
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
        // (Cualquier consulta sobre la geocerca que no sea 'fuera' ni de un auto específico)
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

        // 1. Resolver dirección de calle real (geocodificación inversa)
        let resolvedAddress = pos.address;
        if ((!resolvedAddress || resolvedAddress.trim().length === 0) && pos.latitude && pos.longitude) {
          resolvedAddress = await resolveStreetAddress(pos.latitude, pos.longitude);
        }

        // 2. Geocercas actuales (usando nuestro evaluador espacial)
        let geoInfo = '';
        const currentGeo = geofenceList.find((g) => isPositionInGeofence(pos, g));
        if (currentGeo) {
          geoInfo = `dentro de ${currentGeo.name}`;
        }

        // 3. Armar ubicación
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

        // 4. Armar fecha y hora reportada
        const rawTimestamp = pos.fixTime || pos.deviceTime || targetDev.lastUpdate;
        const timeFormatted = formatSpokenDateTime(rawTimestamp);
        const timeStr = timeFormatted ? `, reportado ${timeFormatted}` : '';

        // 5. Frase final hablada
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
      // CASO D: FALLBACK INTELIGENTE (Lista las geocercas y placas disponibles)
      // =====================================================================
      const sampleDevice = deviceList[0]?.name || 'AJB';
      const availableGeos = geofenceList.map((g) => g.name).slice(0, 3).join(', ') || 'Base Chorrillos';

      const reply = `Te escuché, pero no identifiqué la placa o geocerca. Puedes preguntarme por ejemplo: "¿Qué vehículos están en la ${availableGeos}?" o "¿Dónde está el ${sampleDevice}?".`;
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
                GeoZoone Voice (Telemetría en Vivo)
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

          {/* Estado del Micrófono */}
          <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              size="small"
              label={isListening ? '🎙️ Escuchando... ¡Habla ahora!' : isProcessing ? '⏳ Consultando telemetría...' : isSpeaking ? '🔊 Respondiendo...' : 'Listo para consultar'}
              color={isListening ? 'error' : isProcessing ? 'warning' : isSpeaking ? 'success' : 'primary'}
              sx={{ fontWeight: 600, fontSize: '0.72rem' }}
            />
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

          {/* Lo que dijo el usuario */}
          {transcript && (
            <Box sx={{ mb: 1.5, p: 1.2, backgroundColor: '#f1f5f9', borderRadius: 2 }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>
                PREGUNTA:
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
                RESPUESTA TELEMÁTICA:
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
              placeholder='Ej: "¿Qué vehículos están en la Base Chorrillos?", "¿Dónde está el AJB?"'
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
        <Tooltip title={isListening ? 'Escuchando tu voz...' : 'GeoZoone Voice (Consultas de Flota)'} placement="left">
          <Fab
            className={`${classes.pulseFab} ${isListening ? classes.listeningFab : ''} ${isSpeaking ? classes.speakingFab : ''}`}
            onClick={handleToggleListening}
            aria-label="voice-assistant"
          >
            {isListening ? (
              <GraphicEqIcon fontSize="medium" />
            ) : isSpeaking ? (
              <VolumeUpIcon fontSize="medium" />
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
