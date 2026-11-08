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
    width: 380,
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
  const [isSecure, setIsSecure] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [responseMessage, setResponseMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [textInput, setTextInput] = useState('');

  const recognitionInstanceRef = useRef(null);

  // Validar soporte y contexto HTTPS al cargar
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

  // Procesar cualquier texto (venga de voz o de teclado)
  const handleProcessInput = (recognizedText) => {
    if (!recognizedText || !recognizedText.trim()) return;

    const cleanText = recognizedText.trim();
    setTranscript(cleanText);
    setErrorMessage('');

    // LÓGICA DE PASO 1: Confirmación de audio y diagnóstico de canal
    const reply = `Te escuché fuerte y claro: "${cleanText}". El Paso 1 del asistente de voz está conectado con éxito.`;
    setResponseMessage(reply);
    setDialogOpen(true);
    speak(reply);
  };

  // Detener reconocimiento actual de forma segura
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

  // Iniciar reconocimiento creando una instancia NUEVA y fresca (vital para Chrome)
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

    // 1. Verificar permiso físico de micrófono explícitamente
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Liberar el stream de prueba
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        console.warn('Microphone permission error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMessage('Permiso de micrófono bloqueado en tu navegador. Haz clic en el ícono del candado en la barra de URL y selecciona "Permitir micrófono".');
          return;
        } else if (err.name === 'NotFoundError') {
          setErrorMessage('No se encontró ningún micrófono conectado en tu dispositivo.');
          return;
        }
      }
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-PE';
      recognition.continuous = false;
      recognition.interimResults = true; // Permite ver las palabras EN TIEMPO REAL mientras hablas
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

        // Si es el resultado final
        if (event.results[0].isFinal) {
          handleProcessInput(event.results[0][0].transcript);
        }
      };

      recognition.onerror = (event) => {
        console.warn('SpeechRecognition error:', event.error);
        setIsListening(false);

        switch (event.error) {
          case 'not-allowed':
            setErrorMessage('Permiso de micrófono denegado. Habilita el acceso al micrófono en el navegador.');
            break;
          case 'no-speech':
            setErrorMessage('No se escuchó ningún sonido. Acércate al micrófono e intenta hablar más fuerte.');
            break;
          case 'audio-capture':
            setErrorMessage('No se pudo capturar audio. Verifica que tu micrófono esté bien conectado y no esté en mute.');
            break;
          case 'network':
            setErrorMessage('Error de red al procesar el audio. Verifica tu conexión a internet.');
            break;
          default:
            setErrorMessage(`Aviso del micrófono: ${event.error}`);
            break;
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

  // Enviar mensaje por texto de prueba
  const handleSendText = (e) => {
    e.preventDefault();
    if (textInput.trim()) {
      handleProcessInput(textInput);
      setTextInput('');
    }
  };

  // Si no está autorizado, NO RENDERIZA NADA en el DOM
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
                GeoZoone Voice (Sandbox)
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => { stopListening(); setDialogOpen(false); }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Aviso si no es HTTPS */}
          {!isSecure && (
            <Alert severity="warning" icon={<WarningAmberIcon fontSize="small" />} sx={{ mb: 1.5, py: 0.5, fontSize: '0.78rem' }}>
              El navegador bloquea el micrófono si entras por HTTP. Usa <strong>https://</strong> en la URL.
            </Alert>
          )}

          {/* Estado del Micrófono */}
          <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              size="small"
              label={isListening ? '🎙️ Escuchando... ¡Habla ahora!' : isSpeaking ? '🔊 Hablando por altavoz...' : 'Listo'}
              color={isListening ? 'error' : isSpeaking ? 'success' : 'primary'}
              sx={{ fontWeight: 600, fontSize: '0.72rem' }}
            />
            {isListening && <Typography variant="caption" color="textSecondary">Te escucho en vivo</Typography>}
          </Box>

          {isListening && (
            <LinearProgress color="error" sx={{ mb: 1.5, borderRadius: 1 }} />
          )}

          {/* Error / Diagnóstico */}
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 1.5, py: 0.5, fontSize: '0.8rem' }}>
              {errorMessage}
            </Alert>
          )}

          {/* Lo que dijo el usuario (con preview en tiempo real) */}
          {transcript && (
            <Box sx={{ mb: 1.5, p: 1.2, backgroundColor: '#f1f5f9', borderRadius: 2 }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>
                TÚ DIJISTE:
              </Typography>
              <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: 500, fontStyle: 'italic' }}>
                "{transcript}"
              </Typography>
            </Box>
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

          {/* Entrada de texto alternativa para probar si el micrófono físico falla */}
          <Box component="form" onSubmit={handleSendText} sx={{ pt: 1, borderTop: '1px solid #f1f5f9' }}>
            <TextField
              size="small"
              fullWidth
              placeholder="O escribe aquí para probar el audio..."
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
        <Tooltip title={isListening ? 'Escuchando tu voz...' : 'GeoZoone Voice (Sandbox Admin)'} placement="left">
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
