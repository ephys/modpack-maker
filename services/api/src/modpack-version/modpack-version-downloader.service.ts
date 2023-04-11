import assert from 'node:assert';
import childProcess from 'node:child_process';
import fsCb from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getMostCompatibleMcVersion, isMcVersionLikelyCompatibleWith } from '@ephys/modpack-maker-common/minecraft-utils.js';
import { Inject } from '@nestjs/common';
import { rimraf } from 'rimraf';
import { ModJar } from '../mod/mod-jar.entity.js';
import { ModService } from '../mod/mod.service.js';
import { ModpackService } from '../modpack/modpack.service.js';
import { ModpackMod } from './modpack-mod.entity.js';
import type { ModpackVersion } from './modpack-version.entity.js';

export class ModpackVersionDownloaderService {
  constructor(
    @Inject(ModpackService)
    private readonly modpackService: ModpackService,
    @Inject(ModService)
    private readonly modService: ModService,
  ) {}

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
    input = input.slice(0, Math.max(0, input.length - extname.length));
  }

  // whitelist alphanumeric
  return `${input.replaceAll(/[^a-zA-Z0-9_\-.]/g, '-')
    // remove consecutive -
    .replaceAll(/-+/g, '-')
    // remove start & end -
    .replace(/^-*/, '')
    .replace(/-*$/, '')}.jar`;
}
