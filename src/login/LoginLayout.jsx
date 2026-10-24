import React from 'react';
import { useMediaQuery, Paper } from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import { useTheme } from '@mui/material/styles';
import { ReactComponent as Logo } from '../../public/imagens/logo-geozoone.svg';
import useBranding from '../common/util/useBranding';

import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import AppleIcon from '@mui/icons-material/Apple';
import AdbIcon from '@mui/icons-material/Adb';

const useStyles = makeStyles((theme) => ({
    root: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: "url('./imagens/background.jpg')",
        backgroundSize: "100% 100%"
    },
    sidebar: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: theme.palette.primary.main,
        paddingBottom: theme.spacing(5),
        width: theme.dimensions.sidebarWidth,
        [theme.breakpoints.down('lg')]: {
            width: theme.dimensions.sidebarWidthTablet,
        },
        [theme.breakpoints.down('sm')]: {
            width: '0px',
        },
    },
    paper: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'white',
        backgroundImage: "url('./background.jpg')",
        backgroundSize: "100% 100%"
    },
    form: {
        maxWidth: theme.spacing(52),
        padding: theme.spacing(5),
        width: '100%',
    },
    logo: {
        alignSelf: 'center',
        width: 'auto',
        maxWidth: '240px',
        maxHeight: '150px',
        objectFit: 'contain',
    },
}));

const LoginLayout = ({ children }) => {
    const classes = useStyles();
    const theme = useTheme();
    const { branding } = useBranding();

    const customRootStyle = branding?.background ? {
        backgroundImage: `url(${branding.background})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
    } : {};

    return (
        <main className={classes.root} style={customRootStyle}>
            <div className={"box-conteiner"}>
                <form className={classes.form}>
                    <div className={'logoMarca'}>
                        {branding?.logo ? (
                            <img
                                src={branding.logo}
                                alt={branding.title || 'Logo'}
                                className={classes.logo}
                            />
                        ) : (
                            <Logo className={classes.logo} />
                        )}
                    </div>
                    {children}

                    <div className={"apps"}>
                        <AdbIcon />
                        <AppleIcon />
                        <WhatsAppIcon />
                    </div>
                </form>
            </div>
        </main>
    );
};

export default LoginLayout;
