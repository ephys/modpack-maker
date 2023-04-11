import { ModVersion } from './mod-version.entity.js';

export const MOD_VERSION_REPOSITORY_KEY = 'MOD_VERSION_REPOSITORY';

export const FETCH_CURSE_JARS_QUEUE = 'fetch-curse-jars';
export const FETCH_MODRINTH_JARS_QUEUE = 'fetch-modrinth-jars';

export const ModVersionRepository = {
  provide: MOD_VERSION_REPOSITORY_KEY,
  useValue: ModVersion,
};
