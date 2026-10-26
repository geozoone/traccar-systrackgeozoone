import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    Container,
    TextField,
    Button,
    Box,
    Paper,
    Chip,
    Alert,
    CircularProgress,
    Divider,
    IconButton,
    Tooltip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
} from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TelegramIcon from '@mui/icons-material/Telegram';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SettingsMenu from '../../settings/components/SettingsMenu';
import PageLayout from '../../common/components/PageLayout';
import { useAdministrator } from '../../common/util/permissions';

const useStyles = makeStyles((theme) => ({
    container: {
        marginTop: theme.spacing(3),
        marginBottom: theme.spacing(4),
    },
    headerCard: {
        padding: theme.spacing(3),
        borderRadius: 16,
        background: 'linear-gradient(135deg, #0088cc 0%, #005f8f 100%)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: theme.spacing(2),
        boxShadow: '0 8px 24px rgba(0, 136, 204, 0.25)',
        marginBottom: theme.spacing(3),
    },
    sectionCard: {
        padding: theme.spacing(3),
        borderRadius: 12,
        marginBottom: theme.spacing(3),
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
    },
    instructionsBox: {
        background: '#f4f9fd',
        border: '1px solid #c8e1f5',
        borderRadius: 8,
        padding: theme.spacing(2),
        marginBottom: theme.spacing(2),
    },
}));

const Telegram = () => {
    const classes = useStyles();
    const currentUser = useSelector((state) => state.session.user);
    const admin = useAdministrator();

    const revendaKey = admin ? 'global' : (currentUser?.id ? String(currentUser.id) : null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [botConfig, setBotConfig] = useState(null);
    const [tokenInput, setTokenInput] = useState('');
    const [statusMsg, setStatusMsg] = useState(null);

    // Test send state
    const [testChatId, setTestChatId] = useState('');
    const [testMessage, setTestMessage] = useState('🔔 Alerta de prueba GeoZoone: Tu bot de Telegram está funcionando correctamente.');
    const [sendingTest, setSendingTest] = useState(false);
    const [testResult, setTestResult] = useState(null);

    // Recent updates (users who started bot)
    const [updates, setUpdates] = useState([]);
    const [loadingUpdates, setLoadingUpdates] = useState(false);
    const [copiedChatId, setCopiedChatId] = useState(null);

    const fetchBotConfig = async () => {
        if (!revendaKey) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const resp = await fetch(`/modulo/telegram/config/${revendaKey}`);
            if (resp.ok) {
                const text = await resp.text();
                try {
                    const data = JSON.parse(text);
                    if (data.configured) {
                        setBotConfig(data);
                    } else {
                        setBotConfig(null);
                    }
                } catch {
                    setBotConfig(null);
                }
            }
        } catch (e) {
            console.error('Error fetching Telegram config:', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchUpdates = async () => {
        if (!botConfig?.configured || !revendaKey) return;
        setLoadingUpdates(true);
        try {
            const resp = await fetch(`/modulo/telegram/updates/${revendaKey}`);
            if (resp.ok) {
                const text = await resp.text();
                try {
                    const data = JSON.parse(text);
                    setUpdates(data.users || []);
                } catch {
                    setUpdates([]);
                }
            }
        } catch (e) {
            console.error('Error fetching updates:', e);
        } finally {
            setLoadingUpdates(false);
        }
    };

    useEffect(() => {
        fetchBotConfig();
    }, [revendaKey]);

    useEffect(() => {
        if (botConfig?.configured) {
            fetchUpdates();
        }
    }, [botConfig]);

    const handleSaveBot = async () => {
        if (!tokenInput.trim()) return;
        if (!revendaKey) {
            setStatusMsg({ type: 'warning', text: 'Cargando datos de usuario... Por favor reintenta en un instante.' });
            return;
        }
        setSaving(true);
        setStatusMsg(null);
        try {
            const resp = await fetch(`/modulo/telegram/config/${revendaKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ botToken: tokenInput.trim() }),
            });
            const text = await resp.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseErr) {
                setStatusMsg({
                    type: 'error',
                    text: `El conector en el VPS devolvió un error (${resp.status}). El microservicio modulo debe ser reconstruido con 'docker compose build modulo && docker compose up -d modulo'.`,
                });
                return;
            }

            if (resp.ok && data.configured) {
                setBotConfig(data);
                setTokenInput('');
                setStatusMsg({ type: 'success', text: `¡Bot @${data.botUsername} vinculado exitosamente!` });
                fetchUpdates();
            } else {
                setStatusMsg({ type: 'error', text: data.error || data.telegramError || 'Error al validar el token con Telegram' });
            }
        } catch (err) {
            setStatusMsg({ type: 'error', text: `Error de red: ${err.message}` });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteBot = async () => {
        if (!window.confirm('¿Estás seguro de que deseas desvincular este Bot de Telegram?')) return;
        setSaving(true);
        try {
            const resp = await fetch(`/modulo/telegram/config/${revendaKey}`, { method: 'DELETE' });
            if (resp.ok) {
                setBotConfig(null);
                setUpdates([]);
                setStatusMsg({ type: 'info', text: 'Bot de Telegram desvinculado.' });
            }
        } catch (err) {
            setStatusMsg({ type: 'error', text: `Error: ${err.message}` });
        } finally {
            setSaving(false);
        }
    };

    const handleSendTest = async () => {
        if (!testChatId.trim()) {
            setTestResult({ type: 'error', text: 'Por favor ingresa un Telegram Chat ID de destino' });
            return;
        }
        setSendingTest(true);
        setTestResult(null);
        try {
            const resp = await fetch(`/modulo/telegram/test/${revendaKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: testChatId.trim(),
                    message: testMessage,
                }),
            });
            const text = await resp.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch {
                setTestResult({ type: 'error', text: `Error del servidor (${resp.status}): ${text.substring(0, 100)}` });
                return;
            }

            if (resp.ok) {
                setTestResult({ type: 'success', text: '¡Alerta de prueba enviada exitosamente a Telegram!' });
            } else {
                setTestResult({ type: 'error', text: data.error || 'Error al enviar mensaje' });
            }
        } catch (err) {
            setTestResult({ type: 'error', text: `Error: ${err.message}` });
        } finally {
            setSendingTest(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(String(text));
        setCopiedChatId(text);
        setTimeout(() => setCopiedChatId(null), 2500);
    };

    return (
        <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'Telegram Bot']}>
            <Container maxWidth="md" className={classes.container}>
                {/* BANNER PRINCIPAL TELEGRAM */}
                <Box className={classes.headerCard}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <TelegramIcon sx={{ fontSize: 56 }} />
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                                Notificaciones por Telegram Bot
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                {admin ? 'Canal Global de Alertas Satelitales' : 'Canal Exclusivo Marca Blanca para tus Clientes'}
                            </Typography>
                        </Box>
                    </Box>
                    <Chip
                        label={botConfig?.configured ? 'BOT CONECTADO' : 'SIN CONFIGURAR'}
                        color={botConfig?.configured ? 'success' : 'default'}
                        sx={{ fontWeight: 'bold', color: '#fff', bgcolor: botConfig?.configured ? '#2e7d32' : 'rgba(255,255,255,0.2)' }}
                    />
                </Box>

                {statusMsg && (
                    <Alert severity={statusMsg.type} sx={{ mb: 3 }} onClose={() => setStatusMsg(null)}>
                        {statusMsg.text}
                    </Alert>
                )}

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
                        <CircularProgress />
                    </Box>
                ) : !botConfig?.configured ? (
                    /* PASO 1: VINCULAR BOT POR PRIMERA VEZ */
                    <Paper className={classes.sectionCard}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <HelpOutlineIcon color="primary" /> ¿Cómo crear tu propio Bot de Telegram?
                        </Typography>

                        <Box className={classes.instructionsBox}>
                            <Typography variant="body2" paragraph>
                                <b>1.</b> Abre Telegram en tu teléfono o PC y busca el contacto oficial <b>@BotFather</b>.
                            </Typography>
                            <Typography variant="body2" paragraph>
                                <b>2.</b> Envíale el comando <code>/newbot</code> y sigue los pasos: asígnale un nombre (ej: <i>Alertas Mi Empresa</i>) y un usuario único que termine en <code>bot</code> (ej: <i>MiEmpresaGpsBot</i>).
                            </Typography>
                            <Typography variant="body2" paragraph>
                                <b>3.</b> BotFather te entregará un token HTTP API como este: <br />
                                <code>7412345678:AAHjklmn_opqrstuvwxyz1234567890</code>
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 0 }}>
                                <b>4.</b> Pega ese token a continuación y pulsa <b>Vincular Bot</b>.
                            </Typography>
                        </Box>

                        <Box sx={{ mt: 3 }}>
                            <TextField
                                label="Token HTTP API del Bot"
                                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                                fullWidth
                                variant="outlined"
                                value={tokenInput}
                                onChange={(e) => setTokenInput(e.target.value)}
                                helperText="Tu token se almacena de forma aislada y nunca se comparte con otros revendedores."
                                sx={{ mb: 2 }}
                            />
                            <Button
                                variant="contained"
                                color="primary"
                                size="large"
                                onClick={handleSaveBot}
                                disabled={saving || !tokenInput.trim()}
                                startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
                            >
                                {saving ? 'Verificando con Telegram...' : 'Vincular Bot de Telegram'}
                            </Button>
                        </Box>
                    </Paper>
                ) : (
                    /* PASO 2: BOT YA VINCULADO - GESTIÓN Y PRUEBAS */
                    <>
                        <Paper className={classes.sectionCard}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                        🤖 {botConfig.botName || 'Bot de Telegram'}
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        Usuario: <b>@{botConfig.botUsername}</b>
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        variant="outlined"
                                        color="primary"
                                        startIcon={<OpenInNewIcon />}
                                        href={botConfig.publicUrl || `https://t.me/${botConfig.botUsername}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Abrir en Telegram
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        startIcon={<DeleteIcon />}
                                        onClick={handleDeleteBot}
                                        disabled={saving}
                                    >
                                        Desvincular
                                    </Button>
                                </Box>
                            </Box>

                            <Divider sx={{ my: 2 }} />

                            <Box sx={{ bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', p: 2, borderRadius: 2 }}>
                                <Typography variant="subtitle2" sx={{ color: '#166534', fontWeight: 'bold', mb: 0.5 }}>
                                    Enlace público para tus clientes:
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', bgcolor: '#fff', p: 1, borderRadius: 1, border: '1px solid #dcfce7', flex: 1 }}>
                                        {botConfig.publicUrl || `https://t.me/${botConfig.botUsername}`}
                                    </Typography>
                                    <Tooltip title={copiedChatId === 'url' ? '¡Copiado!' : 'Copiar Enlace'}>
                                        <IconButton onClick={() => copyToClipboard(botConfig.publicUrl || `https://t.me/${botConfig.botUsername}`)}>
                                            <ContentCopyIcon color={copiedChatId === 'url' ? 'success' : 'action'} />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                                <Typography variant="caption" sx={{ color: '#15803d', display: 'block', mt: 1 }}>
                                    💡 Pide a tus clientes que abran ese enlace y presionen <b>Iniciar (/start)</b>. El bot les responderá con su <b>Telegram Chat ID</b> para colocarlo en su ficha de usuario.
                                </Typography>
                            </Box>
                        </Paper>

                        {/* SECCIÓN DETECCIÓN DE CHAT IDs */}
                        <Paper className={classes.sectionCard}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                        👥 Clientes que iniciaron el Bot
                                    </Typography>
                                    <Typography variant="caption" color="textSecondary">
                                        Usuarios que han interactuado con tu bot recientemente
                                    </Typography>
                                </Box>
                                <Button
                                    size="small"
                                    startIcon={loadingUpdates ? <CircularProgress size={16} /> : <RefreshIcon />}
                                    onClick={fetchUpdates}
                                    disabled={loadingUpdates}
                                >
                                    Actualizar
                                </Button>
                            </Box>

                            {updates.length === 0 ? (
                                <Alert severity="info">
                                    Aún no hay mensajes recientes. Pide a un cliente que abra tu bot <b>@{botConfig.botUsername}</b> y le envíe cualquier mensaje o <code>/start</code>.
                                </Alert>
                            ) : (
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell><b>Nombre</b></TableCell>
                                                <TableCell><b>Usuario</b></TableCell>
                                                <TableCell><b>Telegram Chat ID</b></TableCell>
                                                <TableCell><b>Fecha</b></TableCell>
                                                <TableCell align="center"><b>Acción</b></TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {updates.map((u) => (
                                                <TableRow key={u.chatId} hover>
                                                    <TableCell>{u.firstName} {u.lastName}</TableCell>
                                                    <TableCell>{u.username || '-'}</TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={u.chatId}
                                                            size="small"
                                                            color="primary"
                                                            variant="outlined"
                                                            sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '0.8rem', color: '#666' }}>{u.date}</TableCell>
                                                    <TableCell align="center">
                                                        <Tooltip title={copiedChatId === u.chatId ? '¡Copiado!' : 'Copiar Chat ID'}>
                                                            <IconButton size="small" onClick={() => copyToClipboard(u.chatId)}>
                                                                <ContentCopyIcon fontSize="small" color={copiedChatId === u.chatId ? 'success' : 'inherit'} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </Paper>

                        {/* SECCIÓN PRUEBA DE ENVÍO */}
                        <Paper className={classes.sectionCard}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <SendIcon color="primary" /> Enviar Alerta de Prueba
                            </Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                Verifica la entrega instantánea enviando un mensaje directo a un Chat ID.
                            </Typography>

                            {testResult && (
                                <Alert severity={testResult.type} sx={{ mb: 2 }} onClose={() => setTestResult(null)}>
                                    {testResult.text}
                                </Alert>
                            )}

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <TextField
                                    label="Telegram Chat ID de Destino"
                                    placeholder="Ej: 123456789"
                                    value={testChatId}
                                    onChange={(e) => setTestChatId(e.target.value)}
                                    size="small"
                                    fullWidth
                                />
                                <TextField
                                    label="Mensaje de Alerta"
                                    value={testMessage}
                                    onChange={(e) => setTestMessage(e.target.value)}
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
                                        disabled={sendingTest || !testChatId.trim()}
                                    >
                                        {sendingTest ? 'Enviando...' : 'Enviar Alerta de Prueba'}
                                    </Button>
                                </Box>
                            </Box>
                        </Paper>
                    </>
                )}
            </Container>
        </PageLayout>
    );
};

export default Telegram;
