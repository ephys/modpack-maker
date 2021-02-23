import { Injectable } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
class ModDiscoveryService {
  constructor(@InjectQueue('mod-discovery-url') private modDiscoveryQueue: Queue) {}

  async discoverUrls(urls: string[]) {
    await this.modDiscoveryQueue.addBulk(urls.map(url => ({ data: url })));
  }
}

export { ModDiscoveryService }
