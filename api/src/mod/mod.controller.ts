import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { ModDiscoveryService } from './mod-discovery.service';
import { ModService } from './mod.service';

@Controller()
export class ModController {
  constructor(
    private modDiscoveryService: ModDiscoveryService,
    private modService: ModService,
  ) {}

  @Get('/curseforge/retry-crawl')
  async retryCrawl(): Promise<object> {
    await this.modDiscoveryService.retryFailedFiles();

    return { status: 200 };
  }

  @Get('/jars/:jarId/download')
  async getJar(
    @Param('jarId') jarId: string,
    @Res() res: Response
  ): Promise<void> {
    const jar = await this.modService.getJar(jarId);
    if (!jar) {
      res.status(404).send();
      return;
    }

    const stream = await this.modService.downloadJarToFileStream(jar);

    if (!stream) {
      res.status(404).send();
    }

    res.header('Content-Disposition', `attachment; filename="${jar.fileName}"`);
    stream.pipe(res);
  }
}
