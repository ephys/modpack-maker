import { Redirect } from 'react-router-dom';

export default {
  path: '/',
  exact: true,
  component: () => <Redirect to={'/modpacks'} />,
};
