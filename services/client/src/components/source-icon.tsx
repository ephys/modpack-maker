import type { ComponentProps, ReactNode } from 'react';
import { ProjectSource } from '../api/graphql.generated';
import css from './source-icon.module.scss';

type Props = {
  source: ProjectSource,
} & Pick<ComponentProps<'img'>, 'style' | 'className'>;

export function SourceIcon(props: Props) {
  const { source, ...passDown } = props;

  return source === ProjectSource.Curseforge ? (
    <img {...passDown} src="/curse.svg" width="32" />
  ) : (
    <img {...passDown} src="/modrinth.svg" height="32" width="32" />
  );
}

export function WithSourceIcon(props: Props & { children: ReactNode }) {
  const { children, ...passDown } = props;

  return (
    <div className={css.sourceIconWrapper}>
      {children}
      <SourceIcon {...passDown} className={css.sourceIcon} />
    </div>
  );
}
