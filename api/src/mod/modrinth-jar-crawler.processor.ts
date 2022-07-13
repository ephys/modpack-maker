import assert from 'assert';
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import minecraftVersion from '../../../common/minecraft-versions.json';
import { InjectSequelize } from '../database/database.providers';
import { Sequelize, Op } from '../esm-compat/sequelize-esm';
import type { TModrinthProjectVersion } from '../modrinth.api';
import { getModrinthModFiles, getModrinthReleaseType } from '../modrinth.api';
import { Project, ProjectSource } from '../project/project.entity';
import { generateId } from '../utils/generic-utils';
import { getModVersionsFromJar } from './curseforge-jar-crawler.processor';
import type { TFetchJarQueueData } from './curseforge-project-list-crawler';
import { ModJar } from './mod-jar.entity';
import type { ModVersion } from './mod-version.entity';
import { FETCH_MODRINTH_JARS_QUEUE } from './mod.constants';

@Processor(FETCH_MODRINTH_JARS_QUEUE)
export class ModrinthJarCrawlerProcessor {
  private readonly logger = new Logger(ModrinthJarCrawlerProcessor.name);

  constructor(
    @InjectSequelize private readonly sequelize: Sequelize,
  ) {
  }

  // TODO: dedupe code with curseforge-jar-crawler.processor.ts
  @Process({
    concurrency: 10,
  })
  async fetchCurseProjectFiles(job: Job<TFetchJarQueueData>) {
    const projectSourceType = job.data[0];
    const sourceProjectId = job.data[1];

    if (projectSourceType == null) {
      this.logger.error(`Queue ${job.queue.name} received null projectSourceType`);

      return;
    }

    if (sourceProjectId == null) {
      this.logger.error(`Queue ${job.queue.name} received null sourceProjectId`);

      return;
    }

    if (projectSourceType !== ProjectSource.MODRINTH) {
      this.logger.error(`unsupported source "${projectSourceType}:${sourceProjectId}"`);

      return;
    }

    this.logger.log(`Processing ${projectSourceType} mod ${sourceProjectId}`);

    try {
      const files = await getModrinthModFiles(sourceProjectId);
      const fileIds = files.map(file => file.id);

      const existingFiles = await ModJar.findAll({
        attributes: ['sourceFileId'],
        where: { sourceFileId: { [Op.in]: fileIds } },
      });

      const existingFilesIds = new Set(existingFiles.map(item => item.sourceFileId));

      const project = await Project.findOne({
        where: {
          sourceType: projectSourceType,
          sourceId: sourceProjectId,
        },
      });

      assert(project != null);

      for (const file of files) {
        // file has already been processed
        if (existingFilesIds.has(file.id)) {
          continue;
        }

        // someone needs to clear this error before we try again
        if (project.failedFiles[file.id] != null) {
          continue;
        }

        this.logger.log(`Processing ${projectSourceType} file ${file.id} (${file.name})`);

        try {
          // eslint-disable-next-line no-await-in-loop
          await this.processFile(file, project);
        } catch (e) {
          this.logger.error(`Processing ${projectSourceType} file ${file.id} (${file.name}) failed:`);
          this.logger.error(e);

          const error = e.message;
          if (project.failedFiles[file.id] !== error) {
            project.failedFiles = {
              ...project.failedFiles,
              [file.id]: error,
            };

            // eslint-disable-next-line no-await-in-loop
            await project.save();
          }
        }
      }

      await Project.update({
        versionListUpToDate: true,
      }, {
        where: {
          sourceType: projectSourceType,
          sourceId: sourceProjectId,
        },
      });
    } catch (e) {
      this.logger.error(`Error while processing ${job.data}`);
      this.logger.error(e);

      throw e;
    }
  }

  private async processFile(sourceFileMeta: TModrinthProjectVersion, project: Project) {
    if (sourceFileMeta.files.length > 1) {
      throw new Error('We do not know how to process projects with more than one jar.');
    }

    const file = sourceFileMeta.files[0];

    const supportedPlatforms = sourceFileMeta.game_versions.map(version => version.toUpperCase());
    const supportedMcVersions = new Set<string>();

    for (const platform of supportedPlatforms) {
      if (minecraftVersion.includes(platform)) {
        supportedMcVersions.add(platform);
        continue;
      }

      throw new Error(`[Modrinth File ${sourceFileMeta.id}] Unknown Platform: ${platform}`);
    }

    const mods: ModVersion[] = await getModVersionsFromJar(file.url, supportedMcVersions);
    if (mods.length === 0) {
      throw new Error('No mod found in jar');
    }

    const modJar = ModJar.build({
      externalId: generateId(),
      projectId: project.internalId,
      fileName: file.filename,
      sourceFileId: String(sourceFileMeta.id),
      downloadUrl: file.url,
      releaseType: getModrinthReleaseType(sourceFileMeta.version_type),
      releaseDate: sourceFileMeta.date_published,
    });

    await this.sequelize.transaction(async transaction => {
      await modJar.save({ transaction });
      await Promise.all(mods.map(async mod => {
        mod.jarId = modJar.internalId;

        return mod.save({ transaction });
      }));
    });
  }
}
