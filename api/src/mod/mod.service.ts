import { Injectable } from '@nestjs/common';
import { ModJar } from './mod-jar.entity';
import { ModVersion } from './mod-version.entity';

@Injectable()
class ModService {

  getModsInJar(jar: ModJar): Promise<ModVersion[]> {
    return jar.$get('mods');
  }

  getJar(jarId: string): Promise<ModJar | null> {
    return ModJar.findOne({
      where: {
        externalId: jarId,
      }
    });
  }
}

export { ModService };
