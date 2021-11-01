import assert from 'assert';
import childProcess from 'child_process';
import fsCb from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { Inject } from '@nestjs/common';
import { getMostCompatibleMcVersion, isMcVersionLikelyCompatibleWith } from '../../../common/minecraft-utils';
import { ModJar } from '../mod/mod-jar.entity';
import { ModService } from '../mod/mod.service';
import { ModpackService } from '../modpack/modpack.service';
import { rimraf } from '../utils/rimraf';
import ModpackMod from './modpack-mod.entity';
import type { ModpackVersion } from './modpack-version.entity';

export class ModpackVersionDownloaderService {
  constructor(
    @Inject(ModpackService)
    private readonly modpackService: ModpackService,
    @Inject(ModService)
    private readonly modService: ModService,
  ) {
  }

  async getModpackJars(modpackVersion: ModpackVersion): Promise<ModJar[]> {
    return ModJar.findAll({
      include: [{
        association: ModJar.associations.mods,
        required: true,
      }, {
        association: ModJar.associations.inModpacks,
        required: true,
        include: [{
          association: ModpackMod.associations.modpackVersion,
          required: true,
          where: {
            internalId: modpackVersion.internalId,
          },
        }],
      }],
    });
  }

  async downloadModpackToFileStream(modpackVersion: ModpackVersion): Promise<NodeJS.ReadableStream> {
    const [allJars, modpack] = await Promise.all([
      this.getModpackJars(modpackVersion),
      this.modpackService.getModpackByIid(modpackVersion.modpackId),
    ]);

    assert(modpack != null);

    const compatibleJars = allJars.filter(jar => {
      assert(jar.mods != null && jar.mods.length > 0, 'downloadModpackToFileStream: expected jar to eagerly include mods');

      let containsCompatibleMod = false;
      for (const mod of jar.mods) {
        // mod.supportedModLoader
        if (mod.supportedModLoader !== modpack.modLoader) {
          continue;
        }

        const mostCompatible = getMostCompatibleMcVersion(modpack.minecraftVersion, mod.supportedMinecraftVersions);
        if (!isMcVersionLikelyCompatibleWith(modpack.minecraftVersion, mostCompatible)) {
          continue;
        }

        containsCompatibleMod = true;
        break;
      }

      return containsCompatibleMod;
    });

    // TODO use tmp package
    const outputZipFile = path.resolve('tmp-zip.zip');

    // TODO use tmp package
    const tmpModpackDir = path.resolve('.tmp-zip-dir');
    const modsDir = path.join(tmpModpackDir, 'mods');

    await fs.mkdir(modsDir, { recursive: true });

    // TODO: delete fsFiles
    // const fsFiles =
    await Promise.all(compatibleJars.map(async dbJar => {
      const fsFile = await this.modService.downloadJarToFsPath(dbJar);

      const fsSafeFileName = slugifyJarForFs(dbJar.fileName);
      assert(fsSafeFileName.length > 0, `fsSafeFileName is empty for input ${dbJar.fileName}`);

      // TODO: rename if file exists
      const outFile = path.join(modsDir, fsSafeFileName);

      await fs.symlink(fsFile, outFile);
    }));

    const modsDirRel = path.relative(tmpModpackDir, modsDir);

    await new Promise<void>((resolve, reject) => {
      const command = `cd ${tmpModpackDir} && zip ${path.relative(tmpModpackDir, outputZipFile)} -r ${modsDirRel}`;
      childProcess.exec(command, (error, stdout, stderr) => {
        // eslint-disable-next-line no-console
        console.log(stdout);
        console.error(stderr);

        if (error) {
          return void reject(error);
        }

        resolve();
      });
    });

    await rimraf(tmpModpackDir);

    return fsCb.createReadStream(outputZipFile);
  }
}

function slugifyJarForFs(input: string) {
  const extname = path.extname(input);
  if (extname === '.jar') {
    input = input.substring(0, input.length - extname.length);
  }

  // whitelist alphanumeric
  return `${input.replace(/[^a-zA-Z0-9_\-.]/g, '-')
    // remove consecutive -
    .replace(/-+/g, '-')
    // remove start & end -
    .replace(/^-*/, '')
    .replace(/-*$/, '')}.jar`;
}
