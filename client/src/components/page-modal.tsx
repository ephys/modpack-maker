import Box from '@mui/material/Box';
import Modal from '@mui/material/Modal';
import type { ComponentProps, ReactNode } from 'react';
import { createContext, useContext, useMemo, useRef } from 'react';
import { useResetScroll } from '../utils/use-reset-scroll';
import css from './page-modal.module.scss';

type Props = {
  onClose: ComponentProps<typeof Modal>['onClose'],
  children: ReactNode,
};

type TModalContext = {
  resetScroll(): void,
};

const ModalContext = createContext<TModalContext>({ resetScroll() {} });

export function PageModal(props: Props) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const resetScroll = useResetScroll(modalRef);

  const context: TModalContext = useMemo(() => {
    return { resetScroll };
  }, [resetScroll]);

  return (
    <ModalContext.Provider value={context}>
      <Modal open className={css.modal} onClose={props.onClose}>
        <Box className={css.modalBox} ref={modalRef}>
          {props.children}
        </Box>
      </Modal>
    </ModalContext.Provider>
  );
}

export function usePageModalContext() {
  return useContext(ModalContext);
}
