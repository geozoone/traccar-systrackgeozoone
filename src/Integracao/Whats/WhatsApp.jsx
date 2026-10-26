import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    Container,
    TextField,
    Button,
} from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import SettingsMenu from '../../settings/components/SettingsMenu';
import PageLayout from '../../common/components/PageLayout';
import { useCatch, useEffectAsync } from '../../reactHelper';
import { useAdministrator } from '../../common/util/permissions';

import OnlinePredictionIcon from '@mui/icons-material/OnlinePrediction';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

const WhatsApp = () => {
    const currentUser = useSelector((state) => state.session.user);
    const admin = useAdministrator();

    // Instancia única por revendedor o instancia global para el SuperAdmin
    const instanceKey = admin ? 'geozoone' : `revenda_${currentUser?.id}`;

    const [container, setContainer] = useState();
    const [titulo, setTitulo] = useState();
    const [button, setButton] = useState();

    let intervaloRef;

    const useStyles = makeStyles((theme) => ({
        container: {
            marginTop: theme.spacing(2),
        },
        details: {
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing(2),
            paddingBottom: theme.spacing(3),
        }
    }));

    const classes = useStyles();

    const WhatsOnline = () => {
        setTitulo('WhatsApp Conectado');
        setContainer(
            <div className="text-center">
                <WhatsAppIcon style={{ fontSize: 180, color: '#25D366' }} />
                <h5 className="text-success mt-2">Canal Activo y Operativo</h5>
                <p className="text-muted" style={{ fontSize: '0.9rem' }}>
                    Las alertas de tu flota se despachan automáticamente desde tu número vinculado.
                </p>
            </div>
        );
        setButton(<button onClick={desconect} className='btn btn-danger'>Desconectar WhatsApp</button>);
        desativarIntervalo();
    };

    const WhatsOffline = () => {
        setTitulo('WhatsApp Desconectado');
        setContainer(
            <div className="text-center">
                <WhatsAppIcon style={{ fontSize: 180, color: '#dc3545' }} />
                <h5 className="text-danger mt-2">Canal Desconectado</h5>
                <p className="text-muted" style={{ fontSize: '0.9rem' }}>
                    Pulsa Conectar para generar un código QR y vincular el WhatsApp de tu empresa.
                </p>
            </div>
        );
        setButton(<button onClick={connect} className='btn btn-primary'>Conectar WhatsApp</button>);
    };

    const ApiWhatsOff = () => {
        setTitulo('Servicio de WhatsApp No Disponible');
        setContainer(
            <div className="text-center">
                <WhatsAppIcon style={{ fontSize: 180, color: '#6c757d' }} />
                <h5 className="text-secondary mt-2">Servicio en Mantenimiento</h5>
                <p className="text-muted">No se pudo contactar con el conector de WhatsApp.</p>
            </div>
        );
        setButton('');
    };

    const getQR = useCatch(async () => {
        setContainer(<div className="p-4"><div className="spinner-border text-primary" role="status"></div><div className="mt-2 text-muted">Generando código QR...</div></div>);

        try {
            const connectionState = await fetch(`/modulo/whats/status?instance=${encodeURIComponent(instanceKey)}`, {
                headers: { "Content-Type": "application/json" },
            });

            if (!connectionState.ok) {
                ApiWhatsOff();
                return;
            }

            const obj = await connectionState.json();

            if (obj.status === "open" || obj.status === "connected") {
                WhatsOnline();
                return;
            }

            const response = await fetch(`/modulo/whats/connect?instance=${encodeURIComponent(instanceKey)}`, {
                headers: { "Content-Type": "application/json" }
            });

            if (response.status === 200) {
                const QR = await response.json();
                if (QR.base64) {
                    setContainer(
                        <div className="text-center">
                            <img width='260px' src={QR.base64} alt="Código QR WhatsApp" style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '10px' }} />
                            <p className="mt-3 text-muted" style={{ fontSize: '0.85rem' }}>
                                Abre WhatsApp en tu celular ➡️ Dispositivos vinculados ➡️ Vincular un dispositivo.
                            </p>
                        </div>
                    );
                    return;
                }
            }

            create();
        } catch (e) {
            ApiWhatsOff();
        }
    });

    const create = useCatch(async () => {
        await fetch(`/modulo/whats/create?instance=${encodeURIComponent(instanceKey)}`, {
            headers: { "Content-Type": "application/json" },
        });

        setContainer(<div className="p-4"><div className="spinner-border text-primary" role="status"></div><div className="mt-2 text-muted">Iniciando canal...</div></div>);
    });

    const connect = () => {
        getQR();

        intervaloRef = setInterval(() => {
            getQR();
        }, 25000);
    };

    const desativarIntervalo = () => {
        clearInterval(intervaloRef);
    };

    const desconect = useCatch(async () => {
        await fetch(`/modulo/whats/logout?instance=${encodeURIComponent(instanceKey)}`, {
            headers: { "Content-Type": "application/json" }
        });

        WhatsOffline();
    });

    useEffectAsync(async () => {
        try {
            const response = await fetch(`/modulo/whats/status?instance=${encodeURIComponent(instanceKey)}`, {
                headers: { "Content-Type": "application/json" },
            });

            if (!response.ok) {
                ApiWhatsOff();
                return;
            }

            let status = await response.json();

            switch (status?.status) {
                case "open":
                case "connected":
                    WhatsOnline();
                    break;

                case "apiOff":
                    ApiWhatsOff();
                    break;

                default:
                    WhatsOffline();
                    break;
            }
        } catch (e) {
            ApiWhatsOff();
        }
    }, [instanceKey]);

    return (
        <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'settingsWhats']}>
            <div className={'container mt-3'}>
                <div className={"card shadow-sm"} style={{ maxWidth: '650px', margin: '0 auto' }}>
                    <div className={"card-header bg-light d-flex justify-content-between align-items-center"}>
                        <strong>{titulo}</strong>
                        <span className="badge badge-info p-2" style={{ fontSize: '0.8rem' }}>
                            {admin ? 'Canal Matriz (GeoZoone)' : `Canal Propio: ${currentUser?.name || 'Revendedor'}`}
                        </span>
                    </div>

                    <div className={"card-body text-center p-4"}>
                        {container}

                        <div className="alert alert-secondary mt-3 text-left" style={{ fontSize: '0.85rem' }}>
                            <strong>💡 Aislamiento de Marca:</strong> Al conectar tu propio número corporativo de WhatsApp, todas las alertas de tu flota (geocercas, pánico SOS, encendido) se despacharán con la identidad y número de tu empresa.
                        </div>
                    </div>

                    <div className={"card-footer bg-light text-right"}>
                        {button}
                    </div>
                </div>
            </div>
        </PageLayout>
    );
};

export default WhatsApp;