import React, { useState } from 'react';
import {
    Card,
    CardContent,
    Typography,
    CardActions,
    IconButton,
    Table,
    TableBody,
    TableRow,
    TableCell,
    Menu,
    MenuItem,
    CardMedia,
    Button,
} from '@mui/material';

const ModalPopup = (title, body, footer, Close) => {

    return (
        <div className="popup">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">{title}</h5>
                        {Close}
                    </div>
                    <div className="modal-body">
                        <p>{body}</p>
                    </div>
                    <div className="modal-footer">
                        {footer}
                    </div>
                </div>
            </div>
    )
}

export default ModalPopup;