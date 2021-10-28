import type { ReactElement } from 'react';

export function NotFoundErrorDisplay(): ReactElement {
  // @ts-expect-error
  return '404';
}
