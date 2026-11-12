import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Chip, IconButton,
    Tabs, Tab, TextField, Switch, FormControlLabel, Checkbox, Tooltip, Divider, Alert, CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import SecurityIcon from '@mui/icons-material/Security';
import AssessmentIcon from '@mui/icons-material/Assessment';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import dayjs from 'dayjs';

const PLAN_DEFINITIONS = {
    TRIAL: {
        key: 'TRIAL',
        label: '🎁 Demo Gratis (7 Días)',
        prefix: 'TRL',
        color: '#d97706',
        bg: '#fef3c7',
        description: 'Desbloquea el 100% de funciones por 7 días para enamorar al cliente. Al vencer, el Copiloto le avisa por voz que su prueba finalizó.',
        defaultDays: 7,
        dailyLimit: 0,
    },
    BASICO: {
        key: 'BASICO',
        label: '🟢 Básico Freemium (5/día)',
        prefix: 'BAS',
        color: '#0d9488',
        bg: '#ccfbf1',
        description: 'Permite hasta 5 consultas de voz por día (solo ubicación por placa). Ideal como gancho gratuito permanente.',
        defaultDays: null,
        dailyLimit: 5,
    },
    PRO: {
        key: 'PRO',
        label: '🔵 Copiloto PRO (Ilimitado)',
        prefix: 'FLT',
        color: '#1d4ed8',
        bg: '#dbeafe',
        description: 'Consultas ilimitadas 24/7, resumen de flota, geocercas, choferes, alertas proactivas ("Avísame cuando..."), ETA y km del día.',
        defaultDays: null,
        dailyLimit: 0,
    },
    CORPORATIVO: {
        key: 'CORPORATIVO',
        label: '🟣 Corporativo + Rutas B2B',
        prefix: 'COR',
        color: '#7e22ce',
        bg: '#f3e8ff',
        description: 'Todo el plan PRO + Generador de Pases de Ruta para clientes terceros y Bloqueo de Motor por Voz con PIN.',
        defaultDays: null,
        dailyLimit: 0,
    },
};

const generateRandomCode = (prefix, customTag = '') => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const numPart = Math.floor(1000 + Math.random() * 9000);
    let suffix = '';
    for (let i = 0; i < 2; i += 1) {
        suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (customTag) {
        const cleanTag = customTag.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
        if (cleanTag.length >= 2) {
            return `${prefix}-${cleanTag}-${numPart.toString().slice(-3)}`;
        }
    }
    return `${prefix}-${numPart}-${suffix}`;
};

export const getCopilotoBadgeInfo = (user) => {
    if (!user || !user.attributes) {
        return { label: 'Activar Copiloto', color: 'default', variant: 'outlined', active: false };
    }
    const attrs = user.attributes;
    const rawToken = String(attrs.voiceToken || attrs.copilotoConfig?.token || '').trim();
    const cfg = attrs.copilotoConfig || null;
    const guestPasses = Array.isArray(attrs.copilotoGuestPasses) ? attrs.copilotoGuestPasses : [];
    const activePasses = guestPasses.filter((p) => p && p.active !== false && (!p.expiresAt || new Date(p.expiresAt) > new Date())).length;
    const passSuffix = activePasses > 0 ? ` +${activePasses} Ruta${activePasses > 1 ? 's' : ''}` : '';

    if (!rawToken && activePasses === 0) {
        return { label: 'Activar Copiloto', color: 'default', variant: 'outlined', active: false };
    }

    if (cfg && cfg.active === false) {
        return { label: `Pausado${passSuffix}`, color: 'default', variant: 'filled', active: false, bg: '#f1f5f9', textColor: '#64748b' };
    }

    if (cfg && cfg.expiresAt && new Date(cfg.expiresAt) < new Date()) {
        return {
            label: cfg.plan === 'TRIAL' ? `Demo Vencido${passSuffix}` : `Licencia Vencida${passSuffix}`,
            color: 'error',
            variant: 'filled',
            active: false,
            bg: '#fee2e2',
            textColor: '#b91c1c',
        };
    }

    const totalUses = Number(cfg?.stats?.totalQueries || 0);
    const usesText = totalUses > 0 ? ` (${totalUses})` : '';

    if (cfg?.plan === 'TRIAL') {
        const daysLeft = cfg.expiresAt ? Math.max(0, dayjs(cfg.expiresAt).diff(dayjs(), 'day') + 1) : 7;
        return {
            label: `🎁 Demo ${daysLeft}d${usesText}${passSuffix}`,
            color: 'warning',
            variant: 'filled',
            active: true,
            bg: '#fef3c7',
            textColor: '#b45309',
        };
    }

    if (cfg?.plan === 'BASICO') {
        const todayLima = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
        const todayCount = cfg?.stats?.todayDate === todayLima ? Number(cfg?.stats?.todayQueries || 0) : 0;
        return {
            label: `🟢 Básico ${todayCount}/5${passSuffix}`,
            color: 'success',
            variant: 'filled',
            active: true,
            bg: '#ccfbf1',
            textColor: '#0f766e',
        };
    }

    if (cfg?.plan === 'CORPORATIVO') {
        return {
            label: `🟣 Corp${usesText}${passSuffix}`,
            color: 'secondary',
            variant: 'filled',
            active: true,
            bg: '#f3e8ff',
            textColor: '#6b21a8',
        };
    }

    return {
        label: `🎙️ PRO${usesText}${passSuffix}`,
        color: 'primary',
        variant: 'filled',
        active: true,
        bg: '#dbeafe',
        textColor: '#1d4ed8',
    };
};

const CopilotoTokenModal = ({
    open,
    onClose,
    targetUser,
    devices = [],
    isAdmin = false,
    onUserUpdated,
}) => {
    const [tabIndex, setTabIndex] = useState(0);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [copiedKey, setCopiedKey] = useState(null);
    const [localDevices, setLocalDevices] = useState([]);
    const [loadingDevices, setLoadingDevices] = useState(false);

    // Estado de la Licencia Principal
    const [plan, setPlan] = useState('TRIAL');
    const [token, setToken] = useState('');
    const [active, setActive] = useState(true);
    const [durationOption, setDurationOption] = useState('7D'); // '7D' | '15D' | '30D' | '365D' | 'UNLIMITED'
    const [dailyLimit, setDailyLimit] = useState(0);
    const [allowCommands, setAllowCommands] = useState(false);
    const [commandPin, setCommandPin] = useState('');
    const [stats, setStats] = useState({ totalQueries: 0, todayQueries: 0, todayDate: '', lastQueryAt: null });
    const [trialAlreadyUsed, setTrialAlreadyUsed] = useState(false);

    // Estado de Pases de Ruta B2B (Clientes Terceros)
    const [guestPasses, setGuestPasses] = useState([]);
    const [editingPassId, setEditingPassId] = useState(null);
    const [passClientName, setPassClientName] = useState('');
    const [passToken, setPassToken] = useState('');
    const [passDuration, setPassDuration] = useState('TODAY'); // 'TODAY' | '24H' | '48H' | '7D' | 'RECURRENT'
    const [passHideDriver, setPassHideDriver] = useState(false);
    const [passSelectedDevices, setPassSelectedDevices] = useState([]);
    const [deviceSearch, setDeviceSearch] = useState('');

    const isResellerTarget = Boolean(targetUser?.attributes?.nivel == 2);

    // Cargar datos al abrir el modal
    useEffect(() => {
        if (!open || !targetUser) return;
        setFeedback(null);
        setTabIndex(0);

        const attrs = targetUser.attributes || {};
        const existingCfg = attrs.copilotoConfig || null;
        const existingToken = String(attrs.voiceToken || existingCfg?.token || '').trim();
        const existingPasses = Array.isArray(attrs.copilotoGuestPasses) ? attrs.copilotoGuestPasses : [];

        setTrialAlreadyUsed(Boolean(existingCfg?.trialUsed));

        if (existingCfg) {
            setPlan(existingCfg.plan || 'PRO');
            setToken(existingToken);
            setActive(existingCfg.active !== false);
            setDailyLimit(Number(existingCfg.dailyLimit || (existingCfg.plan === 'BASICO' ? 5 : 0)));
            setAllowCommands(Boolean(existingCfg.allowCommands));
            setCommandPin(String(existingCfg.commandPin || ''));
            setStats(existingCfg.stats || { totalQueries: 0, todayQueries: 0, todayDate: '', lastQueryAt: null });

            if (!existingCfg.expiresAt) {
                setDurationOption('UNLIMITED');
            } else {
                const diffDays = dayjs(existingCfg.expiresAt).diff(dayjs(), 'day');
                if (diffDays <= 8) setDurationOption('7D');
                else if (diffDays <= 16) setDurationOption('15D');
                else if (diffDays <= 35) setDurationOption('30D');
                else setDurationOption('365D');
            }
        } else if (existingToken) {
            setPlan('PRO');
            setToken(existingToken);
            setActive(true);
            setDurationOption('UNLIMITED');
            setDailyLimit(0);
            setAllowCommands(false);
            setCommandPin('');
            setStats({ totalQueries: 0, todayQueries: 0, todayDate: '', lastQueryAt: null });
        } else {
            // Nuevo usuario sin token aún: sugerir DEMO 7 DÍAS por defecto
            const defaultPlan = isResellerTarget ? 'PRO' : 'TRIAL';
            const prefix = isResellerTarget ? 'REV' : PLAN_DEFINITIONS[defaultPlan].prefix;
            setPlan(defaultPlan);
            setToken(generateRandomCode(prefix, targetUser.name));
            setActive(true);
            setDurationOption(isResellerTarget ? '30D' : '7D');
            setDailyLimit(0);
            setAllowCommands(false);
            setCommandPin(Math.floor(1000 + Math.random() * 9000).toString());
            setStats({ totalQueries: 0, todayQueries: 0, todayDate: '', lastQueryAt: null });
        }

        setGuestPasses(existingPasses);
        resetPassForm();
    }, [open, targetUser, isResellerTarget]);

    // Cargar dispositivos del usuario si no vinieron pre-cargados
    useEffect(() => {
        if (!open || !targetUser) return;
        if (devices && devices.length > 0) {
            setLocalDevices(devices);
            return;
        }
        let activeMount = true;
        setLoadingDevices(true);
        fetch(`/api/devices?userId=${targetUser.id}`)
            .then((r) => (r.ok ? r.json() : []))
            .then((data) => {
                if (activeMount) setLocalDevices(Array.isArray(data) ? data : []);
            })
            .catch(() => {})
            .finally(() => {
                if (activeMount) setLoadingDevices(false);
            });
        return () => {
            activeMount = false;
        };
    }, [open, targetUser, devices]);

    const resetPassForm = () => {
        setEditingPassId(null);
        setPassClientName('');
        setPassToken(generateRandomCode('RUT'));
        setPassDuration('TODAY');
        setPassHideDriver(false);
        setPassSelectedDevices([]);
        setDeviceSearch('');
    };

    const handleSelectPlan = (newPlan) => {
        setPlan(newPlan);
        const prefix = isResellerTarget ? 'REV' : PLAN_DEFINITIONS[newPlan].prefix;
        // Actualizar prefijo del token manteniendo el sufijo o generando uno limpio
        setToken(generateRandomCode(prefix, targetUser?.name));

        if (newPlan === 'TRIAL') {
            setDurationOption('7D');
            setDailyLimit(0);
            setAllowCommands(false);
        } else if (newPlan === 'BASICO') {
            setDurationOption('UNLIMITED');
            setDailyLimit(5);
            setAllowCommands(false);
        } else if (newPlan === 'PRO') {
            setDurationOption('30D');
            setDailyLimit(0);
        } else if (newPlan === 'CORPORATIVO') {
            setDurationOption('30D');
            setDailyLimit(0);
            setAllowCommands(true);
            if (!commandPin) {
                setCommandPin(Math.floor(1000 + Math.random() * 9000).toString());
            }
        }
    };

    const handleRegenerateMainToken = () => {
        const prefix = isResellerTarget ? 'REV' : (PLAN_DEFINITIONS[plan]?.prefix || 'FLT');
        setToken(generateRandomCode(prefix, targetUser?.name));
    };

    const computeExpirationIso = (opt) => {
        if (opt === 'UNLIMITED') return null;
        const now = dayjs();
        if (opt === '7D') return now.add(7, 'day').endOf('day').toISOString();
        if (opt === '15D') return now.add(15, 'day').endOf('day').toISOString();
        if (opt === '30D') return now.add(30, 'day').endOf('day').toISOString();
        if (opt === '365D') return now.add(365, 'day').endOf('day').toISOString();
        return null;
    };

    const computePassExpirationIso = (opt) => {
        const now = dayjs();
        if (opt === 'TODAY') return now.endOf('day').toISOString();
        if (opt === '24H') return now.add(24, 'hour').toISOString();
        if (opt === '48H') return now.add(48, 'hour').toISOString();
        if (opt === '7D') return now.add(7, 'day').endOf('day').toISOString();
        return null; // RECURRENT
    };

    const handleCopyText = (text, key) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2200);
    };

    const handleCopyWhatsAppMain = () => {
        const expText = durationOption === 'UNLIMITED'
            ? 'Permanente'
            : durationOption === '7D'
                ? '7 días de Prueba Gratis'
                : durationOption === '15D'
                    ? '15 días'
                    : durationOption === '30D'
                        ? 'Mensual (30 días)'
                        : 'Anual (365 días)';

        const msg = [
            `🎙️ *Bienvenido a GeoZoone Copiloto de Voz*`,
            `Hola *${targetUser?.name || 'Cliente'}*, ya está activo tu asistente inteligente de telemetría por voz manos libres.`,
            ``,
            `🔑 *Tu Token Secreto de Acceso:*`,
            `*${token}*`,
            ``,
            `📋 *Plan asignado:* ${PLAN_DEFINITIONS[plan]?.label || plan} (${expText})`,
            `🌐 *Servidor GPS:* https://gps.geozoone.com`,
            `🗣️ *Palabra Clave:* Geozoone`,
            ``,
            `📲 *Pasos para activarlo en tu celular:*`,
            `1. Abre la app *GeoZoone Copiloto* y baja a *Configuración del Servidor*.`,
            `2. Pega tu Token *${token}* y presiona *Guardar*.`,
            `3. Toca el botón verde *Activar Copiloto* y pregunta por voz: *"¿Dónde está el..."* o *"¿Cómo está la flota?"*`,
        ].join('\n');

        handleCopyText(msg, 'wa_main');
    };

    const handleCopyWhatsAppPass = (passItem) => {
        const assignedPlates = localDevices
            .filter((d) => passItem.deviceIds?.includes(d.id))
            .map((d) => d.name)
            .join(', ');

        const expLabel = passItem.expiresAt
            ? `Vigente hasta ${dayjs(passItem.expiresAt).format('DD/MM/YYYY HH:mm')}`
            : 'Pase Recurrente de Despacho';

        const msg = [
            `🚛 *Pase de Seguimiento por Voz — GeoZoone Copiloto*`,
            `Estimado cliente *${passItem.clientName}*, compartimos su código de acceso para consultar en tiempo real la ubicación de las unidades asignadas a su despacho:`,
            ``,
            `🔑 *Token de Ruta:* *${passItem.token}*`,
            `🚚 *Unidades autorizadas hoy:* ${assignedPlates || 'Ninguna asignada aún'}`,
            `⏳ *Vigencia:* ${expLabel}`,
            ``,
            `📲 En la app *GeoZoone Copiloto*, ingrese el Token *${passItem.token}*, presione *Guardar* y consulte con su voz diciendo: *"¿Dónde está el ${assignedPlates.split(',')[0]?.trim() || 'camión'}?"* o *"¿En cuánto tiempo llega?"*`,
        ].join('\n');

        handleCopyText(msg, `wa_pass_${passItem.id}`);
    };

    const handleSavePassToList = () => {
        if (!passClientName.trim()) {
            setFeedback({ type: 'warning', text: 'Ingresa el nombre de la empresa o cliente receptor del despacho.' });
            return;
        }
        if (passSelectedDevices.length === 0) {
            setFeedback({ type: 'warning', text: 'Selecciona al menos 1 vehículo para este Pase de Ruta.' });
            return;
        }

        const cleanCode = passToken.trim() || generateRandomCode('RUT', passClientName);
        const expiresAt = computePassExpirationIso(passDuration);

        if (editingPassId) {
            setGuestPasses((prev) => prev.map((p) => (p.id === editingPassId ? {
                ...p,
                clientName: passClientName.trim(),
                token: cleanCode,
                deviceIds: passSelectedDevices,
                durationType: passDuration,
                expiresAt,
                hideDriverName: passHideDriver,
                active: true,
            } : p)));
        } else {
            const newPass = {
                id: `pass_${Date.now()}`,
                clientName: passClientName.trim(),
                token: cleanCode,
                deviceIds: passSelectedDevices,
                durationType: passDuration,
                expiresAt,
                hideDriverName: passHideDriver,
                active: true,
                createdAt: new Date().toISOString(),
                stats: { totalQueries: 0, todayQueries: 0, todayDate: '', lastQueryAt: null },
            };
            setGuestPasses((prev) => [newPass, ...prev]);
        }

        setFeedback({ type: 'success', text: 'Pase de Ruta listo. Recuerda presionar "Guardar Cambios" abajo para aplicarlo en el servidor.' });
        resetPassForm();
    };

    const handleEditPass = (passItem) => {
        setEditingPassId(passItem.id);
        setPassClientName(passItem.clientName || '');
        setPassToken(passItem.token || '');
        setPassDuration(passItem.durationType || 'TODAY');
        setPassHideDriver(Boolean(passItem.hideDriverName));
        setPassSelectedDevices(Array.isArray(passItem.deviceIds) ? passItem.deviceIds : []);
    };

    const handleDeletePass = (passId) => {
        setGuestPasses((prev) => prev.filter((p) => p.id !== passId));
    };

    const togglePassDevice = (devId) => {
        setPassSelectedDevices((prev) => (
            prev.includes(devId) ? prev.filter((id) => id !== devId) : [...prev, devId]
        ));
    };

    const filteredDevices = useMemo(() => {
        if (!deviceSearch.trim()) return localDevices;
        const q = deviceSearch.toLowerCase().trim();
        return localDevices.filter((d) => (
            (d.name && d.name.toLowerCase().includes(q)) ||
            (d.uniqueId && String(d.uniqueId).toLowerCase().includes(q)) ||
            (d.contact && d.contact.toLowerCase().includes(q))
        ));
    }, [localDevices, deviceSearch]);

    const handleSaveAll = async () => {
        if (!targetUser) return;
        setSaving(true);
        setFeedback(null);

        try {
            // Obtener el objeto fresco del usuario para no pisar otros atributos
            const getResp = await fetch(`/api/users/${targetUser.id}`);
            if (!getResp.ok) {
                throw new Error('No se pudo obtener el registro actual del usuario.');
            }
            const freshUser = await getResp.json();
            const currentAttrs = freshUser.attributes || {};

            const expiresAt = computeExpirationIso(durationOption);
            const cleanMainToken = token.trim();

            const updatedConfig = {
                token: cleanMainToken,
                roleType: isResellerTarget ? 'REVENDEDOR' : 'FLOTA',
                plan,
                active,
                durationOption,
                expiresAt,
                dailyLimit: plan === 'BASICO' ? (Number(dailyLimit) || 5) : 0,
                allowCommands: Boolean(allowCommands),
                commandPin: String(commandPin || '').trim(),
                trialUsed: plan === 'TRIAL' ? true : Boolean(currentAttrs.copilotoConfig?.trialUsed),
                updatedAt: new Date().toISOString(),
                stats: currentAttrs.copilotoConfig?.stats || stats,
            };

            const updatedUserPayload = {
                ...freshUser,
                attributes: {
                    ...currentAttrs,
                    voiceToken: active ? cleanMainToken : cleanMainToken,
                    copilotoConfig: updatedConfig,
                    copilotoGuestPasses: guestPasses,
                },
            };

            const putResp = await fetch(`/api/users/${targetUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedUserPayload),
            });

            if (!putResp.ok) {
                throw new Error(await putResp.text());
            }

            const savedUser = await putResp.json();
            setFeedback({
                type: 'success',
                text: '¡Licencia y Tokens de GeoZoone Copiloto guardados y activados inmediatamente!',
            });

            if (onUserUpdated) {
                onUserUpdated(savedUser);
            }
        } catch (err) {
            setFeedback({
                type: 'error',
                text: `Error al guardar: ${err.message}`,
            });
        } finally {
            setSaving(false);
        }
    };

    const todayLima = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const todayQueriesCount = stats?.todayDate === todayLima ? Number(stats?.todayQueries || 0) : 0;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
                color: '#fff',
                py: 1.8,
                px: 2.5,
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <RecordVoiceOverIcon sx={{ fontSize: 28, color: '#38bdf8' }} />
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.2 }}>
                            Generador Inteligente de Tokens — GeoZoone Copiloto
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#bae6fd', display: 'block' }}>
                            {isResellerTarget ? '🏢 Cuenta Revendedor (Acceso Multi-Flota)' : '🚛 Cuenta Cliente / Flota'} • {targetUser?.name || ''}
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={onClose} size="small" sx={{ color: '#fff' }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: '#f8fafc', px: 2 }}>
                <Tabs
                    value={tabIndex}
                    onChange={(_, v) => setTabIndex(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                >
                    <Tab
                        icon={<RecordVoiceOverIcon fontSize="small" />}
                        iconPosition="start"
                        label="1. Licencia Principal (1 Clic)"
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                    />
                    <Tab
                        icon={<DirectionsCarIcon fontSize="small" />}
                        iconPosition="start"
                        label={`2. Pases de Ruta / Clientes Terceros (${guestPasses.length})`}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                    />
                    <Tab
                        icon={<SecurityIcon fontSize="small" />}
                        iconPosition="start"
                        label="3. Comandos por Voz (PIN)"
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                    />
                </Tabs>
            </Box>

            <DialogContent dividers sx={{ p: 2.5, backgroundColor: '#ffffff' }}>
                {feedback && (
                    <Alert severity={feedback.type} sx={{ mb: 2 }} onClose={() => setFeedback(null)}>
                        {feedback.text}
                    </Alert>
                )}

                {/* ================================================================= */}
                {/* PESTAÑA 1: LICENCIA Y TOKEN PRINCIPAL                             */}
                {/* ================================================================= */}
                {tabIndex === 0 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                        {/* Termómetro Comercial de Uso */}
                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                            gap: 1.5,
                            p: 1.5,
                            borderRadius: 2,
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                                <AssessmentIcon color="primary" />
                                <Box>
                                    <Typography variant="caption" color="textSecondary">Consultas de Voz Hoy</Typography>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                                        {todayQueriesCount} {plan === 'BASICO' ? `/ ${dailyLimit || 5} gratis` : 'consultas'}
                                    </Typography>
                                </Box>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="textSecondary">Uso Total Acumulado</Typography>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.1, color: '#0f172a' }}>
                                    {stats?.totalQueries || 0} consultas habladas
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="textSecondary">Última Consulta por Voz</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {stats?.lastQueryAt ? dayjs(stats.lastQueryAt).format('DD/MM/YYYY HH:mm') : 'Aún no ha consultado'}
                                </Typography>
                            </Box>
                        </Box>

                        {/* Selector de Plan Comercial */}
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#1e293b' }}>
                                A. Selecciona el Plan / Modalidad del Token:
                            </Typography>
                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.2 }}>
                                {Object.values(PLAN_DEFINITIONS).map((p) => {
                                    const isSelected = plan === p.key;
                                    const isDisabledTrial = p.key === 'TRIAL' && trialAlreadyUsed && !isAdmin;
                                    return (
                                        <Box
                                            key={p.key}
                                            onClick={() => !isDisabledTrial && handleSelectPlan(p.key)}
                                            sx={{
                                                p: 1.5,
                                                borderRadius: 2,
                                                cursor: isDisabledTrial ? 'not-allowed' : 'pointer',
                                                opacity: isDisabledTrial ? 0.55 : 1,
                                                border: isSelected ? `2px solid ${p.color}` : '1px solid #cbd5e1',
                                                backgroundColor: isSelected ? p.bg : '#fff',
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: p.color }}>
                                                    {p.label}
                                                </Typography>
                                                {isSelected && <Chip size="small" label="Seleccionado" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }} />}
                                            </Box>
                                            <Typography variant="caption" sx={{ color: '#475569', display: 'block', lineHeight: 1.3 }}>
                                                {p.description}
                                            </Typography>
                                            {isDisabledTrial && (
                                                <Typography variant="caption" sx={{ color: '#dc2626', fontWeight: 700, display: 'block', mt: 0.5 }}>
                                                    ⚠️ Este cliente ya utilizó su periodo de prueba gratis.
                                                </Typography>
                                            )}
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>

                        {/* Tarjeta del Token Generado en 1 Clic */}
                        <Box sx={{
                            p: 2,
                            borderRadius: 2,
                            backgroundColor: '#f0f9ff',
                            border: '1px solid #bae6fd',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1.5,
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0369a1' }}>
                                    B. Código de Token Generado ({isResellerTarget ? 'Prefijo REV = Revendedor' : `Prefijo ${PLAN_DEFINITIONS[plan]?.prefix || 'FLT'}`}):
                                </Typography>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={active}
                                            onChange={(e) => setActive(e.target.checked)}
                                            color="success"
                                        />
                                    }
                                    label={
                                        <Typography variant="body2" sx={{ fontWeight: 700, color: active ? '#15803d' : '#b91c1c' }}>
                                            {active ? '🟢 Token Activo' : '🔴 Servicio Pausado'}
                                        </Typography>
                                    }
                                />
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <TextField
                                    size="small"
                                    value={token}
                                    onChange={(e) => setToken(e.target.value.toUpperCase())}
                                    label="Token Secreto Copiloto"
                                    sx={{
                                        flexGrow: 1,
                                        backgroundColor: '#fff',
                                        '& input': { fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem', letterSpacing: 1 },
                                    }}
                                />
                                <Tooltip title="Generar un nuevo código aleatorio (invalida el anterior al guardar)">
                                    <Button
                                        variant="outlined"
                                        startIcon={<AutorenewIcon />}
                                        onClick={handleRegenerateMainToken}
                                        sx={{ textTransform: 'none', fontWeight: 600 }}
                                    >
                                        Regenerar
                                    </Button>
                                </Tooltip>
                                <Button
                                    variant="outlined"
                                    color={copiedKey === 'token_raw' ? 'success' : 'primary'}
                                    startIcon={copiedKey === 'token_raw' ? <CheckIcon /> : <ContentCopyIcon />}
                                    onClick={() => handleCopyText(token, 'token_raw')}
                                    sx={{ textTransform: 'none', fontWeight: 600 }}
                                >
                                    {copiedKey === 'token_raw' ? '¡Copiado!' : 'Copiar Token'}
                                </Button>
                                <Button
                                    variant="contained"
                                    color="success"
                                    startIcon={copiedKey === 'wa_main' ? <CheckIcon /> : <WhatsAppIcon />}
                                    onClick={handleCopyWhatsAppMain}
                                    sx={{ textTransform: 'none', fontWeight: 700 }}
                                >
                                    {copiedKey === 'wa_main' ? '¡Mensaje Copiado!' : 'Copiar para WhatsApp'}
                                </Button>
                            </Box>

                            {/* Vigencia / Expiración */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', mr: 1 }}>
                                    Vigencia del Token:
                                </Typography>
                                {[
                                    { key: '7D', label: '7 Días (Trial)' },
                                    { key: '15D', label: '15 Días' },
                                    { key: '30D', label: '30 Días (Mensual)' },
                                    { key: '365D', label: '1 Año' },
                                    { key: 'UNLIMITED', label: 'Ilimitado (Sin caducidad)' },
                                ].map((dOpt) => (
                                    <Chip
                                        key={dOpt.key}
                                        label={dOpt.label}
                                        size="small"
                                        clickable
                                        color={durationOption === dOpt.key ? 'primary' : 'default'}
                                        variant={durationOption === dOpt.key ? 'filled' : 'outlined'}
                                        onClick={() => setDurationOption(dOpt.key)}
                                        sx={{ fontWeight: 600 }}
                                    />
                                ))}
                            </Box>
                        </Box>
                    </Box>
                )}

                {/* ================================================================= */}
                {/* PESTAÑA 2: PASES DE RUTA / CLIENTES TERCEROS (TRACKING DEL DÍA)   */}
                {/* ================================================================= */}
                {tabIndex === 1 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                        <Alert severity="info" sx={{ py: 0.8 }}>
                            <strong>¿Tu cliente le despacha camiones a otra empresa (ej. Alicorp, Brenntag, Minera)?</strong><br />
                            Crea aquí un <strong>Token de Ruta (`RUT-...`)</strong> y marca con un check (☑️) únicamente los vehículos que saldrán hoy para ese comprador. El tercero solo podrá consultar por voz esos camiones y nada más.
                        </Alert>

                        {/* Formulario de Creación / Edición de Pase de Ruta */}
                        <Box sx={{ p: 2, borderRadius: 2, border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#0f172a' }}>
                                {editingPassId ? '✏️ Editando Pase de Ruta' : '➕ Crear Nuevo Pase de Ruta / Cliente Receptor'}
                            </Typography>

                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 1.5 }}>
                                <TextField
                                    size="small"
                                    label="Nombre de Empresa Receptora / Despacho"
                                    placeholder="Ej: Alicorp - Despacho Lima"
                                    value={passClientName}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setPassClientName(val);
                                        if (!editingPassId) {
                                            setPassToken(generateRandomCode('RUT', val));
                                        }
                                    }}
                                    sx={{ backgroundColor: '#fff' }}
                                />
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <TextField
                                        size="small"
                                        label="Token del Receptor"
                                        value={passToken}
                                        onChange={(e) => setPassToken(e.target.value.toUpperCase())}
                                        sx={{ flexGrow: 1, backgroundColor: '#fff', '& input': { fontFamily: 'monospace', fontWeight: 700 } }}
                                    />
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => setPassToken(generateRandomCode('RUT', passClientName))}
                                    >
                                        <AutorenewIcon fontSize="small" />
                                    </Button>
                                </Box>
                            </Box>

                            {/* Duración del Pase */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap', mb: 1.5 }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, mr: 0.5 }}>
                                    Duración del Pase:
                                </Typography>
                                {[
                                    { key: 'TODAY', label: 'Solo por Hoy (hasta 11:59 PM)' },
                                    { key: '24H', label: '24 Horas' },
                                    { key: '48H', label: '48 Horas' },
                                    { key: '7D', label: '7 Días' },
                                    { key: 'RECURRENT', label: 'Cliente Recurrente (Fijo)' },
                                ].map((opt) => (
                                    <Chip
                                        key={opt.key}
                                        size="small"
                                        label={opt.label}
                                        clickable
                                        color={passDuration === opt.key ? 'primary' : 'default'}
                                        variant={passDuration === opt.key ? 'filled' : 'outlined'}
                                        onClick={() => setPassDuration(opt.key)}
                                        sx={{ fontWeight: 600 }}
                                    />
                                ))}
                            </Box>

                            <FormControlLabel
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={passHideDriver}
                                        onChange={(e) => setPassHideDriver(e.target.checked)}
                                    />
                                }
                                label={<Typography variant="caption">Privacidad: Ocultar el nombre del chofer cuando este tercero consulte por voz</Typography>}
                                sx={{ mb: 1 }}
                            />

                            {/* Selector de Vehículos Asignados Hoy */}
                            <Box sx={{ mt: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#1e293b' }}>
                                        Selecciona los vehículos autorizados hoy ({passSelectedDevices.length} marcados):
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <TextField
                                            size="small"
                                            placeholder="Buscar placa..."
                                            value={deviceSearch}
                                            onChange={(e) => setDeviceSearch(e.target.value)}
                                            sx={{ width: 150, backgroundColor: '#fff', '& input': { py: 0.4, fontSize: '0.78rem' } }}
                                        />
                                        <Button
                                            size="small"
                                            variant="text"
                                            onClick={() => setPassSelectedDevices(filteredDevices.map((d) => d.id))}
                                            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                                        >
                                            Marcar todos
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="text"
                                            color="inherit"
                                            onClick={() => setPassSelectedDevices([])}
                                            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                                        >
                                            Limpiar
                                        </Button>
                                    </Box>
                                </Box>

                                {loadingDevices ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                                        <CircularProgress size={18} />
                                        <Typography variant="caption">Cargando flota del cliente...</Typography>
                                    </Box>
                                ) : localDevices.length === 0 ? (
                                    <Typography variant="caption" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                                        Este cliente no tiene vehículos vinculados todavía.
                                    </Typography>
                                ) : (
                                    <Box sx={{
                                        maxHeight: 165,
                                        overflowY: 'auto',
                                        p: 1,
                                        backgroundColor: '#fff',
                                        borderRadius: 1.5,
                                        border: '1px solid #e2e8f0',
                                        display: 'grid',
                                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                                        gap: 0.5,
                                    }}>
                                        {filteredDevices.map((dev) => {
                                            const checked = passSelectedDevices.includes(dev.id);
                                            return (
                                                <FormControlLabel
                                                    key={dev.id}
                                                    sx={{
                                                        m: 0,
                                                        px: 0.8,
                                                        py: 0.2,
                                                        borderRadius: 1,
                                                        backgroundColor: checked ? '#dbeafe' : 'transparent',
                                                    }}
                                                    control={
                                                        <Checkbox
                                                            size="small"
                                                            checked={checked}
                                                            onChange={() => togglePassDevice(dev.id)}
                                                        />
                                                    }
                                                    label={
                                                        <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: checked ? 700 : 500 }}>
                                                            {dev.name}
                                                        </Typography>
                                                    }
                                                />
                                            );
                                        })}
                                    </Box>
                                )}
                            </Box>

                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.5 }}>
                                {editingPassId && (
                                    <Button size="small" onClick={resetPassForm} sx={{ textTransform: 'none' }}>
                                        Cancelar edición
                                    </Button>
                                )}
                                <Button
                                    size="small"
                                    variant="contained"
                                    startIcon={<AddCircleOutlineIcon />}
                                    onClick={handleSavePassToList}
                                    sx={{ textTransform: 'none', fontWeight: 700 }}
                                >
                                    {editingPassId ? 'Actualizar Pase en la Lista' : 'Agregar Pase de Ruta'}
                                </Button>
                            </Box>
                        </Box>

                        {/* Lista de Pases de Ruta Creados */}
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                Pases de Ruta Configurados ({guestPasses.length}):
                            </Typography>
                            {guestPasses.length === 0 ? (
                                <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                                    No hay pases de ruta para terceros creados aún.
                                </Typography>
                            ) : (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {guestPasses.map((gp) => {
                                        const isExpired = gp.expiresAt && new Date(gp.expiresAt) < new Date();
                                        const plateNames = localDevices
                                            .filter((d) => gp.deviceIds?.includes(d.id))
                                            .map((d) => d.name);

                                        return (
                                            <Box
                                                key={gp.id}
                                                sx={{
                                                    p: 1.5,
                                                    borderRadius: 1.5,
                                                    border: '1px solid #e2e8f0',
                                                    backgroundColor: isExpired ? '#fef2f2' : '#ffffff',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    flexWrap: 'wrap',
                                                    gap: 1,
                                                }}
                                            >
                                                <Box>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                            {gp.clientName}
                                                        </Typography>
                                                        <Chip
                                                            size="small"
                                                            label={gp.token}
                                                            sx={{ fontFamily: 'monospace', fontWeight: 800, backgroundColor: '#e0f2fe', color: '#0369a1' }}
                                                        />
                                                        <Chip
                                                            size="small"
                                                            label={isExpired ? 'Vencido' : (gp.expiresAt ? `Vence ${dayjs(gp.expiresAt).format('DD/MM HH:mm')}` : 'Recurrente')}
                                                            color={isExpired ? 'error' : 'success'}
                                                            variant="outlined"
                                                            sx={{ height: 20, fontSize: '0.68rem' }}
                                                        />
                                                        <Chip
                                                            size="small"
                                                            label={`${gp.stats?.totalQueries || 0} consultas`}
                                                            sx={{ height: 20, fontSize: '0.68rem' }}
                                                        />
                                                    </Box>
                                                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.4 }}>
                                                        <strong>Unidades asignadas hoy ({plateNames.length}):</strong> {plateNames.join(', ') || 'Ninguna placa seleccionada'}
                                                    </Typography>
                                                </Box>

                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <Tooltip title="Cambiar qué placas viajan hoy para este cliente">
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            startIcon={<EditIcon fontSize="small" />}
                                                            onClick={() => handleEditPass(gp)}
                                                            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                                                        >
                                                            Placas de Hoy
                                                        </Button>
                                                    </Tooltip>
                                                    <Tooltip title="Copiar invitación de WhatsApp para este receptor">
                                                        <Button
                                                            size="small"
                                                            variant="contained"
                                                            color="success"
                                                            startIcon={copiedKey === `wa_pass_${gp.id}` ? <CheckIcon fontSize="small" /> : <WhatsAppIcon fontSize="small" />}
                                                            onClick={() => handleCopyWhatsAppPass(gp)}
                                                            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                                                        >
                                                            {copiedKey === `wa_pass_${gp.id}` ? 'Copiado' : 'WhatsApp'}
                                                        </Button>
                                                    </Tooltip>
                                                    <IconButton size="small" color="error" onClick={() => handleDeletePass(gp.id)}>
                                                        <DeleteOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            )}
                        </Box>
                    </Box>
                )}

                {/* ================================================================= */}
                {/* PESTAÑA 3: SEGURIDAD DE COMANDOS DE MOTOR POR VOZ                 */}
                {/* ================================================================= */}
                {tabIndex === 2 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Alert severity="warning">
                            <strong>Control de Corte y Restauración de Motor por Voz (Nivel 4):</strong><br />
                            Cuando está activo, el titular puede bloquear o desbloquear el motor de una unidad en caso de emergencia dictando su <strong>PIN numérico secreto de 4 dígitos</strong>.
                        </Alert>

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={allowCommands}
                                    onChange={(e) => setAllowCommands(e.target.checked)}
                                    color="secondary"
                                />
                            }
                            label={
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    Habilitar Bloqueo y Restauración de Motor por Voz para este Token
                                </Typography>
                            }
                        />

                        {allowCommands && (
                            <Box sx={{ p: 2, borderRadius: 2, backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <TextField
                                        size="small"
                                        label="PIN Secreto de Voz (4 dígitos)"
                                        value={commandPin}
                                        onChange={(e) => setCommandPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        sx={{ width: 220, backgroundColor: '#fff', '& input': { fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem', letterSpacing: 2 } }}
                                    />
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        color="secondary"
                                        onClick={() => setCommandPin(Math.floor(1000 + Math.random() * 9000).toString())}
                                        sx={{ textTransform: 'none' }}
                                    >
                                        Generar PIN Aleatorio
                                    </Button>
                                </Box>
                                <Divider />
                                <Typography variant="caption" sx={{ color: '#581c87' }}>
                                    🗣️ <strong>Ejemplo de orden por voz:</strong><br />
                                    • <em>«Geozoone, bloquear motor del 808 código {commandPin || '4590'}»</em><br />
                                    • <em>«Geozoone, restaurar motor del 808 código {commandPin || '4590'}»</em>
                                </Typography>
                            </Box>
                        )}
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 2.5, py: 1.5, backgroundColor: '#f8fafc', justifyContent: 'space-between' }}>
                <Button onClick={onClose} color="inherit" sx={{ textTransform: 'none' }}>
                    Cerrar
                </Button>
                <Button
                    variant="contained"
                    color="primary"
                    disabled={saving}
                    onClick={handleSaveAll}
                    sx={{ textTransform: 'none', fontWeight: 700, px: 3 }}
                >
                    {saving ? 'Guardando...' : '💾 Guardar y Activar en Plataforma'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CopilotoTokenModal;
