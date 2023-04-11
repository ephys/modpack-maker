import CloseIcon from '@mui/icons-material/Close';
import Snackbar from '@mui/material/Snackbar';
import type { ReactNode } from 'react';
import * as React from 'react';
import { Component, createContext, isValidElement, useCallback } from 'react';
import type { IntlShape, MessageDescriptor } from 'react-intl';
import { defineMessages, injectIntl } from 'react-intl';
import { isPlainObject } from '../utils/check.js';
import { createTrappedCallable } from '../utils/dev.js';
import { formatMessageOrString, isMessageDescriptor } from '../utils/intl.js';
import { useFifoQueue } from '../utils/use-fifo-queue';
import type { TAlertAction } from './alert';
import { Alert } from './alert.js';
import css from './snackbar.module.scss';

const messages = defineMessages({
  close: { defaultMessage: 'Close notification' },
});

type Props = {
  snackbars: ISnackObj[],
  shiftSnack(): void,
  intl: IntlShape,
};

type State = {
  open: boolean,
};

const TIME_BETWEEN_SNACKS = 500;

type TFuzzyMessage = ReactNode | MessageDescriptor;

export type ISnack = TFuzzyMessage | ISnackObj;

export type TSnackAction = TAlertAction;

export type ISnackObj = {
  content: TFuzzyMessage,
} & IAddSnackOpts;

export type IAddSnackOpts = {
  title?: TFuzzyMessage,
  actions?: TSnackAction[],
  type: 'error' | 'info' | 'warn' | 'success',
};

export function isValidSnack(val: any): val is ISnack {
  const type = typeof val;

  return type === 'string' || type === 'number' || isValidElement(val) || isMessageDescriptor(val) || (isPlainObject(val) && 'content' in val);
}

export type TAddSnackFn = (snack: TFuzzyMessage, opts: IAddSnackOpts) => void;

export const SnackbarContext = createContext<TAddSnackFn>(createTrappedCallable());

export function SnackbarProvider(props: { children: ReactNode }) {
  const [snackbars, pushSnack, shiftSnack] = useFifoQueue<ISnackObj>();

  const addSnack = useCallback((snack: ISnack, opts?: IAddSnackOpts) => {
    const theSnack: ISnackObj = isSnackObj(snack) ? {
      ...snack,
      ...opts,
    } : {
      content: snack,
      ...opts,
    };

    pushSnack(theSnack);
  }, [pushSnack]);

  return (
    <SnackbarContext.Provider value={addSnack}>
      {props.children}
      <AppSnackbar snackbars={snackbars} shiftSnack={shiftSnack} />
    </SnackbarContext.Provider>
  );
}

class AppSnackbarNoIntl extends Component<Props, State> {

  state = {
    open: true,
  };

  _running = false;

  handleClose = () => {
    if (this._running) {
      return;
    }

    this._running = true;

    this.setState({ open: false });

    setTimeout(() => {
      this.props.shiftSnack();

      this.setState({ open: true });

      this._running = false;
    }, TIME_BETWEEN_SNACKS);
  };

  render() {
    const { intl, snackbars } = this.props;

    if (snackbars.length === 0) {
      return null;
    }

    const snack = snackbars[0];

    const title = formatMessageOrString(intl, snack.title);
    const content = formatMessageOrString(intl, snack.content);
    const actions = snack.actions ?? [];
    const type = snack.type;

    return (
      <Snackbar
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        open={this.state.open}
        onClose={this.handleClose}
        onClick={this.handleClose}
        ContentProps={{
          'aria-describedby': 'message-id',
        }}
        className={css.snackbar}
      >
        <Alert
          shrink
          type={type}
          onActionClick={this.handleClose}
          actions={[
            ...actions,
            {
              icon: CloseIcon,
              onClick: this.handleClose,
              title: this.props.intl.formatMessage(messages.close),
              key: 'close',
            },
          ]}
        >
          {title && <h2>{title}</h2>}
          {typeof content === 'string' ? <p>{content}</p> : content}
        </Alert>
      </Snackbar>
    );
  }
}

function isSnackObj(item: any): item is ISnackObj {
  return item != null && item.content !== undefined;
}

export const AppSnackbar = injectIntl(AppSnackbarNoIntl);

export function useSnackbar(): TAddSnackFn {
  return React.useContext(SnackbarContext);
}
