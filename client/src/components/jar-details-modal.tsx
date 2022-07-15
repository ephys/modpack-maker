import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import type { ComponentProps } from 'react';
import type { TJarModalQuery } from '../api/graphql.generated';
import { useJarModalQuery } from '../api/graphql.generated';
import { isLoadedUrql } from '../api/urql';
import { jarInModpack, useAddJarToModpack, useRemoveJarFromModpack } from '../utils/modpack-utils.js';
import { RightAlignedActions } from './actions/right-aligned-actions';
import { AnyLink } from './any-link';
import { ChipReleaseType, Chips } from './chips';
import { useCurrentModpack } from './current-modpack-provider.js';
import css from './jar-details.module.scss';
import { Modal } from './modal';
import { NotFoundErrorDisplay } from './not-found-error-display';
import { UrqlErrorDisplay } from './urql-error-display';

type Props = {
  jarId: string,
  onClose: ComponentProps<typeof Modal>['onClose'],
};

// TODO: loadable
export function JarDetailsModal(props: Props) {
  const fileUrql = useJarModalQuery({
    variables: {
      id: props.jarId,
    },
  });

  return (
    <Modal open onClose={props.onClose}>
      {!isLoadedUrql(fileUrql) ? (
        <CircularProgress />
      ) : fileUrql.error ? (
        <UrqlErrorDisplay urql={fileUrql} />
      ) : fileUrql.data.jar == null ? (
        <NotFoundErrorDisplay />
      ) : (
        <JarDetails jar={fileUrql.data.jar} />
      )}
    </Modal>
  );
}

type JarDetailsProps = {
  jar: NonNullable<TJarModalQuery['jar']>,
};

// TODO: warn when jar is not compatible with modpack

function JarDetails(props: JarDetailsProps) {
  const { jar } = props;

  const currentModpack = useCurrentModpack();
  const [addJarToModpack] = useAddJarToModpack();
  const [removeJarFromModpack] = useRemoveJarFromModpack();

  return (
    <article>
      <header className={css.jarDetailsHeader}>
        <h1>{jar.fileName}</h1>

        <Chips>
          <ChipReleaseType type={jar.releaseType} />
        </Chips>
      </header>

      <h2>Contains mods:</h2>
      <ul>
        {jar.mods.map(mod => {
          return (
            <li key={mod.id}>
              <h3>{mod.modId} {mod.modVersion}</h3>

              <p>Mod Loader: {mod.supportedModLoader}</p>
              <p>Supported Minecraft versions: {mod.supportedMinecraftVersions.join(', ')}</p>
            </li>
          );
        })}
      </ul>

      <h2>Changelog</h2>
      {/* TODO: changelog */}
      <p>Not yet available</p>

      <RightAlignedActions>
        {currentModpack == null ? null : jarInModpack(currentModpack, jar.id) ? (
          <Button onClick={() => void removeJarFromModpack(jar.id)}>Remove from modpack</Button>
        ) : (
          <Button onClick={() => void addJarToModpack(jar.id)}>Add to modpack</Button>
        )}
        <Button component={AnyLink} to={jar.downloadUrl}>Download</Button>
      </RightAlignedActions>
    </article>
  );
}

export const URL_KEY_FILE_MODAL = 'file';
