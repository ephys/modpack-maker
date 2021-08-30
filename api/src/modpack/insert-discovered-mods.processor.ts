import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { Op } from 'sequelize';
import { INSERT_DISCOVERED_MODS_QUEUE } from './modpack.constants';
import { Modpack } from './modpack.entity';
import { ModpackService } from './modpack.service';

@Processor(INSERT_DISCOVERED_MODS_QUEUE)
export class InsertDiscoveredModsProcessor {
  constructor(
    private readonly modpackService: ModpackService,
  ) {
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

      const promises: Array<Promise<any>> = [];
      for (const modpack of modpacks) {
        promises.push(
          this.modpackService.addCurseProjectToModpack(modpack, curseProjectId),
        );

        // remove the mod from the "pending" list
        modpack.pendingCurseForgeProjectIds = modpack.pendingCurseForgeProjectIds
          .filter(id => id !== curseProjectId);

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
