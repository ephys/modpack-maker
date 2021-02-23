import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import fetch from 'node-fetch';
import cheerio from 'cheerio';

@Processor('mod-discovery-url')
export class ModDiscoveryProcessor {
  @Process()
  async discoveryModFromUrl(job: Job<string>) {
    try {
      const url = job.data;

      let theHandler;
      for (const handler of handlers) {
        if (handler.test.test(url)) {
          theHandler = handler;
          break;
        }
      }

      if (!theHandler) {
        console.error('No handler for URL ' + url);
        // TODO
        return false;
      }

      const result = await theHandler.handle(url);

      console.log(result);
    } catch (e) {
      // TODO
      console.error('URL processing failed', job.data);
      console.error(e);

      throw e;
    }
  }
}

const handlers = [{
  test: /^https?:\/\/www.curseforge.com\/minecraft\/mc-mods\/[^\/]+$/,
  async handle(url) {
    console.log('handling curseforge URL', url);

    const result = await fetch(url);

    if (!result.ok) {
      throw new Error('Page is not OK, got status ' + result.status + ' - ' + result.statusText);
    }

    const $ = cheerio.load(await result.text());

    const projectIdSpan = $('span').filter(function (i, el) {
      return $(this).text().toLowerCase() === 'project id';
    });

    console.log(projectIdSpan);
  },
}];
