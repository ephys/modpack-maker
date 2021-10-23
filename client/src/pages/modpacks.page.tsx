import { Button, FormControl, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import { useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import minecraftVersions from '../../../common/minecraft-versions.json';
import { ModLoader } from '../../../common/modloaders';
import { useCreateModpackMutation, useModpackListViewQuery } from '../api/graphql.generated';
import { isLoadedUrql } from '../api/urql';
import Actions from '../components/actions';
import { UrqlErrorDisplay } from '../components/urql-error-display';
import { getFormValues } from '../utils/dom-utils';
import { uriTag } from '../utils/url-utils';
import css from './modpacks.module.scss';

export default function Home() {
  const history = useHistory();

  const callCreateModpack = useCreateModpackMutation();
  const createModpackSubmit = useCallback(e => {
    e.preventDefault();

    const form = e.currentTarget;

    callCreateModpack(getFormValues(form)).then(res => {
      history.push(uriTag`/modpacks/${res.createModpack.node.id}`);
    }, error => {
      // TODO error snack
      console.error(error);
    });
  }, [history, callCreateModpack]);

  return (
    <>
      <form className={css.page} onSubmit={createModpackSubmit}>
        <h2>Create a new Modpack</h2>
        <div className={css.fields}>
          <div>
            <TextField id="name" label="Modpack Name" name="name" required />
          </div>
          <div>
            <FormControl className={css.formControl}>
              <InputLabel htmlFor="minecraft-version">Minecraft Version</InputLabel>
              <Select id="minecraft-version" name="minecraftVersion" required defaultValue="">
                {minecraftVersions.map(version => {
                  return (
                    <MenuItem key={version} value={version}>{version}</MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </div>
          <div>
            <FormControl className={css.formControl}>
              <InputLabel htmlFor="mod-loader">Mod Loader</InputLabel>

              <Select id="mod-loader" name="modLoader" required defaultValue="">
                {Object.keys(ModLoader).map(loader => {
                  return (
                    <MenuItem key={loader} value={loader}>{loader}</MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </div>
        </div>

        <Actions>
          <Button type="submit">
            Create
          </Button>
        </Actions>
      </form>

      <ExistingModpackList />
    </>
  );
}

function ExistingModpackList() {
  const urql = useModpackListViewQuery();

  if (!isLoadedUrql(urql)) {
    return 'loading';
  }

  if (urql.error) {
    return (
      <UrqlErrorDisplay urql={urql} />
    );
  }

  if (urql.data.modpacks.length === 0) {
    return null;
  }

  return (
    <div>
      <h2>Existing modpacks</h2>
      <ul>
        {urql.data.modpacks.map(modpack => {
          return (
            <li key={modpack.id}>
              <a href={`/modpacks/${modpack.id}`}>{modpack.name} {modpack.minecraftVersion} {modpack.modLoader}</a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
