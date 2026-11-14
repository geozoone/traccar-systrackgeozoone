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
    Chip,
    InputAdornment,
    IconButton,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SpeedIcon from '@mui/icons-material/Speed';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { formatSpeed } from '../util/formatter';
import { usePreference } from '../util/preferences';

const QuickCommandSecurityModal = ({
    open,
    onClose,
    device,
    position,
    actionType, // 'engineStop' | 'engineResume' | 'rebootDevice'
    onSuccess,
}) => {
    const speedUnit = usePreference('speedUnit');
    const currentUser = useSelector((state) => state.session.user);

    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    if (!device) return null;

    // Cálculo de velocidad actual
    const currentSpeedKnots = Number(position?.speed || 0);
    const isMoving = currentSpeedKnots > 1.5; // > ~3 km/h
    const formattedSpeed = formatSpeed(currentSpeedKnots, speedUnit);

    const isStop = actionType === 'engineStop';
    const isResume = actionType === 'engineResume';
    const isReboot = actionType === 'rebootDevice';

    const getTitle = () => {
        if (isStop) return 'Corte de Motor — Bloqueo de Vehículo';
        if (isResume) return 'Restaurar Motor — Desbloqueo de Vehículo';
        return 'Reinicio Remoto del Rastreador GPS';
    };

    const getActionColor = () => {
        if (isStop) return 'error';
        if (isResume) return 'success';
        return 'warning';
    };

    const handleConfirm = async () => {
        setErrorMsg(null);
        setSuccessMsg(null);

        if (!password.trim()) {
            setErrorMsg('Ingresa tu contraseña para autorizar la orden.');
            return;
        }

        setSubmitting(true);

        try {
            // 1. Paso de Seguridad Wialon: Validar credenciales del usuario activo
            const authHeader = 'Basic ' + btoa(`${currentUser.email}:${password}`);
            const sessionCheck = await fetch('/api/session', {
                headers: {
                    Authorization: authHeader,
                },
            });

            if (!sessionCheck.ok) {
                setSubmitting(false);
                setErrorMsg('Contraseña incorrecta. Por tu seguridad la acción fue cancelada.');
                return;
            }

            // 2. Despachar el comando oficial a Traccar
            const commandPayload = {
                deviceId: device.id,
                type: actionType,
                attributes: {},
            };

            const sendResponse = await fetch('/api/commands/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(commandPayload),
            });

            if (!sendResponse.ok) {
                const errText = await sendResponse.text();
                throw new Error(errText || 'Error al transmitir comando al GPS.');
            }

            // 3. Auditoría en Conector GeoZoone (registro silencioso en background)
            try {
                fetch('/modulo/audit/command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        deviceId: device.id,
                        deviceName: device.name,
                        deviceImei: device.uniqueId,
                        userId: currentUser.id,
                        userEmail: currentUser.email,
                        actionType: actionType,
                        speedKnots: currentSpeedKnots,
                        timestamp: new Date().toISOString(),
                    }),
                }).catch(() => {});
            } catch (e) {}

            setSuccessMsg('¡Comando transmitido exitosamente al dispositivo GPS!');
            setTimeout(() => {
                setPassword('');
                setSubmitting(false);
                onClose();
                if (onSuccess) onSuccess(actionType);
            }, 1200);

        } catch (err) {
            setSubmitting(false);
            setErrorMsg(err.message || 'Fallo de comunicación al enviar el comando.');
        }
    };

    const handleCloseModal = () => {
        if (submitting) return;
        setPassword('');
        setErrorMsg(null);
        setSuccessMsg(null);
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleCloseModal} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
                {isStop && <LockIcon color="error" />}
                {isResume && <LockOpenIcon color="success" />}
                {isReboot && <RestartAltIcon color="warning" />}
                <Typography variant="subtitle1" fontWeight={700}>
                    {getTitle()}
                </Typography>
            </DialogTitle>

            <DialogContent dividers sx={{ pt: 2 }}>
                {/* Resumen del Vehículo y Semáforo de Velocidad */}
                <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                        Vehículo / Placa:
                    </Typography>
                    <Typography variant="h6" fontWeight={800} color="primary" sx={{ mb: 1 }}>
                        {device.name}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SpeedIcon fontSize="small" color={isMoving ? 'error' : 'success'} />
                        <Typography variant="body2" fontWeight={600}>
                            Velocidad reportada:
                        </Typography>
                        <Chip
                            size="small"
                            label={formattedSpeed}
                            color={isMoving ? 'error' : 'success'}
                            variant={isMoving ? 'filled' : 'outlined'}
                            sx={{ fontWeight: 700 }}
                        />
                    </Box>
                </Box>

                {/* Advertencia Crítica estilo Wialon si es CORTE DE MOTOR */}
                {isStop && (
                    <Alert
                        severity={isMoving ? 'error' : 'warning'}
                        icon={<WarningAmberIcon />}
                        sx={{ mb: 2, fontSize: '0.82rem' }}
                    >
                        {isMoving ? (
                            <>
                                <strong>⚠️ ¡VEHÍCULO EN MOVIMIENTO ({formattedSpeed})!</strong>
                                <br />
                                Cortar el combustible a alta velocidad puede causar pérdida de dirección/frenos y accidentes graves.
                            </>
                        ) : (
                            <>
                                El corte desactiva el relé de ignición/combustible. El motor no volverá a encender hasta que se envíe el comando de desbloqueo.
                            </>
                        )}
                    </Alert>
                )}

                {/* Mensaje de Reinicio */}
                {isReboot && (
                    <Alert severity="info" sx={{ mb: 2, fontSize: '0.82rem' }}>
                        El rastreador GPS se reiniciará inmediatamente y restablecerá la conexión GPRS con el servidor.
                    </Alert>
                )}

                {/* Campo de Contraseña de Seguridad */}
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                    🔒 Confirma tu contraseña de usuario ({currentUser.email}):
                </Typography>
                <TextField
                    type={showPassword ? 'text' : 'password'}
                    fullWidth
                    size="small"
                    placeholder="Escribe tu contraseña para autorizar"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConfirm();
                    }}
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

                {/* Mensajes de Estado */}
                {errorMsg && (
                    <Alert severity="error" sx={{ mt: 2, fontSize: '0.82rem' }}>
                        {errorMsg}
                    </Alert>
                )}

                {successMsg && (
                    <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ mt: 2, fontSize: '0.82rem' }}>
                        {successMsg}
                    </Alert>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={handleCloseModal} disabled={submitting} variant="outlined" color="inherit">
                    Cancelar
                </Button>
                <Button
                    onClick={handleConfirm}
                    disabled={submitting || !password.trim()}
                    variant="contained"
                    color={getActionColor()}
                    startIcon={submitting && <CircularProgress size={16} color="inherit" />}
                >
                    {isStop ? 'Confirmar Apagado' : isResume ? 'Confirmar Restauración' : 'Confirmar Reinicio'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default QuickCommandSecurityModal;
