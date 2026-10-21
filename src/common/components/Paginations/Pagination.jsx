import React from 'react';
import classnames from 'classnames';
import { usePagination } from './usePagination';
import {
    Table, TableRow, TableCell, TableHead, TableBody, TableFooter, useTheme, useMediaQuery, Typography, Toolbar
} from '@mui/material';
// import './pagination.scss';
const Pagination = props => {
    const {
        onPageChange,
        totalCount,
        siblingCount = 1,
        currentPage,
        pageSize,
        className
    } = props;

    const paginationRange = usePagination({
        currentPage,
        totalCount,
        siblingCount,
        pageSize
    });

    if (currentPage === 0 || paginationRange.length < 2) {
        return null;
    }

    const onNext = () => {
        onPageChange(currentPage + 1);
    };

    const onPrevious = () => {
        onPageChange(currentPage - 1);
    };

    let lastPage = paginationRange[paginationRange.length - 1];
    return (
        <TableRow >
            <TableCell colspan="6" className="pagination-bar">
                <nav aria-label="Navegação de página exemplo">
                    <ul class="pagination justify-content-end">
                        <li class=" " className={classnames('pagination-item, page-item', {
                            disabled: currentPage === 1
                        })}>
                            <a class="page-link" href="#" onClick={onPrevious}>Anterior</a>
                        </li>

                        <li class="page-item">
                            <a class="page-link">{currentPage}</a>
                        </li>

                        <li className={classnames('pagination-item, page-item', {
                            disabled: currentPage === lastPage
                        })}>
                            <a class="page-link" href="#" onClick={onNext}>Próximo</a>
                        </li>
                    </ul>
                </nav>
            </TableCell>
        </TableRow>
    );
};

export default Pagination;
