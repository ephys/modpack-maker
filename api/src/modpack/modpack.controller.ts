import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { ModpackService } from './modpack.service';

@Controller()
export class ModpackController {
  constructor(
    private modpackService: ModpackService,
  ) {}

  @Get('/modpacks/:modpackId/download')
  async getJar(
    @Param('modpackId') modpackId: string,
    @Res() res: Response
  ): Promise<void> {
    const modpack = await this.modpackService.getModpackByEid(modpackId);
    if (!modpack) {
      res.status(404).send();
      return;
    }

    // TODO: cancel request on req.on('close') using AbortController
    const stream = await this.modpackService.downloadModpackToFileStream(modpack);

    if (!stream) {
      res.status(404).send();
    }

    // TODO: slugify modpack name
    res.header('Content-Disposition', `attachment; filename="modpack.zip"`);
    stream.pipe(res);
  }
}
