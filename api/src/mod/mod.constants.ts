import { ModVersion } from './mod-version.entity';

export const MOD_VERSION_REPOSITORY_KEY = 'MOD_VERSION_REPOSITORY';

// !TODO: rename
export const FETCH_CURSE_JARS_QUEUE = 'fetch-curse-jars';
export const FETCH_MODRINTH_JARS_QUEUE = 'fetch-modrinth-jars';

export const ModVersionRepository = {
  provide: MOD_VERSION_REPOSITORY_KEY,
  useValue: ModVersion,
};
