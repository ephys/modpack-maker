import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { ModpackVersionDownloaderService } from './modpack-version-downloader.service.js';
import { ModpackVersionService } from './modpack-version.service.js';

@Controller()
export class ModpackVersionDownloaderController {
  constructor(
    private readonly modpackVersionService: ModpackVersionService,
    private readonly modpackVersionDownloaderService: ModpackVersionDownloaderService,
  ) {}

  @Get('/modpacks/:modpackId/download')
  async getJar(
    @Param('modpackId') modpackId: string,
    @Res() res: Response,
  ): Promise<void> {
    const modpack = await this.modpackVersionService.getModpackVersionByEid(modpackId);
    if (!modpack) {
      res.status(404).send();

      return;
    }

    // TODO: cancel request on req.on('close') using AbortController
    const stream = await this.modpackVersionDownloaderService.downloadModpackToFileStream(modpack);

    if (!stream) {
      res.status(404).send();
    }

    // TODO: slugify modpack name
    res.header('Content-Disposition', `attachment; filename="modpack.zip"`);
    stream.pipe(res);
  }
}
