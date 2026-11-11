import React, { useState, useMemo } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    TextField,
    InputAdornment,
    Box,
    Chip,
    Typography,
    Tooltip,
    IconButton,
    CircularProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { formatTime } from '../../common/util/formatter';
import { usePreference } from '../../common/util/preferences';

const ClientDevicesModal = ({
    open,
    onClose,
    client,
    devices = [],
    groups = {},
    loading = false,
}) => {
    const hours12 = usePreference('twelveHourFormat');
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedImei, setCopiedImei] = useState(null);

    const handleCopyImei = (imei) => {
        if (!imei) return;
        navigator.clipboard?.writeText(imei);
        setCopiedImei(imei);
        setTimeout(() => setCopiedImei(null), 2000);
    };

    const filteredDevices = useMemo(() => {
        if (!searchTerm.trim()) return devices;
        const q = searchTerm.toLowerCase();
        return devices.filter((d) => {
            const name = (d.name || '').toLowerCase();
            const imei = (d.uniqueId || '').toLowerCase();
            const model = (d.model || d.attributes?.modelo || '').toLowerCase();
            const sim = (d.phone || d.attributes?.sim || '').toLowerCase();
            const group = (groups[d.groupId]?.name || '').toLowerCase();
            return name.includes(q) || imei.includes(q) || model.includes(q) || sim.includes(q) || group.includes(q);
        });
    }, [devices, searchTerm, groups]);

    const clientTitle = client?.attributes?.empresa
        || (client?.attributes?.informacoes && client.attributes.informacoes.empresa)
        || client?.name
        || 'Cliente';

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    <DirectionsCarIcon color="primary" sx={{ fontSize: 28 }} />
                    <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                        Dispositivos Conectados — {clientTitle}
                    </Typography>
                    <Chip
                        label={`${devices.length} vehículos`}
                        color="primary"
                        size="small"
                        sx={{ fontWeight: 600, height: 24 }}
                    />
                </Box>
                <IconButton onClick={onClose} size="small" aria-label="cerrar">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 2 }}>
                {/* Barra de Filtro Rápido */}
                <Box sx={{ my: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                    <TextField
                        size="small"
                        placeholder="Buscar por placa, IMEI, SIM, modelo o grupo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        sx={{ width: { xs: '100%', sm: 380 } }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" color="action" />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <Typography variant="caption" color="textSecondary">
                        Mostrando {filteredDevices.length} de {devices.length}
                    </Typography>
                </Box>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200, flexDirection: 'column', gap: 1.5 }}>
                        <CircularProgress size={36} />
                        <Typography variant="body2" color="textSecondary">Consultando dispositivos conectados...</Typography>
                    </Box>
                ) : filteredDevices.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center', backgroundColor: '#f1f5f9', borderRadius: 2, my: 2 }}>
                        <Typography variant="body2" color="textSecondary">
                            {devices.length === 0
                                ? 'Este cliente no tiene dispositivos conectados actualmente.'
                                : 'No se encontraron dispositivos que coincidan con la búsqueda.'}
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ overflowX: 'auto', maxHeight: '60vh' }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700, backgroundColor: '#f8fafc' }}>Vehículo / Placa</TableCell>
                                    <TableCell sx={{ fontWeight: 700, backgroundColor: '#f8fafc' }}>Identificador (IMEI)</TableCell>
                                    <TableCell sx={{ fontWeight: 700, backgroundColor: '#f8fafc' }}>SIM (Chip)</TableCell>
                                    <TableCell sx={{ fontWeight: 700, backgroundColor: '#f8fafc' }}>Modelo GPS</TableCell>
                                    <TableCell sx={{ fontWeight: 700, backgroundColor: '#f8fafc' }}>Grupo</TableCell>
                                    <TableCell sx={{ fontWeight: 700, backgroundColor: '#f8fafc' }}>Contacto / Conductor</TableCell>
                                    <TableCell sx={{ fontWeight: 700, backgroundColor: '#f8fafc' }}>Notas / Instalación</TableCell>
                                    <TableCell sx={{ fontWeight: 700, backgroundColor: '#f8fafc' }}>Estado</TableCell>
                                    <TableCell sx={{ fontWeight: 700, backgroundColor: '#f8fafc' }}>Último Reporte</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredDevices.map((d) => {
                                    const isOnline = d.status === 'online';
                                    const simNumber = d.phone || d.attributes?.sim || '—';
                                    const modelName = d.model || d.attributes?.modelo || '—';
                                    const groupName = groups[d.groupId]?.name || 'Sin grupo';
                                    const contact = d.contact || d.attributes?.conductor || d.attributes?.driver || '—';
                                    const notes = d.attributes?.instalacion || d.attributes?.notas || d.attributes?.description || '—';

                                    return (
                                        <TableRow key={d.id} hover>
                                            <TableCell sx={{ fontWeight: 600 }}>{d.name}</TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                                                        {d.uniqueId}
                                                    </Typography>
                                                    <Tooltip title={copiedImei === d.uniqueId ? "¡Copiado!" : "Copiar IMEI"}>
                                                        <IconButton size="small" onClick={() => handleCopyImei(d.uniqueId)} sx={{ p: 0.3 }}>
                                                            {copiedImei === d.uniqueId ? (
                                                                <CheckIcon fontSize="inherit" color="success" />
                                                            ) : (
                                                                <ContentCopyIcon fontSize="inherit" />
                                                            )}
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </TableCell>
                                            <TableCell>{simNumber}</TableCell>
                                            <TableCell>{modelName}</TableCell>
                                            <TableCell>
                                                <Chip size="small" label={groupName} sx={{ height: 20, fontSize: '0.72rem' }} />
                                            </TableCell>
                                            <TableCell>{contact}</TableCell>
                                            <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                <Tooltip title={notes}>
                                                    <span>{notes}</span>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    size="small"
                                                    label={isOnline ? 'En línea' : 'Desconectado'}
                                                    sx={{
                                                        height: 20,
                                                        fontSize: '0.7rem',
                                                        fontWeight: 600,
                                                        backgroundColor: isOnline ? '#dcfce7' : '#fee2e2',
                                                        color: isOnline ? '#15803d' : '#b91c1c',
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                {d.lastUpdate ? formatTime(d.lastUpdate, 'minutes', hours12) : 'Sin reporte'}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                <Button onClick={onClose} variant="contained" color="inherit">
                    Cerrar
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ClientDevicesModal;

