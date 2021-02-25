import { Injectable } from '@nestjs/common';
import { ModJar } from './mod-jar.entity';
import { ModVersion } from './mod-version.entity';

@Injectable()
class ModService {

  getModsInJar(jar: ModJar): Promise<ModVersion[]> {
    return jar.$get('mods');
  }
}

export { ModService };
