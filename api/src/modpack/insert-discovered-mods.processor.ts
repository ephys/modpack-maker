import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { INSERT_DISCOVERED_MODS_QUEUE } from './modpack.constants';
import { ModVersion } from '../mod/mod-version.entity';
import { ModpackService } from './modpack.service';
import { Modpack } from './modpack.entity';
import { Op } from 'sequelize';

@Processor(INSERT_DISCOVERED_MODS_QUEUE)
export class InsertDiscoveredModsProcessor {
  constructor(private readonly modpackService: ModpackService) {
  }

  @Process()
  async fetchCurseProjectFiles(job: Job<number>) {
    try {
      const curseProjectId = job.data;

      const modpacks = await Modpack.findAll({
        where: {
          pendingCurseForgeProjectIds: { [Op.contains]: [curseProjectId] },
        },
      });

      if (modpacks.length === 0) {
        return;
      }

      const matchingMods = await ModVersion.aggregate<Array<{ DISTINCT: string }>, ModVersion>('modId', 'DISTINCT', {
        plain: false,
        where: {
          curseProjectId,
        },
      });

      console.log('inject Curse Project', job.data);
      console.log('matching mods', matchingMods);

      const promises = [];

      for (const modpack of modpacks) {
        for (const mod of matchingMods) {
          promises.push(this.modpackService.addModToModpack(modpack, mod.DISTINCT));
        }

        console.log(modpack.pendingCurseForgeProjectIds);
        // remove the mod from the "pending" list
        modpack.pendingCurseForgeProjectIds = modpack.pendingCurseForgeProjectIds
          .filter(id => id !== curseProjectId);

        console.log(modpack.pendingCurseForgeProjectIds);
        promises.push(modpack.save());
      }

      await Promise.all(promises);
    } catch (e) {
      console.error('Queue processing failed');
      console.error(e);

      await job.moveToFailed(e);
    }
  }
}
