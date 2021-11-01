import { Chip } from '@mui/material';
import type { ReactNode } from 'react';
import type { ReleaseType } from '../api/graphql.generated';

type ChipReleaseTypeProps = {
  type: ReleaseType,
};

export function ChipReleaseType(props: ChipReleaseTypeProps) {
  // TODO: color
  return (
    <Chip label={props.type} />
  );
}

type ChipsProps = {
  children: ReactNode,
};

export function Chips(props: ChipsProps) {
  return <div>{props.children}</div>;
}
