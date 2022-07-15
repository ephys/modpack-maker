import loadable from '@loadable/component';
import CircularProgress from '@mui/material/CircularProgress';

export default {
  path: '/modpacks',
  exact: true,
  // lazy-load the homepage
  component: loadable(async () => import('./modpacks.page.js'), {
    fallback: <CircularProgress />,
  }),
};
