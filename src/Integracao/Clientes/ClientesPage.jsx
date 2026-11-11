import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    Table, TableRow, TableCell, TableHead, TableBody, Typography, Toolbar, Button, Chip, Box, Tooltip,
    IconButton, Collapse, CircularProgress
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import LinkIcon from '@mui/icons-material/Link';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import BusinessIcon from '@mui/icons-material/Business';
import VisibilityIcon from '@mui/icons-material/Visibility';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import FolderIcon from '@mui/icons-material/Folder';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import RecentActorsIcon from '@mui/icons-material/RecentActors';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';

import { useCatch, useEffectAsync } from '../../reactHelper';
import { formatBoolean, formatTime } from '../../common/util/formatter';
import { useTranslation } from '../../common/components/LocalizationProvider';
import PageLayout from '../../common/components/PageLayout';
import SettingsMenu from '../../settings/components/SettingsMenu';
import CollectionFab from '../../settings/components/CollectionFab';
import CollectionActions from './CollectionActions';
import TableShimmer from '../../common/components/TableShimmer';
import { useManager } from '../../common/util/permissions';
import SearchHeader, { filterByKeyword } from '../../settings/components/SearchHeader';
import { usePreference } from '../../common/util/preferences';
import useSettingsStyles from '../../settings/common/useSettingsStyles';
import Pagination from '../../common/components/Paginations/Pagination';

import ClientDevicesModal from './ClientDevicesModal';
import ClientGroupsModal from './ClientGroupsModal';

const PageTitle = ({ icon, breadcrumbs }) => {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {icon}
            <Typography variant="h6" noWrap>{breadcrumbs}</Typography>
        </Box>
    );
};

const ClientesPage = () => {
    const classes = useSettingsStyles();
    const navigate = useNavigate();
    const t = useTranslation();
    const manager = useManager();
    const hours12 = usePreference('twelveHourFormat');

    // Redux groups dict { [groupId]: group }
    const reduxGroups = useSelector((state) => state.groups.items || {});

    const [timestamp, setTimestamp] = useState(Date.now());
    const [items, setItems] = useState([]);
    const [clientBrands, setClientBrands] = useState({});
    const [searchKeyword, setSearchKeyword] = useState('');
    const [loading, setLoading] = useState(false);

    // Estado de filas expandidas (Set de userIds)
    const [expandedRows, setExpandedRows] = useState({});
    // Caché de dispositivos y grupos por userId: { [userId]: Device[] / Group[] }
    const [companyDevicesMap, setCompanyDevicesMap] = useState({});
    const [companyGroupsMap, setCompanyGroupsMap] = useState({});
    const [loadingFleetMap, setLoadingFleetMap] = useState({});

    // Estado para modales de consulta rápida
    const [devicesModalState, setDevicesModalState] = useState({ open: false, client: null, loading: false });
    const [groupsModalState, setGroupsModalState] = useState({ open: false, client: null, loading: false });
    const [copiedImei, setCopiedImei] = useState(null);
    const [exportingExcel, setExportingExcel] = useState(false);

    const handleCopyImei = (imei) => {
        if (!imei) return;
        navigator.clipboard?.writeText(imei);
        setCopiedImei(imei);
        setTimeout(() => setCopiedImei(null), 2000);
    };

    const handleLogin = useCatch(async (userId) => {
        const response = await fetch(`/api/session/${userId}`);
        if (response.ok) {
            window.location.replace('/');
        } else {
            throw Error(await response.text());
        }
    });

    const getEmpresaName = (user) => (
        user?.attributes?.empresa
        || (user?.attributes?.informacoes && user.attributes.informacoes.empresa)
        || user?.name
        || ''
    ).trim();

    const getEmpresaRuc = (user) => (
        (user?.attributes?.informacoes && user.attributes.informacoes.cpf)
        || user?.attributes?.ruc
        || ''
    ).trim();

    const handleAddCompanyUser = (userOrId) => {
        const target = typeof userOrId === 'object'
            ? userOrId
            : items.find((u) => u && u.id === userOrId);
        const emp = getEmpresaName(target);
        const ruc = getEmpresaRuc(target);
        const params = new URLSearchParams({
            modo: 'usuario',
            empresa: emp,
            ruc: ruc,
        });
        navigate(`/settings/cliente?${params.toString()}`);
    };

    const actionAddUser = {
        key: 'addUser',
        title: 'Agregar Usuario / Operador a esta Empresa',
        icon: <PersonAddAlt1Icon fontSize="small" color="primary" />,
        handler: (userId) => handleAddCompanyUser(userId),
    };

    const actionLogin = {
        key: 'login',
        title: t('loginLogin'),
        icon: <LoginIcon fontSize="small" />,
        handler: handleLogin,
    };

    const actionConnections = {
        key: 'connections',
        title: t('sharedConnections'),
        icon: <LinkIcon fontSize="small" />,
        handler: (userId) => navigate(`/settings/cliente/${userId}/connections`),
    };

    let PageSize = 15;
    let totalCount = items.length;
    const [currentPage, setCurrentPage] = useState(1);

    const empresaCounts = useMemo(() => {
        const counts = {};
        items.forEach((u) => {
            if (!u) return;
            const key = getEmpresaName(u).toLowerCase();
            if (key) {
                counts[key] = (counts[key] || 0) + 1;
            }
        });
        return counts;
    }, [items]);

    const currentTableData = useMemo(() => {
        const firstPageIndex = (currentPage - 1) * PageSize;
        const lastPageIndex = firstPageIndex + PageSize;
        return items.slice(firstPageIndex, lastPageIndex);
    }, [items, currentPage]);

    // Carga de clientes y marcas
    useEffectAsync(async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/users');
            if (response.ok) {
                let Clientes = await response.json();
                const listClientes = Clientes.filter((c) => c && c.attributes && c.attributes.nivel == 3);

                listClientes.sort((a, b) => {
                    const empresaA = getEmpresaName(a).toLowerCase();
                    const empresaB = getEmpresaName(b).toLowerCase();
                    if (empresaA !== empresaB) {
                        return empresaA.localeCompare(empresaB);
                    }
                    const isOpA = Boolean(a.readonly || a.attributes?.esSubUsuario);
                    const isOpB = Boolean(b.readonly || b.attributes?.esSubUsuario);
                    if (isOpA !== isOpB) {
                        return isOpA ? 1 : -1;
                    }
                    return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
                });

                setItems(listClientes);
            } else {
                throw Error(await response.text());
            }

            try {
                const bResp = await fetch('/modulo/branding');
                if (bResp.ok) {
                    const allBrands = await bResp.json();
                    const map = {};
                    if (allBrands && typeof allBrands === 'object') {
                        Object.values(allBrands).forEach((b) => {
                            if (b.clienteId) {
                                map[b.clienteId] = b.domain;
                            }
                        });
                    }
                    setClientBrands(map);
                }
            } catch (e) {}
        } finally {
            setLoading(false);
        }
    }, [timestamp]);

    // Función para cargar flota (dispositivos y grupos) de un cliente puntual
    const fetchUserFleet = async (userId) => {
        if (companyDevicesMap[userId] && companyGroupsMap[userId]) {
            return { devs: companyDevicesMap[userId], grps: companyGroupsMap[userId] };
        }
        setLoadingFleetMap((prev) => ({ ...prev, [userId]: true }));
        try {
            const [devResp, grpResp] = await Promise.all([
                fetch(`/api/devices?userId=${userId}`),
                fetch(`/api/groups?userId=${userId}`),
            ]);
            const devs = devResp.ok ? await devResp.json() : [];
            const grps = grpResp.ok ? await grpResp.json() : [];
            setCompanyDevicesMap((prev) => ({ ...prev, [userId]: devs }));
            setCompanyGroupsMap((prev) => ({ ...prev, [userId]: grps }));
            return { devs, grps };
        } catch (e) {
            console.error('Error al consultar flota:', e);
            return { devs: [], grps: [] };
        } finally {
            setLoadingFleetMap((prev) => ({ ...prev, [userId]: false }));
        }
    };

    // Pre-carga proactiva en segundo plano de conteos para los 15 clientes visibles en la página actual
    useEffectAsync(async () => {
        if (!currentTableData || currentTableData.length === 0) return;
        const missingUsers = currentTableData.filter((u) => u && companyDevicesMap[u.id] === undefined);
        if (missingUsers.length === 0) return;

        const promises = missingUsers.map(async (u) => {
            try {
                const [devResp, grpResp] = await Promise.all([
                    fetch(`/api/devices?userId=${u.id}`),
                    fetch(`/api/groups?userId=${u.id}`),
                ]);
                const devs = devResp.ok ? await devResp.json() : [];
                const grps = grpResp.ok ? await grpResp.json() : [];
                return { userId: u.id, devs, grps };
            } catch (e) {
                return null;
            }
        });

        const results = await Promise.all(promises);
        const newDevMap = {};
        const newGrpMap = {};
        results.forEach((res) => {
            if (res) {
                newDevMap[res.userId] = res.devs;
                newGrpMap[res.userId] = res.grps;
            }
        });
        setCompanyDevicesMap((prev) => ({ ...prev, ...newDevMap }));
        setCompanyGroupsMap((prev) => ({ ...prev, ...newGrpMap }));
    }, [currentTableData]);

    // Alternar expansión de fila
    const toggleExpandRow = async (userId) => {
        const willExpand = !expandedRows[userId];
        setExpandedRows((prev) => ({ ...prev, [userId]: willExpand }));
        if (willExpand && companyDevicesMap[userId] === undefined) {
            await fetchUserFleet(userId);
        }
    };

    // Expandir todo / Contraer todo
    const areAllExpanded = useMemo(() => {
        if (currentTableData.length === 0) return false;
        return currentTableData.every((u) => expandedRows[u.id]);
    }, [currentTableData, expandedRows]);

    const handleToggleExpandAll = async () => {
        const nextState = !areAllExpanded;
        const newExp = { ...expandedRows };
        currentTableData.forEach((u) => {
            newExp[u.id] = nextState;
        });
        setExpandedRows(newExp);

        if (nextState) {
            const usersNeedingFetch = currentTableData.filter((u) => companyDevicesMap[u.id] === undefined);
            for (const u of usersNeedingFetch) {
                await fetchUserFleet(u.id);
            }
        }
    };

    // Abrir Modal de Dispositivos
    const handleOpenDevicesModal = async (client) => {
        setDevicesModalState({ open: true, client, loading: true });
        const { devs } = await fetchUserFleet(client.id);
        setDevicesModalState({ open: true, client, loading: false });
    };

    // Abrir Modal de Grupos
    const handleOpenGroupsModal = async (client) => {
        setGroupsModalState({ open: true, client, loading: true });
        const { grps } = await fetchUserFleet(client.id);
        setGroupsModalState({ open: true, client, loading: false });
    };

    // Exportación consolidada a Excel (Padrón Maestro 360°)
    const handleExportMasterExcel = async () => {
        if (!items.length) return;
        setExportingExcel(true);
        try {
            const rowsToExport = [];

            for (const client of items) {
                const empName = getEmpresaName(client);
                const ruc = getEmpresaRuc(client);
                const clientPhone = client.phone || '';
                const clientEmail = client.email || '';
                const clientDisabled = client.disabled ? 'SÍ' : 'NO';
                const clientExp = client.expirationTime ? dayjs(client.expirationTime).format('DD/MM/YYYY') : 'Sin caducidad';

                let devs = companyDevicesMap[client.id];
                if (!devs) {
                    try {
                        const devResp = await fetch(`/api/devices?userId=${client.id}`);
                        devs = devResp.ok ? await devResp.json() : [];
                        setCompanyDevicesMap((prev) => ({ ...prev, [client.id]: devs }));
                    } catch (e) {
                        devs = [];
                    }
                }

                if (devs.length === 0) {
                    rowsToExport.push({
                        'Empresa / Cliente': empName,
                        'Usuario / Contacto': client.name,
                        'RUC / DNI': ruc,
                        'Teléfono': clientPhone,
                        'Email': clientEmail,
                        'Estado Cuenta': clientDisabled === 'SÍ' ? 'DESHABILITADO' : 'ACTIVO',
                        'Caducidad Cuenta': clientExp,
                        'Vehículo / Placa': 'Sin vehículos asociados',
                        'Identificador (IMEI)': '—',
                        'SIM (Chip)': '—',
                        'Modelo GPS': '—',
                        'Grupo': '—',
                        'Contacto / Chofer': '—',
                        'Notas / Instalación': '—',
                        'Estado Conexión': '—',
                        'Última Transmisión': '—',
                    });
                } else {
                    devs.forEach((d) => {
                        rowsToExport.push({
                            'Empresa / Cliente': empName,
                            'Usuario / Contacto': client.name,
                            'RUC / DNI': ruc,
                            'Teléfono': clientPhone,
                            'Email': clientEmail,
                            'Estado Cuenta': clientDisabled === 'SÍ' ? 'DESHABILITADO' : 'ACTIVO',
                            'Caducidad Cuenta': clientExp,
                            'Vehículo / Placa': d.name,
                            'Identificador (IMEI)': d.uniqueId,
                            'SIM (Chip)': d.phone || d.attributes?.sim || 'N/D',
                            'Modelo GPS': d.model || d.attributes?.modelo || 'N/D',
                            'Grupo': reduxGroups[d.groupId]?.name || 'Sin grupo',
                            'Contacto / Chofer': d.contact || d.attributes?.conductor || d.attributes?.driver || 'N/D',
                            'Notas / Instalación': d.attributes?.instalacion || d.attributes?.notas || d.attributes?.description || 'N/D',
                            'Estado Conexión': d.status === 'online' ? 'EN LÍNEA' : 'DESCONECTADO',
                            'Última Transmisión': d.lastUpdate ? dayjs(d.lastUpdate).format('DD/MM/YYYY HH:mm') : 'Sin reporte',
                        });
                    });
                }
            }

            const worksheet = XLSX.utils.json_to_sheet(rowsToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Padrón Maestro');

            worksheet['!cols'] = [
                { wch: 25 }, { wch: 22 }, { wch: 15 }, { wch: 15 }, { wch: 25 },
                { wch: 15 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 16 },
                { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 30 }, { wch: 16 }, { wch: 18 },
            ];

            const filename = `Padron_Maestro_Flota_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`;
            XLSX.writeFile(workbook, filename);
        } finally {
            setExportingExcel(false);
        }
    };

    return (
        <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'settingsUsers']}>
            <Toolbar className={classes.header} sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PageTitle icon={<RecentActorsIcon sx={{ margin: 1, fontSize: 45 }} />} breadcrumbs={'Clientes y Flota'} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                        variant="outlined"
                        color="secondary"
                        startIcon={areAllExpanded ? <UnfoldLessIcon /> : <UnfoldMoreIcon />}
                        onClick={handleToggleExpandAll}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                        {areAllExpanded ? 'Contraer Todo' : 'Expandir Todo'}
                    </Button>
                    <Button
                        variant="outlined"
                        color="primary"
                        startIcon={exportingExcel ? <CircularProgress size={16} /> : <FileDownloadIcon />}
                        disabled={exportingExcel || items.length === 0}
                        onClick={handleExportMasterExcel}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                        {exportingExcel ? 'Exportando Padrón...' : 'Exportar Padrón (Excel)'}
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<BusinessIcon />}
                        onClick={() => navigate('/settings/cliente')}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                        Nueva Empresa Cliente
                    </Button>
                </Box>
            </Toolbar>

            <Box sx={{ px: 2, pb: 1 }}>
                <Typography variant="body2" color="textSecondary">
                    💡 <strong>Padrón Maestro de Flota:</strong> Haz clic en la flecha <strong>▶</strong> o en las etiquetas de vehículos para inspeccionar los GPS conectados, SIMs, modelos y notas sin salir de esta pantalla.
                </Typography>
            </Box>

            <SearchHeader keyword={searchKeyword} setKeyword={setSearchKeyword} />

            <Table className={classes.table}>
                <TableHead>
                    <TableRow>
                        <TableCell padding="checkbox" sx={{ width: 48 }} />
                        <TableCell>{"Empresa / Cliente"}</TableCell>
                        <TableCell>{"Usuario / Contacto"}</TableCell>
                        <TableCell>{"RUC / DNI"}</TableCell>
                        <TableCell>{t('sharedPhone')}</TableCell>
                        <TableCell>{t('userEmail')}</TableCell>
                        <TableCell align="center">{"Flota Conectada"}</TableCell>
                        <TableCell>{t('sharedDisabled')}</TableCell>
                        <TableCell>{t('userExpirationTime')}</TableCell>
                        <TableCell className={classes.columnAction} />
                    </TableRow>
                </TableHead>
                <TableBody>
                    {!loading ? currentTableData.filter(filterByKeyword(searchKeyword)).map((item, idx, arr) => {
                        const empName = getEmpresaName(item);
                        const empKey = empName.toLowerCase();
                        const countInCompany = empresaCounts[empKey] || 1;
                        const prevItem = idx > 0 ? arr[idx - 1] : null;
                        const isSameAsPrev = prevItem && getEmpresaName(prevItem).toLowerCase() === empKey;
                        const isOperator = Boolean(item.readonly || item.attributes?.tipoCuenta === 'operador');

                        const isExpanded = Boolean(expandedRows[item.id]);
                        const clientDevices = companyDevicesMap[item.id] || [];
                        const clientGroups = companyGroupsMap[item.id] || [];
                        const isFleetLoading = Boolean(loadingFleetMap[item.id]);

                        return (
                            <React.Fragment key={item.id}>
                                <TableRow hover sx={isSameAsPrev ? { backgroundColor: 'rgba(25, 118, 210, 0.03)' } : undefined}>
                                    <TableCell padding="checkbox">
                                        <IconButton
                                            size="small"
                                            onClick={() => toggleExpandRow(item.id)}
                                            aria-label="expand row"
                                            sx={{ transition: 'transform 0.2s' }}
                                        >
                                            {isExpanded ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                                        </IconButton>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.8 }}>
                                            <strong>
                                                {isSameAsPrev ? `↳ ${empName}` : empName}
                                            </strong>
                                            {!isSameAsPrev && countInCompany > 1 && (
                                                <Chip
                                                    size="small"
                                                    label={`${countInCompany} usuarios`}
                                                    sx={{ height: 20, fontSize: '0.7rem', backgroundColor: '#e3f2fd', color: '#0d47a1', fontWeight: 600 }}
                                                />
                                            )}
                                            <Tooltip title={`Crear otro usuario u operador para ${empName}`}>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="primary"
                                                    startIcon={<PersonAddAlt1Icon sx={{ fontSize: '14px !important' }} />}
                                                    onClick={() => handleAddCompanyUser(item)}
                                                    sx={{
                                                        py: 0,
                                                        px: 0.8,
                                                        minHeight: 22,
                                                        fontSize: '0.72rem',
                                                        textTransform: 'none',
                                                        borderRadius: 1.5,
                                                    }}
                                                >
                                                    Usuario
                                                </Button>
                                            </Tooltip>
                                        </Box>
                                        {clientBrands[item.id] && (
                                            <div style={{ marginTop: '4px' }}>
                                                <span className="badge badge-primary text-wrap" style={{ fontSize: '0.72rem', padding: '3px 7px', backgroundColor: '#1976d2' }}>
                                                    🌐 {clientBrands[item.id]}
                                                </span>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                                            <span>{item.name}</span>
                                            {isOperator ? (
                                                <Chip
                                                    size="small"
                                                    icon={<VisibilityIcon sx={{ fontSize: '13px !important' }} />}
                                                    label="Operador (Solo Lectura)"
                                                    sx={{ height: 20, fontSize: '0.68rem', backgroundColor: '#fff8e1', color: '#e65100', border: '1px solid #ffe082' }}
                                                />
                                            ) : (
                                                <Chip
                                                    size="small"
                                                    label="Titular / Supervisor"
                                                    sx={{ height: 20, fontSize: '0.68rem', backgroundColor: '#e8f5e9', color: '#1b5e20' }}
                                                />
                                            )}
                                        </Box>
                                        {(item.attributes?.cargo || (item.attributes?.informacoes && item.attributes.informacoes.cargo)) && (
                                            <div style={{ fontSize: '0.82em', color: '#666' }}>
                                                {item.attributes?.cargo || item.attributes?.informacoes?.cargo}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>{(item.attributes?.informacoes && item.attributes.informacoes.cpf) || ''}</TableCell>
                                    <TableCell>{item.phone}</TableCell>
                                    <TableCell>{item.email}</TableCell>

                                    {/* Botones / Chips de Inspección Rápida de Dispositivos y Grupos */}
                                    <TableCell align="center">
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                                            <Tooltip title="Ver detalle de dispositivos conectados">
                                                <Chip
                                                    size="small"
                                                    icon={<DirectionsCarIcon sx={{ fontSize: '14px !important' }} />}
                                                    label={
                                                        companyDevicesMap[item.id] !== undefined
                                                            ? `${companyDevicesMap[item.id].length} GPS`
                                                            : 'Ver GPS'
                                                    }
                                                    onClick={() => handleOpenDevicesModal(item)}
                                                    clickable
                                                    color="primary"
                                                    variant="outlined"
                                                    sx={{ height: 24, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
                                                />
                                            </Tooltip>
                                            <Tooltip title="Ver grupos asignados">
                                                <Chip
                                                    size="small"
                                                    icon={<FolderIcon sx={{ fontSize: '14px !important' }} />}
                                                    label={
                                                        companyGroupsMap[item.id] !== undefined
                                                            ? `${companyGroupsMap[item.id].length} Grupos`
                                                            : 'Ver Grupos'
                                                    }
                                                    onClick={() => handleOpenGroupsModal(item)}
                                                    clickable
                                                    color="default"
                                                    variant="outlined"
                                                    sx={{ height: 24, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
                                                />
                                            </Tooltip>
                                        </Box>
                                    </TableCell>

                                    <TableCell>{formatBoolean(item.disabled, t)}</TableCell>
                                    <TableCell>{formatTime(item.expirationTime, 'date', hours12)}</TableCell>

                                    {/* Acciones clásicas intactas */}
                                    <TableCell className={classes.columnAction} padding="none">
                                        <CollectionActions
                                            itemId={item.id}
                                            idasaas={item.attributes?.idasaas}
                                            editPath="/settings/cliente"
                                            endpoint="users"
                                            setTimestamp={setTimestamp}
                                            customActions={manager ? [actionAddUser, actionLogin, actionConnections] : [actionAddUser, actionConnections]}
                                        />
                                    </TableCell>
                                </TableRow>

                                {/* Fila Expandible Master-Detail con la Ficha de Flota */}
                                <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                    <TableCell colSpan={10} sx={{ py: 0, px: 2, borderBottom: isExpanded ? '2px solid #cbd5e1' : 'none' }}>
                                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                            <Box sx={{ py: 2, px: 1 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <DirectionsCarIcon color="primary" sx={{ fontSize: 22 }} />
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                                                            Flota de {empName} — {clientDevices.length} vehículos registrados
                                                        </Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            startIcon={<LinkIcon fontSize="small" />}
                                                            onClick={() => navigate(`/settings/cliente/${item.id}/connections`)}
                                                            sx={{ textTransform: 'none', fontSize: '0.72rem', py: 0.2 }}
                                                        >
                                                            Editar Conexiones
                                                        </Button>
                                                    </Box>
                                                </Box>

                                                {isFleetLoading ? (
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
                                                        <CircularProgress size={20} />
                                                        <Typography variant="body2" color="textSecondary">Consultando flota del cliente...</Typography>
                                                    </Box>
                                                ) : clientDevices.length === 0 ? (
                                                    <Typography variant="body2" color="textSecondary" sx={{ py: 1.5, fontStyle: 'italic' }}>
                                                        Este cliente aún no tiene dispositivos GPS vinculados. Utiliza el botón <strong>Editar Conexiones</strong> para asignarle unidades o grupos.
                                                    </Typography>
                                                ) : (
                                                    <Box sx={{ overflowX: 'auto', backgroundColor: '#ffffff', borderRadius: 1.5, border: '1px solid #e2e8f0', p: 0.5 }}>
                                                        <Table size="small">
                                                            <TableHead>
                                                                <TableRow sx={{ backgroundColor: '#f1f5f9' }}>
                                                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Vehículo / Placa</TableCell>
                                                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Identificador (IMEI)</TableCell>
                                                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>SIM (Chip)</TableCell>
                                                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Modelo GPS</TableCell>
                                                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Grupo</TableCell>
                                                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Contacto / Chofer</TableCell>
                                                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Notas / Instalación</TableCell>
                                                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Estado</TableCell>
                                                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Último Reporte</TableCell>
                                                                </TableRow>
                                                            </TableHead>
                                                            <TableBody>
                                                                {clientDevices.map((d) => {
                                                                    const isOnline = d.status === 'online';
                                                                    const simNumber = d.phone || d.attributes?.sim || '—';
                                                                    const modelName = d.model || d.attributes?.modelo || '—';
                                                                    const groupName = reduxGroups[d.groupId]?.name || 'Sin grupo';
                                                                    const contact = d.contact || d.attributes?.conductor || d.attributes?.driver || '—';
                                                                    const notes = d.attributes?.instalacion || d.attributes?.notas || d.attributes?.description || '—';

                                                                    return (
                                                                        <TableRow key={d.id} hover>
                                                                            <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{d.name}</TableCell>
                                                                            <TableCell>
                                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                                                                                        {d.uniqueId}
                                                                                    </Typography>
                                                                                    <Tooltip title={copiedImei === d.uniqueId ? "¡Copiado!" : "Copiar IMEI"}>
                                                                                        <IconButton size="small" onClick={() => handleCopyImei(d.uniqueId)} sx={{ p: 0.2 }}>
                                                                                            {copiedImei === d.uniqueId ? (
                                                                                                <CheckIcon sx={{ fontSize: 13 }} color="success" />
                                                                                            ) : (
                                                                                                <ContentCopyIcon sx={{ fontSize: 13 }} />
                                                                                            )}
                                                                                        </IconButton>
                                                                                    </Tooltip>
                                                                                </Box>
                                                                            </TableCell>
                                                                            <TableCell sx={{ fontSize: '0.8rem' }}>{simNumber}</TableCell>
                                                                            <TableCell sx={{ fontSize: '0.8rem' }}>{modelName}</TableCell>
                                                                            <TableCell>
                                                                                <Chip size="small" label={groupName} sx={{ height: 18, fontSize: '0.68rem' }} />
                                                                            </TableCell>
                                                                            <TableCell sx={{ fontSize: '0.8rem' }}>{contact}</TableCell>
                                                                            <TableCell sx={{ fontSize: '0.8rem', maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                                <Tooltip title={notes}>
                                                                                    <span>{notes}</span>
                                                                                </Tooltip>
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <Chip
                                                                                    size="small"
                                                                                    label={isOnline ? 'En línea' : 'Desconectado'}
                                                                                    sx={{
                                                                                        height: 18,
                                                                                        fontSize: '0.68rem',
                                                                                        fontWeight: 600,
                                                                                        backgroundColor: isOnline ? '#dcfce7' : '#fee2e2',
                                                                                        color: isOnline ? '#15803d' : '#b91c1c',
                                                                                    }}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                                                {d.lastUpdate ? formatTime(d.lastUpdate, 'minutes', hours12) : 'Sin reporte'}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    );
                                                                })}
                                                            </TableBody>
                                                        </Table>
                                                    </Box>
                                                )}
                                            </Box>
                                        </Collapse>
                                    </TableCell>
                                </TableRow>
                            </React.Fragment>
                        );
                    }) : (<TableShimmer columns={9} endAction />)}
                </TableBody>
                <Pagination
                    currentPage={currentPage}
                    totalCount={items.length}
                    pageSize={PageSize}
                    onPageChange={(page) => setCurrentPage(page)}
                />
            </Table>

            <CollectionFab editPath="/settings/cliente" />

            {/* Modal de Dispositivos Conectados */}
            <ClientDevicesModal
                open={devicesModalState.open}
                onClose={() => setDevicesModalState({ open: false, client: null, loading: false })}
                client={devicesModalState.client}
                devices={devicesModalState.client ? (companyDevicesMap[devicesModalState.client.id] || []) : []}
                groups={reduxGroups}
                loading={devicesModalState.loading}
            />

            {/* Modal de Grupos Conectados */}
            <ClientGroupsModal
                open={groupsModalState.open}
                onClose={() => setGroupsModalState({ open: false, client: null, loading: false })}
                client={groupsModalState.client}
                groups={groupsModalState.client ? (companyGroupsMap[groupsModalState.client.id] || []) : []}
                devices={groupsModalState.client ? (companyDevicesMap[groupsModalState.client.id] || []) : []}
                loading={groupsModalState.loading}
            />
        </PageLayout>
    );
};

export default ClientesPage;
