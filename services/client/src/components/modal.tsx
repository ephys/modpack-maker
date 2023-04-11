import Box from '@mui/material/Box';
import MuiModal from '@mui/material/Modal';
import classNames from 'classnames';
import type { ComponentProps, ReactNode } from 'react';
import css from './modal.module.scss';

type Props = Omit<ComponentProps<typeof MuiModal>, 'children'> & {
  children: ReactNode,
};

export function Modal(props: Props) {
  return (
    <MuiModal {...props} className={classNames(props.className, css.modal)}>
      <Box className={css.modalBox}>
        {props.children}
      </Box>
    </MuiModal>
  );
}
