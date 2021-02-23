import './_app.scss';
import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles';

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
  }
});

export default function MyApp({ Component, pageProps }) {
  return <ThemeProvider theme={theme}><Component {...pageProps} /></ThemeProvider>;
}
