import './_app.scss';
import { createTheme as createMuiTheme, ThemeProvider } from '@material-ui/core/styles';
import { Provider } from 'urql';
import { urqlClient } from '../api/urql';

const theme = createMuiTheme({
  palette: {
    primary: {
      contrastText: '#fafafa',
      main: '#f72585',
    },
    secondary: {
      main: '#4cc9f0',
      contrastText: '#fafafa',
    },
    type: 'dark',
  },
});

export default function MyApp({ Component, pageProps }) {
  return (
    <Provider value={urqlClient}>
      <ThemeProvider theme={theme}><Component {...pageProps} /></ThemeProvider>
    </Provider>
  );
}
