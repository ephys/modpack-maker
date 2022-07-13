import './_app.scss';
import { createTheme as createMuiTheme, ThemeProvider } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { Provider } from 'urql';
import { urqlClient } from '../api/urql';
import { SnackbarProvider } from '../components/snackbar.js';

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
    mode: 'dark',
  },
});

type Props = {
  children: ReactNode,
};

export default function App(props: Props) {
  return (
    <Provider value={urqlClient}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          {props.children}
        </SnackbarProvider>
      </ThemeProvider>
    </Provider>
  );
}
