import classes from 'classnames';
import * as React from 'react';
import css from './style.module.scss';

type ActionListProps = {
  children: React.ReactNode,
  className?: string,
  spaced?: boolean,
};

export function RightAlignedActions(props: ActionListProps) {
  return (
    <div className={classes(css.rightAlignedActions, props.className, props.spaced ? css.spaced : null)}>
      {props.children}
    </div>
  );
}
