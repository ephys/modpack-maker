import CircularProgress from '@mui/material/CircularProgress';
import { useErrorsPageQuery } from '../api/graphql.generated.js';
import { isLoadedUrql } from '../api/urql.js';

export default function ErrorsPage() {
  const errorsUrql = useErrorsPageQuery();

  if (!isLoadedUrql(errorsUrql)) {
    return <CircularProgress />;
  }

  return (
    <div>
      <h1>Errors Page</h1>
      {errorsUrql.data.projectErrors.map(error => {
        return <p key={error.description}>{error.count} {error.description}</p>;
      })}
    </div>
  );
}
