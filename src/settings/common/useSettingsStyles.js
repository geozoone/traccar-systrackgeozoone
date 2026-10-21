import { makeStyles } from '@mui/styles';

export default makeStyles((theme) => ({
	titulo:{
		width: '100%',
		padding: '15px',
	},
	header: {
        position: 'sticky',
		width: '100%',
        left: 0,
    },
	table: {
		marginBottom: theme.spacing(10),
	},
	columnAction: {
		width: '1%',
		paddingRight: theme.spacing(1),
	},
}));
