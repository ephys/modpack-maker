
import { Controller, Get } from '@nestjs/common';
import { ModDiscoveryService } from './mod-discovery.service';

@Controller('/curseforge')
export class CurseforgeFileCrawlerController {
  constructor(private modDiscoveryService: ModDiscoveryService) {}

  @Get('/retry-crawl')
  async retryCrawl(): Promise<object> {
    await this.modDiscoveryService.retryFailedFiles();

    return { status: 200 };
  }
}
