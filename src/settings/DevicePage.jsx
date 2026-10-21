import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    FormControl,
    Select,
    MenuItem,
    FormControlLabel,
    Checkbox,
    TextField,
    IconButton,
    InputLabel,
} from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { DropzoneArea } from 'react-mui-dropzone';
import EditItemView from './components/EditItemView';
import EditAttributesAccordion from './components/EditAttributesAccordion';
import SelectField from '../common/components/SelectField';
import deviceCategories from '../common/util/deviceCategories';
import { useTranslation } from '../common/components/LocalizationProvider';
import useDeviceAttributes from '../common/attributes/useDeviceAttributes';
import { useAdministrator } from '../common/util/permissions';
import SettingsMenu from './components/SettingsMenu';
import useCommonDeviceAttributes from '../common/attributes/useCommonDeviceAttributes';
import { useCatch, useEffectAsync } from '../reactHelper';
import SearchHeader, { filterByKeyword } from '../settings/components/SearchHeader';

import DeleteIcon from '@mui/icons-material/Delete';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

const useStyles = makeStyles((theme) => ({
    details: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(2),
        paddingBottom: theme.spacing(3),
    },
}));

const DevicePage = () => {
    const classes = useStyles();
    const t = useTranslation();

    const admin = useAdministrator();

    const commonDeviceAttributes = useCommonDeviceAttributes(t);
    const deviceAttributes = useDeviceAttributes(t);

    const { id } = useParams();
    const [item, setItem] = useState();

    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [timestamp, setTimestamp] = useState(Date.now());

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

    console.log(item);

    useEffect(useCatch(async () => {
        if (!id) {
            setItem({ ...item, attributes: { veiculo: {} } });
        }
    }), []);

    const handleFiles = useCatch(async (files) => {
        if (files.length > 0) {
            const response = await fetch(`/api/devices/${item.id}/image`, {
                method: 'POST',
                body: files[0],
            });
            if (response.ok) {
                return setItem({ ...item, attributes: { ...item.attributes, deviceImage: await response.text() } });
            } else {
                throw Error(await response.text());
            }
        }

        return setItem({ ...item, attributes: { ...item.attributes, deviceImage: null } });
    });

    const teypArquivo = (data) => {
        // Expressão regular para identificar os tipos de arquivo nas strings data URI
        var regex = /data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64/g;

        // Array para armazenar os tipos de arquivo encontrados
        var tiposArquivo = [];
        var match;

        // Loop para encontrar todos os tipos de arquivo
        while ((match = regex.exec(data)) !== null) {
            tiposArquivo.push(match[1]); // Adiciona o tipo de arquivo encontrado ao array
        }

        return tiposArquivo[0];
    }

    const imgDocumento = (img) => {
        var teyp = teypArquivo(img);

        return (img != null && (
            <div className={'drive-wrapper'}>
                <div className={`drive-item module`}>
                    <span className={'drive-item-inner module-inner'}>
                        <img src={`/api/media/${item.uniqueId}/${img}`} className={`position-relative ${classes.img}`} alt='reect logo' />
                    </span>
                    <span className={'drive-item-footer module-footer'}>
                        <IconButton
                            href={img}
                            download="Example-PDF-document"
                            target="_blank"
                        >
                            <CloudDownloadIcon fontSize="small" />
                        </IconButton>

                        <IconButton onClick={handleFiles} ><DeleteIcon fontSize="small" /></IconButton>
                    </span>
                </div>
            </div>
        ) || (
                <DropzoneArea
                    dropzoneText={t('sharedDropzoneText')}
                    acceptedFiles={['image/*', 'application/pdf']}
                    filesLimit={1}
                    onChange={handleFiles}
                    showAlerts={false}
                />
            ))
    }

    const validate = () => item && item.name && item.uniqueId;



    return (
        <EditItemView
            endpoint="devices"
            item={item}
            setItem={setItem}
            validate={validate}
            menu={<SettingsMenu />}
            breadcrumbs={['settingsTitle', 'sharedDevice']}
        >
            {item && (
                <>
                    <Accordion defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="subtitle1">
                                {t('sharedRequired')}
                            </Typography>
                        </AccordionSummary>

                        <AccordionDetails className={'form-row'} >
                            <span className={`form-group col-sm-4 ${classes.details} `}>
                                <TextField
                                    value={item.name || ''}
                                    onChange={(event) => setItem({ ...item, name: event.target.value })}
                                    label={t('sharedName')}
                                />
                            </span>
                            <span className={`form-group col-sm-8 ${classes.details} `}>
                                <TextField
                                    value={item.uniqueId || ''}
                                    onChange={(event) => setItem({ ...item, uniqueId: event.target.value })}
                                    label={t('deviceIdentifier')}
                                    helperText={t('deviceIdentifierHelp')}
                                />
                            </span>

                            <span className={`form-group col-sm-3 ${classes.details} `}>
                                <TextField
                                    value={item.model || ''}
                                    onChange={(event) => setItem({ ...item, model: event.target.value })}
                                    label={t('deviceModel')}
                                />
                            </span>

                            <span className={`form-group col-sm-3 ${classes.details} `}>
                                <TextField
                                    value={item.phone || ''}
                                    onChange={(event) => setItem({ ...item, phone: event.target.value })}
                                    label={'CHIP-M2M'}
                                />
                            </span>

                            <span className={`form-group col-sm-3 ${classes.details} `}>
                                <TextField
                                    value={(item.attributes && item.attributes.iccid) || ''}
                                    onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, iccid: e.target.value } })}
                                    label={'ICCID'}
                                />
                            </span>

                            <span className={`form-group col-sm-3 ${classes.details} `}>
                                <TextField
                                    value={(item.attributes && item.attributes.operadora) || ''}
                                    onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, operadora: e.target.value } })}
                                    label={'OPERADORA'}
                                />
                            </span>
                        </AccordionDetails>
                    </Accordion>

                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="subtitle1">
                                {'Veiculo'}
                            </Typography>
                        </AccordionSummary>

                        <AccordionDetails className={'form-row'}>
                            <span className={`form-group col-sm-12 ${classes.details} `}>
                                <FormControl>
                                    <InputLabel>{'Cliente'}</InputLabel>
                                    <Select
                                        label={'Clietne'}
                                        value={item.attributes.veiculo && item.attributes.veiculo.cliente || ''}
                                        onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, veiculo: { ...item.attributes.veiculo, cliente: e.target.value } } })}
                                    >
                                        {!loading ? clientes.filter(filterByKeyword(searchKeyword)).map((clientes) => (
                                            <MenuItem value={clientes.name}>{clientes.name}</MenuItem>
                                        )) : id ? <MenuItem value={clientes.name}>{clientes.name}</MenuItem> : ''}

                                    </Select>
                                </FormControl>
                            </span>

                            <span className={`form-group col-sm-3 ${classes.details} `}>
                                <SelectField
                                    value={item.category || 'default'}
                                    emptyValue={null}
                                    onChange={(event) => setItem({ ...item, category: event.target.value })}
                                    data={deviceCategories.map((category) => ({
                                        id: category,
                                        name: t(`category${category.replace(/^\w/, (c) => c.toUpperCase())}`),
                                    }))}
                                    label={t('deviceCategory')}
                                />
                            </span>

                            <span className={`form-group col-sm-3 ${classes.details} `}>
                                <TextField
                                    value={(item.attributes.veiculo && item.attributes.veiculo.marca) || ''}
                                    onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, veiculo: { ...item.attributes.veiculo, marca: e.target.value } } })}
                                    label={'Marca'}
                                />
                            </span>

                            <span className={`form-group col-sm-3 ${classes.details} `}>
                                <TextField
                                    value={(item.attributes.veiculo && item.attributes.veiculo.modelo) || ''}
                                    onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, veiculo: { ...item.attributes.veiculo, modelo: e.target.value } } })}
                                    label={'Modelo'}
                                />
                            </span>

                            <span className={`form-group col-sm-3 ${classes.details} `}>
                                <TextField
                                    value={(item.attributes.veiculo && item.attributes.veiculo.ano) || ''}
                                    onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, veiculo: { ...item.attributes.veiculo, ano: e.target.value } } })}
                                    label={'ANO'}
                                />
                            </span>

                            <span className={`form-group col-sm-3 ${classes.details} `}>
                                <TextField
                                    value={item.contact || ''}
                                    onChange={(event) => setItem({ ...item, contact: event.target.value })}
                                    label={'Placa'}
                                />
                            </span>

                            <span className={`form-group col-sm-3 ${classes.details} `}>
                                <TextField
                                    value={(item.attributes.veiculo && item.attributes.veiculo.renavan) || ''}
                                    onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, veiculo: { ...item.attributes.veiculo, renavan: e.target.value } } })}
                                    label={'Renavan'}
                                />
                            </span>

                            <span className={`form-group col-sm-3 ${classes.details} `}>
                                <TextField
                                    value={(item.attributes.veiculo && item.attributes.veiculo.chassi) || ''}
                                    onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, veiculo: { ...item.attributes.veiculo, chassi: e.target.value } } })}
                                    label={'Chassi'}
                                />
                            </span>

                            <span className={`form-group col-sm-3 ${classes.details} `}>
                                <TextField
                                    value={(item.attributes.veiculo && item.attributes.veiculo.cor) || ''}
                                    onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, veiculo: { ...item.attributes.veiculo, cor: e.target.value } } })}
                                    label={'COR'}
                                />
                            </span>
                        </AccordionDetails>
                    </Accordion>

                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="subtitle1">
                                {t('sharedExtra')}
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails className={'form-row'} >
                            <span className={`form-group col-sm-4 ${classes.details} `}>
                                <SelectField
                                    value={item.groupId || 0}
                                    onChange={(event) => setItem({ ...item, groupId: Number(event.target.value) })}
                                    endpoint="/api/groups"
                                    label={t('groupParent')}
                                />
                            </span>

                            <span className={`form-group col-sm-4 ${classes.details} `}>
                                <SelectField
                                    value={item.calendarId || 0}
                                    onChange={(event) => setItem({ ...item, calendarId: Number(event.target.value) })}
                                    endpoint="/api/calendars"
                                    label={t('sharedCalendar')}
                                />
                            </span>

                            <span className={`form-group col-sm-4 ${classes.details} `}>
                                <TextField
                                    label={t('userExpirationTime')}
                                    type="date"
                                    value={(item.expirationTime && dayjs(item.expirationTime).locale('en').format('YYYY-MM-DD')) || '2099-01-01'}
                                    onChange={(e) => setItem({ ...item, expirationTime: dayjs(e.target.value, 'YYYY-MM-DD').locale('en').format() })}
                                    disabled={!admin}
                                />
                            </span>

                            <span className={`form-group col-sm-4 ${classes.details} `}>
                                <FormControlLabel
                                    control={<Checkbox checked={item.disabled} onChange={(event) => setItem({ ...item, disabled: event.target.checked })} />}
                                    label={t('sharedDisabled')}
                                    disabled={!admin}
                                />
                            </span>
                        </AccordionDetails>
                    </Accordion>
                    {item.id && (
                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle1">
                                    {t('attributeDeviceImage')}
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails className={classes.details}>
                                {imgDocumento((item.attributes && item.attributes.deviceImage) || null)}
                            </AccordionDetails>
                        </Accordion>
                    )}

                    {/* {item.id && (
                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle1">
                                    {t('attributeDeviceImage')}
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails className={classes.details}>
                                <DropzoneArea
                                    dropzoneText={t('sharedDropzoneText')}
                                    acceptedFiles={['image/*']}
                                    filesLimit={1}
                                    onChange={handleFiles}
                                    showAlerts={false}
                                />
                            </AccordionDetails>
                        </Accordion>
                    )} */}

                    <EditAttributesAccordion
                        attributes={item.attributes}
                        setAttributes={(attributes) => setItem({ ...item, attributes })}
                        definitions={{ ...commonDeviceAttributes, ...deviceAttributes }}
                    />
                </>
            )}
        </EditItemView>
    );
};

export default DevicePage;
