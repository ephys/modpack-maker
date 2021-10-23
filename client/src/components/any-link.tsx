import type { ComponentProps } from 'react';
import { Link } from 'react-router-dom';

type TAnyLinkProps = Pick<ComponentProps<'a'>, 'rel' | 'target'> & {
  to: ComponentProps<typeof Link>['to'],
};

const BASE_REL = 'noopener noreferrer';

function AnyLink(props: TAnyLinkProps) {
  const { to, ...passDown } = props;

  // It is intended to be an external link
  if (typeof to === 'string' && /^(https?|mailto):/.test(to)) {
    const rel = typeof props.rel === 'string' ? `${props.rel} ${BASE_REL}` : BASE_REL;
    const target = props.target ?? '_blank';

    return <a {...props} href={to} rel={rel} target={target} />;
  }

  return (
    <Link {...passDown} to={to} />
  );
}

export { AnyLink };
