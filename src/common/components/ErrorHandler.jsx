import { Snackbar, Alert } from '@mui/material';
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { usePrevious } from '../../reactHelper';
import { errorsActions } from '../../store';
import { humanizeError } from '../../store/errors';

const ErrorHandler = () => {
  const dispatch = useDispatch();

  const rawError = useSelector((state) => state.errors.errors.find(() => true));
  const error = humanizeError(rawError);
  const previousError = usePrevious(error);

  const handleClose = (_, reason) => {
    if (reason === 'clickaway') return;
    dispatch(errorsActions.pop());
  };

  return (
    <Snackbar
      open={!!rawError}
      autoHideDuration={6000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        elevation={6}
        onClose={handleClose}
        severity="error"
        variant="filled"
        sx={{ width: '100%', maxWidth: '600px' }}
      >
        {error || previousError}
      </Alert>
    </Snackbar>
  );
};

export default ErrorHandler;
