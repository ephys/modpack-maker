import loadable from '@loadable/component';
import CircularProgress from '@mui/material/CircularProgress';

export default {
  path: '/errors',
  exact: true,
  component: loadable(async () => import('./errors.page.js'), {
    fallback: <CircularProgress />,
  }),
};
