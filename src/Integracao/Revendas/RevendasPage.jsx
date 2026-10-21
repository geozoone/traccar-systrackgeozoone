import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Table, TableRow, TableCell, TableHead, TableBody, TableFooter, useTheme, useMediaQuery, Typography, Toolbar
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import LinkIcon from '@mui/icons-material/Link';
import { useCatch, useEffectAsync } from '../../reactHelper';
import { formatBoolean, formatTime } from '../../common/util/formatter';
import { useTranslation } from '../../common/components/LocalizationProvider';
import PageLayout from '../../common/components/PageLayout';
import SettingsMenu from '../../settings/components/SettingsMenu';
import CollectionFab from '../../settings/components/CollectionFab';
import CollectionActions from '../../settings/components/CollectionActions';
import TableShimmer from '../../common/components/TableShimmer';
import { useManager } from '../../common/util/permissions';
import SearchHeader, { filterByKeyword } from '../../settings/components/SearchHeader';
import { usePreference } from '../../common/util/preferences';
import useSettingsStyles from '../../settings/common/useSettingsStyles';

import RecentActorsIcon from '@mui/icons-material/RecentActors';
import GroupsIcon from '@mui/icons-material/Groups';

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

    const currentTableData = useMemo(() => {
        const firstPageIndex = (currentPage - 1) * PageSize;
        const lastPageIndex = firstPageIndex + PageSize;
        return items.slice(firstPageIndex, lastPageIndex);
    }, [items, currentPage]);

    console.log(currentPage);

    useEffectAsync(async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/users');
            if (response.ok) {
                let Revendas = await response.json();

                Revendas.sort((a, b) => {
                    if (a.name < b.name) {
                        return -1;
                    } else {
                        return true;
                    }
                });

                let listRevendas = [];

                for (var i = 0; i < Revendas.length; i++) {
                    if (Revendas[i].attributes.nivel == 2) {
                        listRevendas[i] = Revendas[i];
                    }
                }

                setItems(listRevendas);
                //setItems(await response.json());
            } else {
                throw Error(await response.text());
            }
        } finally {
            setLoading(false);
        }
    }, [timestamp]);


    return (
        <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'settingsUsers']}>
            {/* <div className={classes.titulo} ><h5>Clientes</h5><Divider /></div> */}

            <Toolbar className={classes.header}>
                <PageTitle icon={<GroupsIcon sx={{ margin: 1, fontSize: 45 }} />} breadcrumbs={'Revendas'} />
            </Toolbar>

            <SearchHeader keyword={searchKeyword} setKeyword={setSearchKeyword} />

            <Table className={classes.table}>
                <TableHead>
                    <TableRow>
                    <TableCell>{t('sharedName')}</TableCell>
                        <TableCell>{"CPF"}</TableCell>
                        <TableCell>{t('sharedPhone')}</TableCell>
                        <TableCell>{t('userEmail')}</TableCell>   
                        <TableCell>{t('sharedDisabled')}</TableCell>
                        <TableCell>{t('userExpirationTime')}</TableCell>
                        <TableCell className={classes.columnAction} />
                    </TableRow>
                </TableHead>
                <TableBody>
                    {!loading ? currentTableData.filter(filterByKeyword(searchKeyword)).map((item) => (
                        <TableRow key={item.id}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>{(item.attributes.informacoes && item.attributes.informacoes.cpf) || ''}</TableCell>
                            <TableCell>{item.phone}</TableCell>
                            <TableCell>{item.email}</TableCell>
                            <TableCell>{formatBoolean(item.disabled, t)}</TableCell>                            
                            <TableCell>{formatTime(item.expirationTime, 'date', hours12)}</TableCell>  
                            <TableCell className={classes.columnAction} padding="none">
                                <CollectionActions
                                    itemId={item.id}
                                    editPath="/settings/revenda"
                                    endpoint="users"
                                    setTimestamp={setTimestamp}
                                    customActions={manager ? [actionLogin, actionConnections] : [actionConnections]}
                                />
                            </TableCell>
                        </TableRow>
                    )) : (<TableShimmer columns={6} endAction />)}
                </TableBody>
                <Pagination
                    currentPage={currentPage}
                    totalCount={items.length}
                    pageSize={PageSize}
                    onPageChange={page => setCurrentPage(page)}
                />
            </Table>

            <CollectionFab editPath="/settings/revenda" />
        </PageLayout>
    );
};

export default ClientesPage;
