import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
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
} from '@mui/material';
import { makeStyles } from '@mui/styles';
import MicIcon from '@mui/icons-material/Mic';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import CloseIcon from '@mui/icons-material/Close';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ReplayIcon from '@mui/icons-material/Replay';

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
    width: 360,
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

const VoiceAssistantFab = () => {
  const classes = useStyles();
  const user = useSelector((state) => state.session.user);

  // 1. CANDADO SANDBOX: Solo visible para el Administrador o con voiceBeta explícito
  const isAuthorized = Boolean(user?.administrator || user?.attributes?.voiceBeta === true);

  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [responseMessage, setResponseMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusNotice, setStatusNotice] = useState('');

  const recognitionRef = useRef(null);

  // Configuración del motor de síntesis de voz (TTS)
  const speak = (text) => {
    if (!('speechSynthesis' in window)) return;

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
  };

  // Inicializar Web Speech Recognition al montar
  useEffect(() => {
    if (!isAuthorized) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-PE';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setStatusNotice('Escuchando tu voz... Habla ahora');
    };

    recognition.onresult = (event) => {
      const speechResult = event.results[0][0].transcript;
      setTranscript(speechResult);
      setStatusNotice('Procesando respuesta...');

      // LÓGICA DE PASO 1: Confirmación de audio bidireccional y prueba de canal
      const reply = `Te escuché fuerte y claro: "${speechResult}". El Paso 1 del asistente de voz está conectado con éxito.`;
      setResponseMessage(reply);
      setDialogOpen(true);
      speak(reply);
    };

    recognition.onerror = (event) => {
      console.warn('VoiceAssistant error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setStatusNotice('Permiso de micrófono denegado en tu navegador.');
      } else if (event.error === 'no-speech') {
        setStatusNotice('No se detectó sonido. Intenta de nuevo.');
      } else {
        setStatusNotice(`Error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, [isAuthorized]);

  // Si no está autorizado, NO RENDERIZA NADA en el DOM
  if (!isAuthorized) {
    return null;
  }

  const handleToggleListening = () => {
    if (!isSupported) {
      alert('Tu navegador no soporta reconocimiento de voz nativo (Web Speech API). Usa Chrome, Edge o Safari.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
      setTranscript('');
      setResponseMessage('');
      setStatusNotice('');
      setDialogOpen(true);

      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.warn('Recognition start error:', err);
      }
    }
  };

  const handleRepeatVoice = () => {
    if (responseMessage) {
      speak(responseMessage);
    }
  };

  return (
    <>
      {/* Tarjeta Flotante con la conversación y feedback */}
      <Slide direction="up" in={dialogOpen} mountOnEnter unmountOnExit>
        <Paper elevation={4} className={classes.dialogCard}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SmartToyIcon color="primary" fontSize="small" />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                GeoZoone Voice (Sandbox)
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setDialogOpen(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box sx={{ mb: 1.5 }}>
            <Chip
              size="small"
              label={isListening ? '🎙️ Escuchando...' : isSpeaking ? '🔊 Hablando...' : 'Listo'}
              color={isListening ? 'error' : isSpeaking ? 'success' : 'primary'}
              sx={{ fontWeight: 600, fontSize: '0.72rem' }}
            />
          </Box>

          {/* Texto reconocido */}
          {transcript ? (
            <Box sx={{ mb: 1.5, p: 1.2, backgroundColor: '#f1f5f9', borderRadius: 2 }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>
                TÚ DIJISTE:
              </Typography>
              <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: 500, fontStyle: 'italic' }}>
                "{transcript}"
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="textSecondary" sx={{ mb: 1.5, fontSize: '0.85rem' }}>
              {statusNotice || 'Presiona el micrófono y haz una pregunta como: "¿Dónde está Juan?"'}
            </Typography>
          )}

          {/* Respuesta del asistente */}
          {responseMessage && (
            <Box sx={{ p: 1.2, backgroundColor: '#eff6ff', borderRadius: 2, borderLeft: '4px solid #3b82f6', mb: 1.5 }}>
              <Typography variant="caption" sx={{ color: '#1d4ed8', fontWeight: 600, display: 'block' }}>
                GEOZOONE DICE:
              </Typography>
              <Typography variant="body2" sx={{ color: '#1e3a8a', mt: 0.3 }}>
                {responseMessage}
              </Typography>
            </Box>
          )}

          {/* Acciones */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
            {responseMessage ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<ReplayIcon />}
                onClick={handleRepeatVoice}
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
              {isListening ? 'Detener' : 'Hablar ahora'}
            </Button>
          </Box>
        </Paper>
      </Slide>

      {/* Botón Flotante Principal de Micrófono */}
      <div className={classes.fabContainer}>
        <Tooltip title={isListening ? 'Escuchando tu voz...' : 'GeoZoone Voice (Sandbox)'} placement="left">
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

