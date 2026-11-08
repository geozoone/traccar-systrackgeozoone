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

import { devicesActions } from '../store';
import { speedFromKnots } from '../common/util/converter';
import { resolveStreetAddress } from '../map/main/MapDevicePopup';

const useStyles = makeStyles((theme) => ({
  fabContainer: {
    position: 'fixed',
    right: 24,
    bottom: 32,
    zIndex: 1200,
    [theme.breakpoints.down('md')]: {
      bottom: 84, // Arriba del BottomMenu móvil
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
        if (part.length >= 2 && q.includes(part)) {
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
    const words = q.split(' ').filter((w) => w.length >= 2);
    for (const word of words) {
      const found = deviceList.find((d) => normalizeText(d.name).includes(word));
      if (found) return found;
    }

    return null;
  };

  // Buscar coincidencia de geocerca
  const findMatchingGeofence = (rawQuery) => {
    const q = normalizeText(rawQuery);

    if (q.includes('base') || q.includes('cochera') || q.includes('patio') || q.includes('planta')) {
      const baseGeo = geofenceList.find((g) => {
        const gn = normalizeText(g.name);
        return gn.includes('base') || gn.includes('cochera') || gn.includes('patio') || gn.includes('planta');
      });
      if (baseGeo) return baseGeo;
    }

    for (const geo of geofenceList) {
      const geoName = normalizeText(geo.name);
      if (geoName.length >= 3 && q.includes(geoName)) {
        return geo;
      }
    }

    return null;
  };

  // =========================================================================
  // CEREBRO TELEMÁTICO (PASO 2): RESOLUCIÓN DE INTENCIONES CON DIRECCIÓN REAL
  // =========================================================================
  const processVoiceIntent = async (rawText) => {
    const text = normalizeText(rawText);
    setTranscript(rawText);
    setErrorMessage('');
    setTargetDevice(null);
    setIsProcessing(true);

    try {
      // -----------------------------------------------------------------------
      // INTENCIÓN A: "¿Quiénes están fuera de la base / geocerca?"
      // -----------------------------------------------------------------------
      if (text.includes('fuera de') || text.includes('quienes estan afuera') || text.includes('no estan en')) {
        const geo = findMatchingGeofence(text) || geofenceList[0];

        if (!geo) {
          const reply = 'No encontré ninguna geocerca registrada con ese nombre para verificar.';
          setResponseMessage(reply);
          speak(reply);
          return;
        }

        const outsideDevices = deviceList.filter((dev) => {
          const pos = positionsMap[dev.id];
          if (!pos) return true;
          const gIds = pos.geofenceIds || [];
          return !gIds.includes(geo.id);
        });

        if (outsideDevices.length === 0) {
          const reply = `Todos tus vehículos se encuentran actualmente dentro de ${geo.name}.`;
          setResponseMessage(reply);
          speak(reply);
        } else {
          const names = outsideDevices.slice(0, 4).map((d) => d.name).join(', ');
          const remaining = outsideDevices.length > 4 ? ` y ${outsideDevices.length - 4} más` : '';
          const reply = `Hay ${outsideDevices.length} vehículos fuera de ${geo.name}: ${names}${remaining}.`;
          setResponseMessage(reply);
          speak(reply);
        }
        return;
      }

      // -----------------------------------------------------------------------
      // INTENCIÓN B: "¿Quiénes están adentro / dentro de [geocerca]?"
      // -----------------------------------------------------------------------
      if (text.includes('quienes estan en') || text.includes('quienes estan dentro') || text.includes('quien esta en')) {
        const geo = findMatchingGeofence(text) || geofenceList[0];

        if (geo) {
          const insideDevices = deviceList.filter((dev) => {
            const pos = positionsMap[dev.id];
            const gIds = pos?.geofenceIds || [];
            return gIds.includes(geo.id);
          });

          if (insideDevices.length === 0) {
            const reply = `No hay ningún vehículo dentro de ${geo.name} en este momento.`;
            setResponseMessage(reply);
            speak(reply);
          } else {
            const names = insideDevices.slice(0, 4).map((d) => d.name).join(', ');
            const remaining = insideDevices.length > 4 ? ` y ${insideDevices.length - 4} más` : '';
            const reply = `Dentro de ${geo.name} se encuentran ${insideDevices.length} vehículos: ${names}${remaining}.`;
            setResponseMessage(reply);
            speak(reply);
          }
          return;
        }
      }

      // -----------------------------------------------------------------------
      // INTENCIÓN C: "¿Está [Vehículo] en [Geocerca]?" o "¿Ya llegó [Vehículo] a [Geocerca]?"
      // -----------------------------------------------------------------------
      const targetGeo = findMatchingGeofence(text);
      const targetDev = findMatchingDevice(text);

      if (targetGeo && (text.includes('esta') || text.includes('llego') || text.includes('se encuentra'))) {
        if (targetDev) {
          const pos = positionsMap[targetDev.id];
          const isInside = pos?.geofenceIds?.includes(targetGeo.id);

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
      }

      // -----------------------------------------------------------------------
      // INTENCIÓN D: "¿Dónde está [Vehículo / Conductor]?" / Ubicar vehículo
      // -----------------------------------------------------------------------
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

        // 1. Resolver dirección de calle real (geocodificación inversa si no viene precargada)
        let resolvedAddress = pos.address;
        if ((!resolvedAddress || resolvedAddress.trim().length === 0) && pos.latitude && pos.longitude) {
          resolvedAddress = await resolveStreetAddress(pos.latitude, pos.longitude);
        }

        // 2. Geocercas actuales
        let geoInfo = '';
        if (pos.geofenceIds && pos.geofenceIds.length > 0) {
          const currentGeofence = geofencesMap[pos.geofenceIds[0]];
          if (currentGeofence) {
            geoInfo = `dentro de ${currentGeofence.name}`;
          }
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

      // -----------------------------------------------------------------------
      // INTENCIÓN E: Resumen General de la Flota ("¿Cómo está la flota?")
      // -----------------------------------------------------------------------
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

      // -----------------------------------------------------------------------
      // FALLBACK INTELIGENTE (Si no se entendió la consulta exacta)
      // -----------------------------------------------------------------------
      const sampleDevice = deviceList[0]?.name || 'AJB';
      const sampleGeofence = geofenceList[0]?.name || 'Base';

      const reply = `Te escuché, pero no identifiqué una placa o geocerca válida. Puedes preguntarme por ejemplo: "¿Dónde está el ${sampleDevice}?", "¿Está el ${sampleDevice} en la ${sampleGeofence}?" o "¿Quiénes están fuera de la ${sampleGeofence}?".`;
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
              placeholder='Ej: "¿Dónde está el AJB?", "¿Quiénes están fuera de base?"'
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
