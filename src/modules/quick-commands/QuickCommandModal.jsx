import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { getVehicleInfo } from '../core/deviceAdapter';
import {
  verifyUserPassword,
  sendQuickCommand,
  logCommandAudit,
} from './commandService';

const QuickCommandModal = ({
  open,
  onClose,
  device,
  position,
  actionType, // 'engineStop' | 'engineResume' | 'rebootDevice'
}) => {
  const currentUser = useSelector((state) => state.session.user);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  if (!device) return null;

  const vehicle = getVehicleInfo(device);
  const speedKnots = Number(position?.speed || 0);
  const speedKmh = Math.round(speedKnots * 1.852);
  const isMoving = speedKmh > 3;

  const isStop = actionType === 'engineStop';
  const isResume = actionType === 'engineResume';

  const getTitle = () => {
    if (isStop) return '🔒 Bloquear Motor (Corte de Combustible)';
    if (isResume) return '🔓 Restaurar Motor (Habilitar Arranque)';
    return '🔄 Reiniciar Rastreador GPS';
  };

  const getHeaderBg = () => {
    if (isStop) return '#dc2626';
    if (isResume) return '#16a34a';
    return '#d97706';
  };

  const handleClose = () => {
    if (submitting) return;
    setPassword('');
    setErrorMsg(null);
    setSuccessMsg(null);
    onClose();
  };

  const handleConfirm = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!password.trim()) {
      setErrorMsg('Por seguridad, ingresa tu contraseña para autorizar el comando.');
      return;
    }

    setSubmitting(true);
    try {
      const isValidPassword = await verifyUserPassword(currentUser?.email, password);
      if (!isValidPassword) {
        setSubmitting(false);
        setErrorMsg('Contraseña incorrecta. La orden fue cancelada por seguridad.');
        return;
      }

      const result = await sendQuickCommand(device, position, actionType);
      const statusText = result.queued ? 'QUEUED' : 'SENT_LIVE';

      await logCommandAudit({
        user: currentUser,
        device,
        position,
        actionType,
        speedKmh,
        resultStatus: statusText,
      });

      setSubmitting(false);
      setPassword('');
      setSuccessMsg(
        result.queued
          ? 'Comando encolado con éxito. Se ejecutará apenas el GPS envíe su próximo paquete.'
          : '¡Comando enviado y ejecutado en tiempo real!'
      );

      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 2200);
    } catch (err) {
      setSubmitting(false);
      setErrorMsg(`No se pudo enviar el comando: ${err.message}`);
    }
  };

  return (
    <Dialog
      open={Boolean(open)}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      style={{ zIndex: 2000 }}
    >
      <DialogTitle
        sx={{
          backgroundColor: getHeaderBg(),
          color: '#ffffff',
          py: 1.5,
          px: 2,
          fontSize: '15px',
          fontWeight: 700,
        }}
      >
        {getTitle()}
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5, pb: 1 }}>
        <Box
          sx={{
            mt: 1,
            mb: 1.5,
            p: 1.5,
            borderRadius: 1.5,
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
            🚛 {vehicle.name} {vehicle.placa ? `(${vehicle.placa})` : ''}
          </Typography>
          <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 0.5 }}>
            IMEI / ID: <strong>{vehicle.uniqueId}</strong> • Velocidad actual: <strong>{speedKmh} km/h</strong>
          </Typography>
        </Box>

        {isStop && isMoving && (
          <Alert severity="error" sx={{ mb: 1.5, fontSize: '12px' }}>
            <strong>¡PELIGRO! El vehículo está en movimiento ({speedKmh} km/h).</strong>
            <br />
            Cortar el motor en marcha puede provocar un accidente grave. Se recomienda esperar a que esté detenido (0 km/h).
          </Alert>
        )}

        {isStop && !isMoving && (
          <Alert severity="success" sx={{ mb: 1.5, fontSize: '12px' }}>
            Vehículo detenido ({speedKmh} km/h). Condición segura para bloqueo.
          </Alert>
        )}

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 1.5, fontSize: '12px' }}>
            {errorMsg}
          </Alert>
        )}

        {successMsg && (
          <Alert severity="success" sx={{ mb: 1.5, fontSize: '12px' }}>
            {successMsg}
          </Alert>
        )}

        {!successMsg && (
          <>
            <Typography variant="body2" sx={{ mb: 1, fontSize: '12.5px', color: '#334155' }}>
              Confirma tu contraseña de usuario (<strong>{currentUser?.email}</strong>) para autorizar la orden:
            </Typography>
            <TextField
              fullWidth
              size="small"
              type={showPassword ? 'text' : 'password'}
              label="Contraseña de confirmación"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !submitting) handleConfirm();
              }}
              disabled={submitting}
              autoFocus
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Typography
              variant="caption"
              sx={{ display: 'block', mt: 1, color: '#64748b', fontSize: '11px' }}
            >
              🛡️ Auditoría activa: se registrará usuario, fecha, hora y velocidad del vehículo.
            </Typography>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 1.5 }}>
        <Button onClick={handleClose} disabled={submitting} size="small" color="inherit">
          Cancelar
        </Button>
        {!successMsg && (
          <Button
            onClick={handleConfirm}
            disabled={submitting}
            variant="contained"
            size="small"
            color={isStop ? 'error' : isResume ? 'success' : 'warning'}
            startIcon={
              submitting ? (
                <CircularProgress size={14} color="inherit" />
              ) : isStop ? (
                <LockIcon fontSize="small" />
              ) : isResume ? (
                <LockOpenIcon fontSize="small" />
              ) : (
                <RestartAltIcon fontSize="small" />
              )
            }
          >
            {submitting ? 'Enviando...' : 'Autorizar y Enviar'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default QuickCommandModal;
