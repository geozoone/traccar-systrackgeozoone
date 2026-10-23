import React, { useState } from 'react';

import { useParams } from 'react-router-dom';
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
import { useCatch, useEffectAsync, usePrevious, useCatchCallback } from '../../reactHelper';

import OnlinePredictionIcon from '@mui/icons-material/OnlinePrediction';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

const WhatsApp = () => {
    const [container, Container] = useState();
    const [titulo, settitulo] = useState();
    const [button, setbutton] = useState();

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
        settitulo('Whats On-Line');
        Container(<WhatsAppIcon style={{ fontSize: 200, color: '#00FF00' }} ></WhatsAppIcon>);
        setbutton(<button onClick={desconect} className='btn btn btn-danger'>Desconectar</button>);
        desativarIntervalo();
    }

    const WhatsOffline = () => {
        settitulo('Whats OFF-Line');
        Container(<WhatsAppIcon style={{ fontSize: 200, color: '#FF0000' }} ></WhatsAppIcon>);
        setbutton(<button onClick={connect} className='btn btn-primary'>Conecta</button>);
    }

    const ApiWhatsOff = () => {
        settitulo('Whats API OFF-Line');
        Container(<WhatsAppIcon style={{ fontSize: 200, color: '#FF0000' }} ></WhatsAppIcon>);
        setbutton('');
    }

    const getQR = useCatch(async () => {
        Container(<img width='50%' src="/imagens/spinner.gif"></img>);

        try {
            const connectionState = await fetch('/modulo/whats/status', {
                headers: { "Content-Type": "application/json"},
            });
            
            if (!connectionState.ok) {
                ApiWhatsOff();
                return;
            }

            const obj = await connectionState.json();

            if (obj.status == "open" || obj.status == "connecting") {
                WhatsOnline();
                return;
            }

            const response = await fetch(`/modulo/whats/connect`, {
                headers: { "Content-Type": "application/json" }
            });

            if (response.status == 200) {
                const QR = await response.json();
                Container(<img width='50%' src={QR.base64}></img>);
                return;
            }

            create();
        } catch (e) {
            ApiWhatsOff();
        }
    })

    const create = useCatch(async () => {
        let temp = {};
        temp.instanceName = process.env.APIWHATSINSTANCE;

        const response = await fetch('/modulo/whats/create', {
            headers: { "Content-Type": "application/json"},
        });

        Container(<img src='/imagens/spinner.gif'></img>);

        return response;
    });

    const connect = () => {
        getQR();

        intervaloRef = setInterval(() => {
            getQR();
            console.log('ok');
        }, 30000);
    }

    const desativarIntervalo = () => {
        console.log('Whats Conectado');        
        clearInterval(intervaloRef);
    }

    const desconect = useCatch(async () => {
        const response = await fetch(`/modulo/whats/logout`, {
            headers: { "Content-Type": "application/json"}
        });

        WhatsOffline();
    })

    useEffectAsync(async () => {
        try {
            const response = await fetch('/modulo/whats/status', {
                headers: { "Content-Type": "application/json"},
            });

            if (!response.ok) {
                ApiWhatsOff();
                return;
            }

            let status = await response.json();

            switch (status?.status) {
                case "open":
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
    }, []);

    const urlObject = process.env.WHAST_APIHOST + '/' + process.env.INSTANCE_WHATS + '/' + process.env.CONECKEY;

    return (
        <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'settingsWhats']}>

            <div className={'container'}>
                <div className={"card"} >
                    <div className={"card-header bg-transparent "}>{titulo}</div>

                    <div className={"card-body text-center"} >
                        {container}
                    </div>

                    <div className={"card-footer bg-transparent text-right"}>
                        {button}
                    </div>
                </div>
            </div>

        </PageLayout>
    );
}

export default WhatsApp;