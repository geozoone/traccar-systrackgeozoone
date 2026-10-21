import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
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
import CollectionActions from './CollectionActions';
import TableShimmer from '../../common/components/TableShimmer';
import { useAdministrator, useManager } from '../../common/util/permissions';
import SearchHeader, { filterByKeyword } from '../../settings/components/SearchHeader';
import { usePreference } from '../../common/util/preferences';
import useSettingsStyles from '../../settings/common/useSettingsStyles';

import RecentActorsIcon from '@mui/icons-material/RecentActors';
import TopicIcon from '@mui/icons-material/Topic';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';

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

const FaturasPage = () => {
    const classes = useSettingsStyles();
    const navigate = useNavigate();
    const t = useTranslation();

    const admin = useAdministrator();
    const manager = useManager();

    const { id } = useParams();

    const hours12 = usePreference('twelveHourFormat');

    const [timestamp, setTimestamp] = useState(Date.now());
    const [items, setItems] = useState([]);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [loading, setLoading] = useState(false);

    let PageSize = 15;

    let totalCount = items.length;

    const totalPageCount = Math.ceil(totalCount / PageSize);

    const [currentPage, setCurrentPage] = useState(1);

    const currentTableData = useMemo(() => {
        const firstPageIndex = (currentPage - 1) * PageSize;
        const lastPageIndex = firstPageIndex + PageSize;
        return items.slice(firstPageIndex, lastPageIndex);
    }, [items, currentPage]);

    // console.log(currentPage);
    const currentUser = useSelector((state) => state.session.user);

    useEffectAsync(async () => {
        setLoading(true);
        try {
            let list;

            if (id) {
                list = `/${id}`;
             } else {
                if (!admin) {
                    list = '?admin=true';
                } else {
                    list = `?idcard=${currentUser.id}`;
                }
            }

            const response = await fetch(`/modulo/faturas${list}`);

            if (response.ok) {
                let faturas = await response.json();

                setItems(faturas);
            } else {
                throw Error(await response.text());
            }

        } finally {
            setLoading(false);
        }
    }, [timestamp]);

    return (
        <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'settingsContratos']}>
            {/* <div className={classes.titulo} ><h5>Clientes</h5><Divider /></div> */}

            <Toolbar className={classes.header}>
                <PageTitle icon={<CurrencyExchangeIcon sx={{ margin: 1, fontSize: 45 }} />} breadcrumbs={'Cobranças'} />
            </Toolbar>

            <SearchHeader keyword={searchKeyword} setKeyword={setSearchKeyword} />

            <Table className={classes.table}>
                <TableHead>
                    <TableRow>
                        <TableCell>{"Cliente"}</TableCell>
                        <TableCell>{"CPF"}</TableCell>
                        <TableCell>{"Valor"}</TableCell>
                        <TableCell>{"Gerada"}</TableCell>
                        <TableCell>{"Vencimento"}</TableCell>
                        {/* <TableCell>{"CPF"}</TableCell>
                        <TableCell>{"Descrição"}</TableCell>
                        <TableCell>{"Valor"}</TableCell>
                        <TableCell>{t('sharedDisabled')}</TableCell>
                        <TableCell>{"Inicio"}</TableCell>
                        <TableCell>{t('userExpirationTime')}</TableCell> */}
                        <TableCell>{"STATUS"}</TableCell>
                        <TableCell className={classes.columnAction} />
                    </TableRow>
                </TableHead>

                <TableBody>
                    {!loading ? currentTableData.filter(filterByKeyword(searchKeyword)).map((item) => (
                        <TableRow key={item.id}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>{item.cpfCnpj}</TableCell>
                            <TableCell>R$ {formatarNumero(item.value)}</TableCell>
                            <TableCell>{converterData(item.dateCreated)}</TableCell>
                            <TableCell>{converterData(item.dueDate)}</TableCell>
                            {/* <TableCell>{item.cpfCnpj}</TableCell>
                            <TableCell>{item.description}</TableCell>
                            <TableCell>R$ {item.value}</TableCell>
                            <TableCell>{formatBoolean(item.disabled, t)}</TableCell>
                            <TableCell>{converterData(item.dateCreated)}</TableCell>
                            <TableCell>{converterData(item.nextDueDate)}</TableCell> */}
                            <TableCell>{item.status}</TableCell>
                            <TableCell className={classes.columnAction} padding="none">
                                <CollectionActions
                                    itemId={item.id}
                                    editPath={item.bankSlipUrl}
                                    endpoint="users"
                                    setTimestamp={setTimestamp}
                                // customActions={manager ? [actionConnections] : [actionConnections]}
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

            {/* <CollectionFab editPath="/settings/contrato" /> */}
        </PageLayout>
    );
};

export default FaturasPage;
