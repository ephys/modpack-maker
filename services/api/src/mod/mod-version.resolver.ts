import { ID, Parent, ResolveField, Resolver } from '../esm-compat/nest-graphql-esm.js';
import { ModVersion } from './mod-version.entity.js';

@Resolver(() => ModVersion)
export class ModVersionResolver {
  @ResolveField('id', () => ID)
  getModVersionId(@Parent() modVersion: ModVersion) {
    // TODO: use externalId + prefix
    return String(modVersion.internalId);
  }
}
