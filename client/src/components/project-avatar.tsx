import { Avatar } from '@mui/material';
import type { ComponentProps } from 'react';

type Props = Pick<ComponentProps<typeof Avatar>, 'src'>;

export function ProjectAvatar(props: Props) {
  return (
    <Avatar variant="square" alt="" src={props.src} sx={{ width: 96, height: 96 }} />
  );
}
