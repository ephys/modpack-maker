import type { TUseQueryOutput } from '../api/urql.js';

type Props = {
  urql: TUseQueryOutput<any, any>,
};

export function UrqlErrorDisplay(props: Props) {
  console.error(props.urql.error);

  return <p>error</p>;
}
