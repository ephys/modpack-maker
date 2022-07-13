import SuccessIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorIcon from '@mui/icons-material/ErrorOutline';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import WarnIcon from '@mui/icons-material/Warning';
import IconButton from '@mui/material/IconButton';
import classNames from 'classnames';
import type { LocationDescriptor } from 'history';
import type { ReactComponentLike } from 'prop-types';
import type { ComponentType, ForwardedRef, ReactElement, ReactNode, SyntheticEvent } from 'react';
import { forwardRef, isValidElement } from 'react';
import type { MessageDescriptor } from 'react-intl';
import { useIntl } from 'react-intl';
import { isMessageDescriptor } from '../utils/intl.js';
import css from './alert.module.scss';
import { Anchor, ButtonAnchor } from './wysiwyg.js';

export type TAlertAction = {
  icon?: ReactElement | ComponentType,
  title: string | MessageDescriptor,
  onClick?(e: SyntheticEvent<HTMLButtonElement | HTMLAnchorElement>): void,
  key?: string,
  href?: LocationDescriptor,
  target?: string,
  // TODO: implement
  disabled?: boolean,
  // TODO: implement
  loading?: boolean,
};

type Props = {
  type: TAlertTypes,
  children: ReactNode,
  className?: string,
  icon?: ReactComponentLike,
  actions?: TAlertAction[],
  onActionClick?(): any,
  centered?: boolean,
  shrink?: boolean,
};

export const AlertIcons = Object.freeze({
  warn: WarnIcon,
  info: InfoIcon,
  success: SuccessIcon,
  error: ErrorIcon,
});

export type TAlertTypes = 'info' | 'success' | 'warn' | 'error';

export const Alert = forwardRef((props: Props, ref: ForwardedRef<HTMLDivElement>) => {
  const intl = useIntl();

  const Icon = props.icon ?? AlertIcons[props.type];

  return (
    <div
      ref={ref}
      className={classNames(
        css.alert,
        css[props.type],
        props.className,
        props.centered && css.centered,
        props.shrink && css.shrink,
      )}
    >
      <div className={css.message}>
        {Icon && <Icon className={css.icon} />}
        <div className={css.contents}>
          {props.children}
        </div>
      </div>

      {props.actions && props.actions.length > 0 && (
        <div className={css.actions}>
          {props.actions.map((action, i) => {
            const title = isMessageDescriptor(action.title)
              ? intl.formatMessage(action.title)
              : action.title;

            let icon = action.icon;

            if (icon == null) {
              return (
                <AlertAction href={action.href} onClick={action.onClick} key={action.key ?? i}>
                  {title}
                </AlertAction>
              );
            }

            if (icon != null && !isValidElement(icon)) {
              const IconComp = icon;
              icon = <IconComp />;
            }

            // FIXME: add support for .href
            return (
              <IconButton
                key={action.key ?? i}
                title={title}
                color="inherit"
                onClick={props.onActionClick}
              >
                {icon}
              </IconButton>
            );
          })}
        </div>
      )}
    </div>
  );
});

type TSnackActionProps = {
  children: ReactNode,
  href?: TAlertAction['href'],
  onClick?: TAlertAction['onClick'],
};

function AlertAction(props: TSnackActionProps) {
  if (props.href) {
    return (
      <Anchor to={props.href} onClick={props.onClick} className={css.alertAction}>
        {props.children}
      </Anchor>
    );
  }

  return (
    <ButtonAnchor onClick={props.onClick} className={css.alertAction}>
      {props.children}
    </ButtonAnchor>
  );
}
