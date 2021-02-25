import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { INSERT_DISCOVERED_MODS_QUEUE } from './modpack.constants';
import { ModpackService } from './modpack.service';
import { Modpack } from './modpack.entity';
import { Op, QueryTypes, Sequelize } from 'sequelize';
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

      if (modpacks.length === 0) {
        return;
      }

      const matchingMods = await this.sequelize.query(`
SELECT DISTINCT mv."modId" FROM "ModVersions" mv
LEFT JOIN "ModJars" mj on mv."jarId" = mj."internalId"
WHERE mj."curseProjectId" = :curseProjectId
      `, {
        type: QueryTypes.SELECT,
        replacements: { curseProjectId },
      });

      console.log('inject Curse Project', job.data);
      console.log('matching mods', matchingMods);

      const promises = [];

      for (const modpack of modpacks) {
        // FIXME: add all modIds at the same time so the addToModpack logic can be a bit smarter:
        //  - fetch all versions that would be added
        //  - filter out those that are incompatible with current version
        //  - if there is still one left, only add that one
        //  - if 0 left, add all (NB. could cause two mods with same modId to be added)
        for (const mod of matchingMods) {
          // @ts-ignore
          promises.push(this.modpackService.addModToModpack(modpack, mod.modId));
        }

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
