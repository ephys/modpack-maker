import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileUrlToDirname } from '@ephys/fox-forge/node';
import groupBy from 'lodash/groupBy.js';
import { getModMetasFromJar } from './mod-data-extractor.js';

const __dirname = fileUrlToDirname(import.meta.url);
const dir = path.join(__dirname, '__test-mods__');

describe('getModMetaFromJar', () => {
  // eslint-disable-next-line jest/expect-expect
  it('extracts the proper meta from a mod jar', async () => {
    const testFiles = await fs.readdir(dir);
    const groups = groupBy(testFiles, file => {
      return path.parse(file).name;
    });

    const promises: Array<Promise<void>> = [];
    for (const group of Object.values(groups)) {
      if (group.length !== 2) {
        throw new Error(`Test file is missing its counterpart ${group[0]}`);
      }

      promises.push(runTest(group));
    }

    await Promise.all(promises);
  });
});

async function runTest(group) {
  const [expectedOutputFile, jarFile] = path.extname(group[0]) === '.json' ? group : [group[1], group[0]];

  const jar: Buffer = await fs.readFile(path.join(dir, jarFile));
  // @ts-expect-error -- JSON.parse accepts buffers in Node.
  const expectedOutput = JSON.parse(await fs.readFile(path.join(dir, expectedOutputFile)));

  const output = await getModMetasFromJar(jar);

  expect(output).toEqual(expectedOutput);
}
