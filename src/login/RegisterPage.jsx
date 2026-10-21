import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Button, TextField, Typography, Snackbar, IconButton,
} from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LoginLayout from './LoginLayout';
import { useTranslation } from '../common/components/LocalizationProvider';
import { snackBarDurationShortMs } from '../common/util/duration';
import { useCatch } from '../reactHelper';
import { sessionActions } from '../store';

const useStyles = makeStyles((theme) => ({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(2),
    },
    header: {
        display: 'flex',
        alignItems: 'center',
    },
    title: {
        fontSize: theme.spacing(3),
        fontWeight: 500,
        marginLeft: theme.spacing(1),
        textTransform: 'uppercase',
    },
}));

const RegisterPage = () => {
    const classes = useStyles();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const t = useTranslation();

    const server = useSelector((state) => state.session.server);

    const currentUser = { informacoes: {} };

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [snackbarOpen, setSnackbarOpen] = useState(false);

    const [item, setItem] = useState({});

    const handleSubmit = useCatch(async () => {

        let temp = {
            name: name,
            email: email,
            password: password,
            attributes: item
        };

        console.log(temp);

        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(temp),
        });
        
        if (response.ok) {
            setSnackbarOpen(true);
        } else {
            throw Error(await response.text());
        }
    });

    return (
        <LoginLayout>
            <div className={classes.container}>
                <div className={classes.header}>
                    {!server.newServer && (
                        <IconButton color="primary" onClick={() => navigate('/login')}>
                            <ArrowBackIcon />
                        </IconButton>
                    )}
                    <Typography className={classes.title} color="primary">
                        {t('loginRegister')}
                    </Typography>
                </div>

                <TextField
                    required
                    label={t('sharedName')}
                    name="name"
                    value={name}
                    autoComplete="name"
                    autoFocus
                    onChange={(event) => setName(event.target.value)}
                />

                <TextField
                    required
                    type="email"
                    label={t('userEmail')}
                    name="email"
                    value={email}
                    autoComplete="email"
                    onChange={(event) => setEmail(event.target.value)}
                />

                <TextField
                    required
                    label={t('userPassword')}
                    name="password"
                    value={password}
                    type="password"
                    autoComplete="current-password"
                    onChange={(event) => setPassword(event.target.value)}
                />

                {/* <TextField
                    value={(item.informacoes && item.informacoes.cpf) || ''}
                    onChange={(event) => setItem({ ...item, informacoes: { ...item.informacoes, cpf: event.target.value } })}
                    label={'CPF'}
                />

                <TextField
                    value={(item.informacoes && item.informacoes.endereco) || ''}
                    onChange={(event) => setItem({ ...item, informacoes: { ...item.informacoes, endereco: event.target.value } })}
                    label={'Endereço'}
                /> */}

                <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleSubmit}
                    disabled={!name || !password || !(server.newServer || /(.+)@(.+)\.(.{2,})/.test(email))}
                    fullWidth
                >
                    {t('loginRegister')}
                </Button>
            </div>

            <Snackbar
                open={snackbarOpen}
                onClose={() => {
                    dispatch(sessionActions.updateServer({ ...server, newServer: false }));
                    navigate('/login');
                }}
                autoHideDuration={snackBarDurationShortMs}
                message={t('loginCreated')}
            />
        </LoginLayout>
    );
};

export default RegisterPage;
