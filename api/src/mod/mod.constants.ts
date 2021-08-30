import { ModVersion } from './mod-version.entity';

export const MOD_VERSION_REPOSITORY_KEY = 'MOD_VERSION_REPOSITORY';

export const FETCH_CURSE_FILES_QUEUE = 'fetch-curse-project-files';

export const ModVersionRepository = {
  provide: MOD_VERSION_REPOSITORY_KEY,
  useValue: ModVersion,
};
