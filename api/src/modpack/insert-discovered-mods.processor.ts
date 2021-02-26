import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { INSERT_DISCOVERED_MODS_QUEUE } from './modpack.constants';
import { ModpackService } from './modpack.service';
import { Modpack } from './modpack.entity';
import { Op, Sequelize } from 'sequelize';
import { InjectSequelize } from '../database/database.providers';

@Processor(INSERT_DISCOVERED_MODS_QUEUE)
export class InsertDiscoveredModsProcessor {
  constructor(
    private readonly modpackService: ModpackService,
    @InjectSequelize private readonly sequelize: Sequelize,
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

      const promises = [];
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
