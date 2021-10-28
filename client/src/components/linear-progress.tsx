import MuiLinearProgress from '@mui/material/LinearProgress';
import classnames from 'classnames';
import type { ComponentProps } from 'react';
import css from './linear-progress.module.scss';

export function LinearProgress(props: ComponentProps<typeof MuiLinearProgress>) {
  const { className, ...passDown } = props;

  return (
    <div className={classnames(className, css.linearProgress, 'full-bleed')} >
      <MuiLinearProgress {...passDown} />
    </div>
  );
}
