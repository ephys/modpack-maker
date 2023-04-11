import loadable from '@loadable/component';
import CircularProgress from '@mui/material/CircularProgress';

export default {
  path: '/modpacks/:modpackId/:versionIndex',
  exact: true,
  // lazy-load the homepage
  component: loadable(async () => import('./modpack.page.js'), {
    fallback: <CircularProgress />,
  }),
};
