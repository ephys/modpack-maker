import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import type { ComponentProps } from 'react';
import { useCallback } from 'react';
import type { TJarModalQuery } from '../api/graphql.generated';
import { useAddJarToModpackMutation, useJarModalQuery } from '../api/graphql.generated';
import { isLoadedUrql } from '../api/urql';
import { RightAlignedActions } from './actions/right-aligned-actions';
import { AnyLink } from './any-link';
import { ChipReleaseType, Chips } from './chips';
import css from './jar-details.module.scss';
import { Modal } from './modal';
import { NotFoundErrorDisplay } from './not-found-error-display';
import { useSnackbar } from './snackbar.js';
import { UrqlErrorDisplay } from './urql-error-display';

type Props = {
  jarId: string,
  onClose: ComponentProps<typeof Modal>['onClose'],
} & Pick<JarDetailsProps, 'modpackId'>;

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
        <JarDetails jar={fileUrql.data.jar} modpackId={props.modpackId} />
      )}
    </Modal>
  );
}

type JarDetailsProps = {
  jar: NonNullable<TJarModalQuery['jar']>,
  modpackId?: string,
};

// TODO: warn when jar is not compatible with modpack

function JarDetails(props: JarDetailsProps) {
  const { jar, modpackId } = props;

  const addSnack = useSnackbar();
  const callAddJar = useAddJarToModpackMutation();
  // TODO: async callback
  // TODO: on success, add snack with action "return to modpack"
  const addToModpack = useCallback(async () => {
    await callAddJar({
      modpackVersion: modpackId!,
      jar: jar.id,
    });

    addSnack('Added to modpack', {
      type: 'success',
    });
  }, [jar.id]);

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
        {modpackId && (
          <Button onClick={addToModpack}>Add to modpack</Button>
        )}
        <Button component={AnyLink} to={jar.downloadUrl}>Download</Button>
      </RightAlignedActions>
    </article>
  );
}

export const URL_KEY_FILE_MODAL = 'file';
