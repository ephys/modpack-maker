import type { CombinedError } from 'urql';

type Props = {
  error: CombinedError,
};

export function UrqlErrorDisplay(props: Props) {
  console.error(props.error);

  return <p>error</p>;
}
