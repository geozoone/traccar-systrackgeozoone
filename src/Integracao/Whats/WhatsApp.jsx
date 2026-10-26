import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
    Container,
    Typography,
    Button,
    Box,
    Paper,
    Chip,
    Alert,
    CircularProgress,
    Divider,
    TextField,
    Tooltip,
} from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import SendIcon from '@mui/icons-material/Send';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import SettingsMenu from '../../settings/components/SettingsMenu';
import PageLayout from '../../common/components/PageLayout';
import { useAdministrator } from '../../common/util/permissions';

const useStyles = makeStyles((theme) => ({
    container: {
        marginTop: theme.spacing(3),
        marginBottom: theme.spacing(4),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    headerCard: {
        width: '100%',
        padding: theme.spacing(3),
        borderRadius: 16,
        background: 'linear-gradient(135deg, #128C7E 0%, #075E54 100%)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: theme.spacing(2),
        boxShadow: '0 8px 24px rgba(18, 140, 126, 0.25)',
        marginBottom: theme.spacing(3),
    },
    card: {
        width: '100%',
        padding: theme.spacing(4),
        borderRadius: 16,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        background: '#fff',
    },
    qrContainer: {
        marginTop: theme.spacing(2),
        marginBottom: theme.spacing(2),
        padding: theme.spacing(2),
        border: '2px dashed #25D366',
        borderRadius: 16,
        background: '#fafafa',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: 340,
        width: '100%',
    },
    infoBox: {
        width: '100%',
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: 12,
        padding: theme.spacing(2),
        marginTop: theme.spacing(3),
        textAlign: 'left',
    },
    testCard: {
        width: '100%',
        padding: theme.spacing(3),
        borderRadius: 12,
        marginTop: theme.spacing(3),
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
        textAlign: 'left',
    },
}));

const WhatsApp = () => {
    const classes = useStyles();
    const currentUser = useSelector((state) => state.session.user);
    const admin = useAdministrator();

    // Instancia única por revendedor o instancia global para el SuperAdmin
    const instanceKey = admin ? 'traccar' : (currentUser?.id ? `revenda_${currentUser.id}` : null);
    const displayName = admin ? 'Canal Matriz (GeoZoone)' : `Canal Propio: ${currentUser?.name || 'Revendedor'}`;

    const [status, setStatus] = useState('checking'); // 'checking' | 'open' | 'close' | 'connecting' | 'apiOff'
    const [qrCode, setQrCode] = useState(null);
    const [loadingQR, setLoadingQR] = useState(false);
    const [actionMsg, setActionMsg] = useState(null);

    // Test send
    const [testPhone, setTestPhone] = useState(currentUser?.phone || '');
    const [testMsg, setTestMsg] = useState('🔔 Alerta de prueba GeoZoone: Tu canal de WhatsApp está vinculado correctamente.');
    const [sendingTest, setSendingTest] = useState(false);
    const [testResponse, setTestResponse] = useState(null);

    const pollingRef = useRef(null);

    const stopPolling = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    };

    // Consultar estado de la conexión
    const checkStatus = async () => {
        if (!instanceKey) return;
        try {
            const resp = await fetch(`/modulo/whats/status?instance=${encodeURIComponent(instanceKey)}`);
            if (!resp.ok) {
                setStatus('apiOff');
                return;
            }
            const data = await resp.json();
            const currentStatus = data.status || 'close';
            setStatus(currentStatus);

            if (currentStatus === 'open' || currentStatus === 'connected') {
                setQrCode(null);
                stopPolling();
            }
        } catch (e) {
            setStatus('apiOff');
        }
    };

    // Solicitar Código QR para conectar
    const handleConnect = async () => {
        if (!instanceKey) return;
        setLoadingQR(true);
        setActionMsg(null);
        setQrCode(null);

        try {
            const resp = await fetch(`/modulo/whats/connect?instance=${encodeURIComponent(instanceKey)}`);
            const data = await resp.json();

            if (resp.ok && data.base64) {
                const b64 = data.base64.startsWith('data:') ? data.base64 : `data:image/png;base64,${data.base64}`;
                setQrCode(b64);
                setStatus('connecting');

                // Iniciar polling para detectar cuando el usuario escanee el código
                stopPolling();
                pollingRef.current = setInterval(async () => {
                    const statusResp = await fetch(`/modulo/whats/status?instance=${encodeURIComponent(instanceKey)}`);
                    if (statusResp.ok) {
                        const statusData = await statusResp.json();
                        if (statusData.status === 'open' || statusData.status === 'connected') {
                            setStatus('open');
                            setQrCode(null);
                            stopPolling();
                            setActionMsg({ type: 'success', text: '¡WhatsApp conectado exitosamente!' });
                        }
                    }
                }, 5000);
            } else {
                setActionMsg({ type: 'error', text: data.error || 'No se pudo generar el código QR. Intenta de nuevo en unos segundos.' });
            }
        } catch (err) {
            setActionMsg({ type: 'error', text: `Error de conexión: ${err.message}` });
        } finally {
            setLoadingQR(false);
        }
    };

    // Desconectar sesión
    const handleDisconnect = async () => {
        if (!window.confirm('¿Seguro que deseas desconectar este WhatsApp? Las alertas dejarán de enviarse por este canal.')) return;
        stopPolling();
        setLoadingQR(true);
        try {
            await fetch(`/modulo/whats/logout?instance=${encodeURIComponent(instanceKey)}`);
            setStatus('close');
            setQrCode(null);
            setActionMsg({ type: 'info', text: 'Sesión de WhatsApp desconectada.' });
        } catch (err) {
            setActionMsg({ type: 'error', text: `Error: ${err.message}` });
        } finally {
            setLoadingQR(false);
        }
    };

    // Enviar alerta de prueba
    const handleSendTest = async () => {
        const clean = testPhone.replace(/\D/g, '');
        if (!clean) {
            setTestResponse({ type: 'error', text: 'Por favor ingresa un número de teléfono válido (ej: 51981005971)' });
            return;
        }
        setSendingTest(true);
        setTestResponse(null);
        try {
            const resp = await fetch('/modulo/whats/notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    numero: clean,
                    mensagem: testMsg,
                    instance: instanceKey,
                }),
            });
            const data = await resp.json();
            if (resp.ok && !data.skipped) {
                setTestResponse({ type: 'success', text: `¡Mensaje de prueba despachado a +${clean} con éxito!` });
            } else if (data.skipped) {
                setTestResponse({ type: 'warning', text: `No se envió: ${data.reason || 'Canal no conectado'}` });
            } else {
                setTestResponse({ type: 'error', text: data.error || 'Error enviando mensaje' });
            }
        } catch (err) {
            setTestResponse({ type: 'error', text: `Error de red: ${err.message}` });
        } finally {
            setSendingTest(false);
        }
    };

    useEffect(() => {
        checkStatus();
        return () => stopPolling();
    }, [instanceKey]);

    const isConnected = status === 'open' || status === 'connected';

    return (
        <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'WhatsApp']}>
            <Container maxWidth="md" className={classes.container}>
                {/* HEADER BANNER */}
                <Box className={classes.headerCard}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <WhatsAppIcon sx={{ fontSize: 52 }} />
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                                Notificaciones por WhatsApp
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                {displayName}
                            </Typography>
                        </Box>
                    </Box>
                    <Chip
                        label={isConnected ? 'WHATSAPP CONECTADO' : (status === 'apiOff' ? 'SERVICIO OFFLINE' : 'DESCONECTADO')}
                        color={isConnected ? 'success' : (status === 'apiOff' ? 'error' : 'default')}
                        sx={{
                            fontWeight: 'bold',
                            color: '#fff',
                            bgcolor: isConnected ? '#2e7d32' : (status === 'apiOff' ? '#d32f2f' : 'rgba(255,255,255,0.2)'),
                        }}
                    />
                </Box>

                {actionMsg && (
                    <Alert severity={actionMsg.type} sx={{ width: '100%', mb: 3 }} onClose={() => setActionMsg(null)}>
                        {actionMsg.text}
                    </Alert>
                )}

                {/* CARD PRINCIPAL */}
                <Paper className={classes.card}>
                    {status === 'checking' ? (
                        <Box sx={{ py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <CircularProgress color="success" />
                            <Typography variant="body2" color="textSecondary">
                                Verificando conexión con el servicio de WhatsApp...
                            </Typography>
                        </Box>
                    ) : isConnected ? (
                        /* ESTADO: CONECTADO */
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
                            <WhatsAppIcon sx={{ fontSize: 130, color: '#25D366', mb: 2 }} />
                            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#128C7E', mb: 1 }}>
                                WhatsApp Conectado y Operativo
                            </Typography>
                            <Typography variant="body1" color="textSecondary" sx={{ maxWidth: 500, mb: 3 }}>
                                Las alertas satelitales (geocercas, pánico SOS, exceso de velocidad) se están despachando automáticamente desde tu número vinculado.
                            </Typography>

                            <Button
                                variant="outlined"
                                color="error"
                                size="large"
                                startIcon={<PowerSettingsNewIcon />}
                                onClick={handleDisconnect}
                                disabled={loadingQR}
                            >
                                Desconectar WhatsApp
                            </Button>
                        </Box>
                    ) : (
                        /* ESTADO: DESCONECTADO O ESCANEANDO QR */
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', py: 2 }}>
                            <WhatsAppIcon sx={{ fontSize: 100, color: '#dc3545', mb: 2 }} />
                            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                                {qrCode ? 'Escanea el Código QR con tu WhatsApp' : 'WhatsApp Desconectado'}
                            </Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ maxWidth: 520, mb: 3 }}>
                                {qrCode
                                    ? 'Abre WhatsApp en tu teléfono ➡️ Dispositivos vinculados ➡️ Vincular un dispositivo y apunta la cámara a la pantalla.'
                                    : 'Pulsa el botón a continuación para generar un código QR y vincular el WhatsApp corporativo de tu empresa.'}
                            </Typography>

                            {/* DISPLAY DE CÓDIGO QR */}
                            {loadingQR ? (
                                <Box className={classes.qrContainer}>
                                    <CircularProgress color="success" sx={{ my: 4 }} />
                                    <Typography variant="body2" color="textSecondary">
                                        Generando código QR con Evolution API...
                                    </Typography>
                                </Box>
                            ) : qrCode ? (
                                <Box className={classes.qrContainer}>
                                    <img
                                        src={qrCode}
                                        alt="Código QR de WhatsApp"
                                        style={{ width: '100%', maxWidth: '260px', borderRadius: 8, display: 'block' }}
                                    />
                                    <Typography variant="caption" color="textSecondary" sx={{ mt: 1.5 }}>
                                        El código se actualiza automáticamente.
                                    </Typography>
                                    <Button
                                        size="small"
                                        startIcon={<RefreshIcon />}
                                        onClick={handleConnect}
                                        sx={{ mt: 1 }}
                                    >
                                        Actualizar QR
                                    </Button>
                                </Box>
                            ) : null}

                            {/* BOTÓN CONECTAR */}
                            {!qrCode && (
                                <Button
                                    variant="contained"
                                    size="large"
                                    onClick={handleConnect}
                                    disabled={loadingQR || status === 'apiOff'}
                                    startIcon={loadingQR ? <CircularProgress size={20} color="inherit" /> : <QrCode2Icon />}
                                    sx={{
                                        bgcolor: '#25D366',
                                        '&:hover': { bgcolor: '#128C7E' },
                                        fontWeight: 'bold',
                                        px: 4,
                                        py: 1.5,
                                        borderRadius: 3,
                                    }}
                                >
                                    {loadingQR ? 'Iniciando canal...' : 'Conectar WhatsApp'}
                                </Button>
                            )}
                        </Box>
                    )}

                    {/* BANNER INFORMATIVO AISLAMIENTO DE MARCA */}
                    <Box className={classes.infoBox}>
                        <Typography variant="subtitle2" sx={{ color: '#166534', fontWeight: 'bold', mb: 0.5 }}>
                            💡 Aislamiento Estricto de Marca:
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#15803d' }}>
                            Al conectar tu propio número corporativo de WhatsApp, todas las alertas de tu flota (geocercas, pánico SOS, encendido) se despacharán con la identidad y número de tu empresa. Si no conectas tu canal, las alertas se protegen y no se envían por números de terceros.
                        </Typography>
                    </Box>
                </Paper>

                {/* HERRAMIENTA DE PRUEBA DE ENVÍO */}
                {isConnected && (
                    <Paper className={classes.testCard}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SendIcon color="primary" /> Enviar Mensaje de Prueba
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                            Comprueba que tu canal WhatsApp está enviando alertas en tiempo real a tu teléfono móvil.
                        </Typography>

                        {testResponse && (
                            <Alert severity={testResponse.type} sx={{ mb: 2 }} onClose={() => setTestResponse(null)}>
                                {testResponse.text}
                            </Alert>
                        )}

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <TextField
                                label="Número de Teléfono con código de país"
                                placeholder="Ej: 51981005971"
                                value={testPhone}
                                onChange={(e) => setTestPhone(e.target.value)}
                                size="small"
                                fullWidth
                            />
                            <TextField
                                label="Mensaje de Alerta"
                                value={testMsg}
                                onChange={(e) => setTestMsg(e.target.value)}
                                size="small"
                                multiline
                                rows={2}
                                fullWidth
                            />
                            <Box>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    startIcon={sendingTest ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                                    onClick={handleSendTest}
                                    disabled={sendingTest || !testPhone.trim()}
                                >
                                    {sendingTest ? 'Enviando...' : 'Enviar Alerta WhatsApp'}
                                </Button>
                            </Box>
                        </Box>
                    </Paper>
                )}
            </Container>
        </PageLayout>
    );
};

export default WhatsApp;