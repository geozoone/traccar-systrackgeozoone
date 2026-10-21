import React from 'react';
import { useMediaQuery, Paper } from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import { useTheme } from '@mui/material/styles';
// import LogoImage from './LogoImage';
import { ReactComponent as Logo } from '../../public/imagens/logo-geozoone.svg';

import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import AppleIcon from '@mui/icons-material/Apple';
import AdbIcon from '@mui/icons-material/Adb';

const useStyles = makeStyles((theme) => ({
    root: {
        width: '100%',
        height: '100%',

        width: '100%',
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
        // flexDirection: 'column',
        // justifyContent: 'center',
        // alignItems: 'center',
        // flex: 1,
        // // boxShadow: '-2px 0px 16px rgba(0, 0, 0, 0.25)',
        // [theme.breakpoints.up('lg')]: {
        //   padding: theme.spacing(0, 25, 0, 0),
        // },
        background: 'white',
        backgroundImage: "url('./background.jpg')",
        backgroundSize: "100% 100%"
    },
    form: {
        maxWidth: theme.spacing(52),
        padding: theme.spacing(5),
        width: '100%',
        // background: "rgba(250, 250, 250, 0.9)"
    },
    logo: {
        alignSelf: 'center',
        // maxWidth: '100%',
        // maxHeight: '300px',
        width: 'auto',
        height: '150px',
    },
}));

const LoginLayout = ({ children }) => {
    const classes = useStyles();
    const theme = useTheme();

    return (
        <main className={classes.root}>
            {/* <div className={classes.sidebar}>
        {!useMediaQuery(theme.breakpoints.down('lg')) && <LogoImage color={theme.palette.secondary.contrastText} />}
      </div> */}
            {/* <Paper className={classes.paper}>       */}
            <div className={"box-conteiner"}>
                <form className={classes.form}>
                    <div className={'logoMarca'}>
                        <Logo className={classes.logo} />
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
