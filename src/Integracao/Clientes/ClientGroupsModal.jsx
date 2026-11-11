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
    IconButton,
    CircularProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import CloseIcon from '@mui/icons-material/Close';

const ClientGroupsModal = ({
    open,
    onClose,
    client,
    groups = [],
    devices = [],
    loading = false,
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const groupVehicleCounts = useMemo(() => {
        const counts = {};
        devices.forEach((d) => {
            if (d && d.groupId) {
                counts[d.groupId] = (counts[d.groupId] || 0) + 1;
            }
        });
        return counts;
    }, [devices]);

    const filteredGroups = useMemo(() => {
        if (!searchTerm.trim()) return groups;
        const q = searchTerm.toLowerCase();
        return groups.filter((g) => (g.name || '').toLowerCase().includes(q));
    }, [groups, searchTerm]);

    const clientTitle = client?.attributes?.empresa
        || (client?.attributes?.informacoes && client.attributes.informacoes.empresa)
        || client?.name
        || 'Cliente';

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    <FolderIcon color="primary" sx={{ fontSize: 28 }} />
                    <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                        Grupos Conectados — {clientTitle}
                    </Typography>
                    <Chip
                        label={`${groups.length} grupos`}
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
                <Box sx={{ my: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                    <TextField
                        size="small"
                        placeholder="Buscar por nombre de grupo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        fullWidth
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" color="action" />
                                </InputAdornment>
                            ),
                        }}
                    />
                </Box>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 180, flexDirection: 'column', gap: 1.5 }}>
                        <CircularProgress size={36} />
                        <Typography variant="body2" color="textSecondary">Consultando grupos conectados...</Typography>
                    </Box>
                ) : filteredGroups.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center', backgroundColor: '#f1f5f9', borderRadius: 2, my: 2 }}>
                        <Typography variant="body2" color="textSecondary">
                            {groups.length === 0
                                ? 'Este cliente no tiene grupos conectados actualmente.'
                                : 'No se encontraron grupos que coincidan con la búsqueda.'}
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ maxHeight: '55vh', overflowY: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700, backgroundColor: '#f8fafc' }}>Grupo</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 700, backgroundColor: '#f8fafc' }}>Vehículos Asignados</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredGroups.map((g) => {
                                    const count = groupVehicleCounts[g.id] || 0;
                                    return (
                                        <TableRow key={g.id} hover>
                                            <TableCell sx={{ fontWeight: 600 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <FolderIcon fontSize="small" color="action" />
                                                    <span>{g.name}</span>
                                                </Box>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Chip
                                                    size="small"
                                                    label={`${count} vehículos`}
                                                    sx={{
                                                        height: 22,
                                                        fontSize: '0.72rem',
                                                        fontWeight: 600,
                                                        backgroundColor: count > 0 ? '#e0f2fe' : '#f1f5f9',
                                                        color: count > 0 ? '#0369a1' : '#64748b',
                                                    }}
                                                />
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

export default ClientGroupsModal;

