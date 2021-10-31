import { ID, Parent, ResolveField, Resolver } from '../esm-compat/nest-graphql-esm';
import { ModVersion } from './mod-version.entity';

@Resolver(() => ModVersion)
export class ModVersionResolver {
  @ResolveField('id', () => ID)
  getModVersionId(@Parent() modVersion: ModVersion) {
    // TODO: use externalId + prefix
    return String(modVersion.internalId);
  }
}
