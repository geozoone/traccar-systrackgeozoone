import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Checkbox,
    FormGroup,
    TextField,
    Button,
    IconButton,
    useTheme,
    useMediaQuery
} from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { useDispatch, useSelector } from 'react-redux';
import dayjs from 'dayjs';
import EditItemView from './EditItemView';
import EditAttributesAccordion from '../../settings/components/EditAttributesAccordion';
import { useTranslation } from '../../common/components/LocalizationProvider';
import useUserAttributes from '../../common/attributes/useUserAttributes';
import { sessionActions } from '../../store';
import SelectField from '../../common/components/SelectField';
import SettingsMenu from '../../settings/components/SettingsMenu';
import useCommonUserAttributes from '../../common/attributes/useCommonUserAttributes';
import { useAdministrator, useRestriction, useManager } from '../../common/util/permissions';
import useQuery from '../../common/util/useQuery';
import { useCatch, useEffectAsync } from '../../reactHelper';
import useMapStyles from '../../map/core/useMapStyles';
import { map } from '../../map/core/MapView';
import SearchHeader, { filterByKeyword } from '../../settings/components/SearchHeader';
import { DropzoneArea } from 'react-mui-dropzone';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

import DownloadLink from "react-download-link";

const useStyles = makeStyles((theme) => ({
    details: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(2),
        paddingBottom: theme.spacing(3),
    },
    img: {
        width: '120px',
        textAlign: 'center',
    }
}));

const ClientePage = () => {
    const classes = useStyles();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const t = useTranslation();

    const admin = useAdministrator();

    const mapStyles = useMapStyles();
    const commonUserAttributes = useCommonUserAttributes(t);
    const userAttributes = useUserAttributes(t);

    const { id } = useParams();

    const [item, setItem] = useState();

    const [timestamp, setTimestamp] = useState(Date.now());
    const [searchKeyword, setSearchKeyword] = useState('');
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffectAsync(async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/users');
            if (response.ok) {
                let Clientes = await response.json();

                Clientes.sort((a, b) => {
                    if (a.name < b.name) {
                        return -1;
                    } else {
                        return true;
                    }
                });

                let listClientes = [];

                for (var i = 0; i < Clientes.length; i++) {
                    if (Clientes[i].attributes.nivel == 3) {
                        if (Clientes[i].attributes.idasaas) {
                            listClientes[i] = Clientes[i];
                        }
                    }
                }

                setClientes(listClientes);
            } else {
                throw Error(await response.text());
            }
        } finally {
            setLoading(false);
        }
    }, [timestamp]);

    const query = useQuery();
    const [queryHandled, setQueryHandled] = useState(false);
    const attribute = query.get('attribute');

    const onItemSaved = (result) => {
        if (result.id === currentUser.id) {
            dispatch(sessionActions.updateUser(result));
        }
    };

    const validate = () => item && item.customer && item.value;

    useEffect(useCatch(async () => {
        if (id) {
            const response = await fetch(`/modulo/contratos/${id}`);
            const contrato = await response.json();

            setItem(contrato);
        }
    }), []);

    const theme = useTheme();
    const desktop = useMediaQuery(theme.breakpoints.up('md'));

    return (
        <EditItemView
            endpoint="users"
            item={item}
            setItem={setItem}
            defaultItem={admin ? { deviceLimit: -1 } : {}}
            validate={validate}
            onItemSaved={onItemSaved}
            menu={<SettingsMenu />}
            breadcrumbs={['settingsTitle', 'settingsUser']}
        >
            {item && (
                <>
                    <Accordion defaultExpanded={!attribute}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="subtitle1">
                                Informações
                            </Typography>
                        </AccordionSummary>

                        <AccordionDetails className={'m-3 form-row'} >
                            <span className={`form-group col-sm-12 ${classes.details} `}>
                                <InputLabel>{'Cliente'}</InputLabel>
                                <FormControl>
                                    <InputLabel>{'Selecione Um Cliente'}</InputLabel>
                                    <Select
                                        label={'Clietne'}
                                        value={item.customer && item.customer || ''}
                                        onChange={(event) => setItem({ ...item, customer: event.target.value })}
                                    >
                                        {!loading ? clientes.filter(filterByKeyword(searchKeyword)).map((clientes) => (
                                            <MenuItem value={clientes.attributes.idasaas}>{clientes.name}</MenuItem>
                                        )) : id ? <MenuItem value={item.customer}>{item.name}</MenuItem> : ''}

                                    </Select>
                                </FormControl>
                            </span>

                            <span className={`form-group col-sm-6 ${classes.details} `}>
                                <InputLabel>{'Em um intervalo'}</InputLabel>
                                <FormControl>
                                    <Select
                                        value={item.cycle && item.cycle || ''}
                                        onChange={(event) => setItem({ ...item, cycle: event.target.value })}
                                    >
                                        <MenuItem value={"WEEKLY"}>{"SEMANALMENTE"}</MenuItem>
                                        <MenuItem value={"BIWEEKLY"}>{"QUINZENAL"}</MenuItem>
                                        <MenuItem value={"MONTHLY"}>{"POR MÊS"}</MenuItem>
                                        <MenuItem value={"BIMONTHLY"}>{"BIMENSAL"}</MenuItem>
                                        <MenuItem value={"QUARTERLY"}>{"TRIMESTRAL"}</MenuItem>
                                        <MenuItem value={"SEMINANULLY"}>{"SEMI ANUALMENTE"}</MenuItem>
                                        <MenuItem value={"YEARLY"}>{"ANUAL"}</MenuItem>
                                    </Select>
                                </FormControl>
                            </span>

                            <span className={`form-group col-sm-6 ${classes.details} `}>
                                <InputLabel>{'Com valor fixo de'}</InputLabel>
                                <TextField
                                    value={item.value && formatarNumero(item.value) || ''}
                                    onChange={(event) => setItem({ ...item, value: event.target.value })}
                                    label={'0,00'}
                                />
                            </span>

                            <span className={`form-group col-sm-6 ${classes.details} `}>
                                <InputLabel>{'Vencimento da primeira cobrança'}</InputLabel>
                                <TextField
                                    type='date'
                                    value={item.nextDueDate && item.nextDueDate || ''}
                                    onChange={(event) => setItem({ ...item, nextDueDate: event.target.value })}
                                />
                            </span>

                            <span className={`form-group col-sm-6 ${classes.details} `}>
                                <InputLabel>{'Data de fim de assinatura'}</InputLabel>
                                <TextField
                                    type='date'
                                    value={item.endDate && item.endDate || ''}
                                    onChange={(event) => setItem({ ...item, endDate: event.target.value })}
                                />
                            </span>

                            <span className={`form-group col-sm-12 ${classes.details} `}>
                                <InputLabel>{'Descrição'}</InputLabel>
                                <textarea
                                    value={item.description && item.description || ''}
                                    onChange={(event) => setItem({ ...item, description: event.target.value })}
                                    rows={8}
                                    cols={80}
                                />

                                {/* <TextField
                                    value={item.description || ''}
                                    onChange={(event) => setItem({ ...item, description: event.target.value })}
                                    label={t('sharedName')}
                                /> */}
                            </span>
                        </AccordionDetails>
                    </Accordion>

                    {/* {registrationEnabled && item.id === currentUser.id && !manager && (
                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle1" color="error">
                                    {t('userDeleteAccount')}
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails className={classes.details}>
                                <TextField
                                    value={deleteEmail}
                                    onChange={(event) => setDeleteEmail(event.target.value)}
                                    label={t('userEmail')}
                                    error={deleteFailed}
                                />
                                <Button
                                    variant="outlined"
                                    color="error"
                                    onClick={handleDelete}
                                    startIcon={<DeleteForeverIcon />}
                                >
                                    {t('userDeleteAccount')}
                                </Button>
                            </AccordionDetails>
                        </Accordion>
                    )} */}
                </>
            )}
        </EditItemView>
    );
};

export default ClientePage;
