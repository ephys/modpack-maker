import { Button, FormControl, InputLabel, MenuItem, Select, TextField } from '@material-ui/core';
import Actions from '../components/actions';
import { useCallback } from 'react';
import minecraftVersions from '../../common/minecraft-versions.json';
import { ModLoader } from '../../common/modloaders';
import css from './index.module.scss';
import { getFormValues } from '../utils/dom-utils';
import { createModpack } from '../api/create-modpack';
import { useRouter } from 'next/router';
import { uriTag } from '../utils/url-utils';
import { useGraphQl } from '../api/graphql';
import { isLoadedSwr } from '../api/swr';

export default function Home() {
  const router = useRouter();

  const createModpackSubmit = useCallback(e => {
    e.preventDefault();

    const form = e.currentTarget;

    // @ts-ignore
    createModpack(getFormValues(form)).then(node => {
      router.push(uriTag`/modpacks/${node.id}`);
    }, error => {
      // TODO error snack
      console.error(error);
    });
  }, [router]);

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
              <Select id="minecraft-version" name="minecraftVersion" required>
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

              <Select id="mod-loader" name="modLoader" required>
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
  const swr = useData();

  if (!isLoadedSwr(swr)) {
    return 'loading';
  }

  if (swr.error) {
    return swr.error;
  }

  if (swr.data.modpacks.length === 0) {
    return null;
  }

  return (
    <div>
      <h2>Existing modpacks</h2>
      <ul>
        {swr.data.modpacks.map(modpack => {
          return (
            <li>
              <a href={`/modpacks/${modpack.id}`}>{modpack.name} {modpack.minecraftVersion} {modpack.modLoader}</a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function useData() {
  return useGraphQl({
    // language=GraphQL
    query: `
      query Data {
        modpacks {
          id
          minecraftVersion
          modLoader
          name
        }
      }
    `,
  });
}
