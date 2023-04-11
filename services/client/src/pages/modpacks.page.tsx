import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import { useCallback } from 'react';
import { useHistory, Link } from 'react-router-dom';
import minecraftVersions from '../../../common/minecraft-versions.json';
import { ModLoader } from '../../../common/modloaders';
import { uriTag } from '../../../common/url-utils';
import { useCreateModpackMutation, useModpackListViewQuery } from '../api/graphql.generated';
import { isLoadedUrql } from '../api/urql';
import Actions from '../components/actions';
import { UrqlErrorDisplay } from '../components/urql-error-display';
import { getFormValues } from '../utils/dom-utils';
import css from './modpacks.module.scss';

export default function Home() {
  const history = useHistory();

  const callCreateModpack = useCreateModpackMutation();
  const createModpackSubmit = useCallback(e => {
    e.preventDefault();

    const form = e.currentTarget;

    callCreateModpack(getFormValues(form)).then(res => {
      const modpack = res.createModpack.node;
      history.push(uriTag`/modpacks/${modpack.id}/${modpack.lastVersionIndex}`);
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
              <Link to={uriTag`/modpacks/${modpack.id}/${modpack.lastVersionIndex}`}>{modpack.name} {modpack.minecraftVersion} {modpack.modLoader}</Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
