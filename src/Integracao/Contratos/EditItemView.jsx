import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import makeStyles from '@mui/styles/makeStyles';
import {
	Container, Button, Accordion, AccordionDetails, AccordionSummary, Skeleton, Typography, TextField,Toolbar,
    useTheme,
    useMediaQuery
} from '@mui/material';
import { useCatch, useEffectAsync } from '../../reactHelper';
import { useTranslation } from '../../common/components/LocalizationProvider';
import PageLayout from '../../common/components/PageLayout';

import useSettingsStyles from '../../settings/common/useSettingsStyles';
import RecentActorsIcon from '@mui/icons-material/RecentActors';
import GroupsIcon from '@mui/icons-material/Groups';
import TopicIcon from '@mui/icons-material/Topic';

const useStyles = makeStyles((theme) => ({
	container: {
		marginTop: theme.spacing(2),
	},
	buttons: {
		marginTop: theme.spacing(2),
		marginBottom: theme.spacing(2),
		display: 'flex',
		justifyContent: 'space-evenly',
		'& > *': {
			flexBasis: '33%',
		},
	},
	details: {
		display: 'flex',
		flexDirection: 'column',
	},
}));

const PageTitle = ({ icon, breadcrumbs }) => {
    const theme = useTheme();
    const t = useTranslation();
    const classes = useSettingsStyles();

    const desktop = useMediaQuery(theme.breakpoints.up('md'));

    return (
        <>{icon}
            <Typography variant="h6" noWrap>{breadcrumbs}</Typography>
        </>
    );
};

const EditItemView = ({
	children, endpoint, item, setItem, defaultItem, validate, onItemSaved, menu, breadcrumbs,
}) => {
	const navigate = useNavigate();
	const classes = useStyles();
	const t = useTranslation();

	const { id } = useParams();

	useEffectAsync(async () => {
		if (!item) {
			if (id) {
				const response = await fetch(`/modulo/contratos/${id}`);
				if (response.ok) {
					setItem(await response.json());
				} else {
					throw Error(await response.text());
				}
			} else {
				setItem(defaultItem || {});
			}
		}
	}, [id, item, defaultItem]);

	const handleSave = useCatch(async () => {
		let url = `/modulo/contratos`;

		if (id) {
			url += `/${id}`;
		}
		
		const response = await fetch(url, {
			method: !id ? 'POST' : 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(item),
		});

		if (response.ok) {
			if(id){				
				 location.reload();
			}else{
				navigate('/settings/contratos');
			}
			// navigate(-1);
		} else {
			throw Error(await response.text());
		}
	});

	return (
		<PageLayout menu={menu} breadcrumbs={breadcrumbs}>
			<Toolbar className={classes.header}>
                <PageTitle icon={<TopicIcon sx={{ margin: 1, fontSize: 45 }} />} breadcrumbs={'Cadastro do Contrato'} />
            </Toolbar>
			<Container className={classes.container}>
				{item ? children : (
					<Accordion defaultExpanded>
						<AccordionSummary>
							<Typography variant="subtitle1">
								<Skeleton width="10em" />
							</Typography>
						</AccordionSummary>
						<AccordionDetails>
							{[...Array(3)].map((_, i) => (
								<Skeleton key={-i} width="100%">
									<TextField />
								</Skeleton>
							))}
						</AccordionDetails>
					</Accordion>
				)}
				<div className={classes.buttons}>
					<Button
						type="button"
						color="primary"
						variant="outlined"
						onClick={() => navigate(-1)}
						disabled={!item}
					>
						{t('sharedCancel')}
					</Button>
					<Button
						type="button"
						color="primary"
						variant="contained"
						onClick={handleSave}
						disabled={!item || !validate()}
					>
						{t('sharedSave')}
					</Button>
				</div>
			</Container>
		</PageLayout>
	);
};

export default EditItemView;
