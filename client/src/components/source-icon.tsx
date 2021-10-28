import type { ComponentProps } from 'react';
import { ProjectSource } from '../api/graphql.generated';

type Props = {
  source: ProjectSource,
} & Pick<ComponentProps<'img'>, 'style' | 'className'>;

export function SourceIcon(props: Props) {
  const { source, ...passDown } = props;

  return source === ProjectSource.Curseforge ? (
    <img {...passDown} src="/curse.svg" height="32" />
  ) : (
    <img {...passDown} src="/modrinth.svg" height="32" width="32" />
  );
}
