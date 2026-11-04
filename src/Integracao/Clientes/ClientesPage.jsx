import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Table, TableRow, TableCell, TableHead, TableBody, TableFooter, useTheme, useMediaQuery, Typography, Toolbar, Button, Chip, Box, Tooltip
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import LinkIcon from '@mui/icons-material/Link';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import BusinessIcon from '@mui/icons-material/Business';
import VisibilityIcon from '@mui/icons-material/Visibility';
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

import RecentActorsIcon from '@mui/icons-material/RecentActors';
import Pagination from '../../common/components/Paginations/Pagination';

const PageTitle = ({ icon, breadcrumbs }) => {
    const theme = useTheme();
    const t = useTranslation();
    const classes = useSettingsStyles();

    const desktop = useMediaQuery(theme.breakpoints.up('md'));

    return (
        <>{icon}
            <Typography variant="h6" noWrap>{breadcrumbs}</Typography>
        </>
    );
};

const ClientesPage = () => {
    const classes = useSettingsStyles();
    const navigate = useNavigate();
    const t = useTranslation();

    const manager = useManager();

    const hours12 = usePreference('twelveHourFormat');

    const [timestamp, setTimestamp] = useState(Date.now());
    const [items, setItems] = useState([]);
    const [clientBrands, setClientBrands] = useState({});
    const [searchKeyword, setSearchKeyword] = useState('');
    const [loading, setLoading] = useState(false);

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

    const totalPageCount = Math.ceil(totalCount / PageSize);

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
                    // Mostrar titular primero y operadores después dentro de la misma empresa
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

            // Cargar marcas asociadas a clientes
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


    return (
        <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'settingsUsers']}>
            <Toolbar className={classes.header} sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PageTitle icon={<RecentActorsIcon sx={{ margin: 1, fontSize: 45 }} />} breadcrumbs={'Clientes y Usuarios'} />
                </Box>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<BusinessIcon />}
                    onClick={() => navigate('/settings/cliente')}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                    Nueva Empresa Cliente
                </Button>
            </Toolbar>

            <Box sx={{ px: 2, pb: 1 }}>
                <Typography variant="body2" color="textSecondary">
                    💡 <strong>¿Necesitas crear otro usuario u operador para un cliente que ya existe?</strong> Haz clic en el botón <strong>+ Usuario</strong> en la fila de su empresa para no volver a llenar los datos de la empresa.
                </Typography>
            </Box>

            <SearchHeader keyword={searchKeyword} setKeyword={setSearchKeyword} />

            <Table className={classes.table}>
                <TableHead>
                    <TableRow>
                        <TableCell>{"Empresa / Cliente"}</TableCell>
                        <TableCell>{"Usuario / Contacto"}</TableCell>
                        <TableCell>{"RUC / DNI"}</TableCell>
                        <TableCell>{t('sharedPhone')}</TableCell>
                        <TableCell>{t('userEmail')}</TableCell>   
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

                        return (
                            <TableRow key={item.id} sx={isSameAsPrev ? { backgroundColor: 'rgba(25, 118, 210, 0.03)' } : undefined}>
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
                                <TableCell>{formatBoolean(item.disabled, t)}</TableCell>                            
                                <TableCell>{formatTime(item.expirationTime, 'date', hours12)}</TableCell>  
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
                        );
                    }) : (<TableShimmer columns={7} endAction />)}


                </TableBody>
                <Pagination
                    currentPage={currentPage}
                    totalCount={items.length}
                    pageSize={PageSize}
                    onPageChange={page => setCurrentPage(page)}
                />
            </Table>

            <CollectionFab editPath="/settings/cliente" />
        </PageLayout>
    );
};

export default ClientesPage;
