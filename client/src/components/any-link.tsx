import Link from 'next/link';
import type { ComponentProps } from 'react';

type TAnyLinkProps = Omit<ComponentProps<'a'>, 'href'> & {
  href: ComponentProps<typeof Link>['href'],
};

const BASE_REL = 'noopener noreferrer';

function AnyLink(props: TAnyLinkProps) {
  const { href, ...passDown } = props;

  // It is intended to be an external link
  if (typeof href === 'string' && /^(https?|mailto):/.test(href)) {
    const rel = typeof props.rel === 'string' ? `${props.rel} ${BASE_REL}` : BASE_REL;
    const target = props.target ?? '_blank';

    return <a {...props} href={href} rel={rel} target={target} />;
  }

  return (
    <Link href={href}>
      <a {...passDown}>
        {/* next/link uses Children.only for some reason, but Material Menu gives an array containing a null item */}
        {props.children}
      </a>
    </Link>
  );
}

export { AnyLink };
