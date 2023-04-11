import classnames from 'classnames';
import type { ReactNode } from 'react';
import css from './actions.module.scss';

type ActionListProps = {
  children: ReactNode,
  className?: string,
};

export default function Actions(props: ActionListProps) {
  return (
    <div className={css.actionsGap}>
      <div className={classnames(css.actions, props.className)}>
        {props.children}
      </div>
    </div>
  );
}
