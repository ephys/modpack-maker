import * as fs from 'fs/promises';
import * as path from 'path';
import { groupBy } from 'lodash';
import { getModMetasFromJar } from './mod-data-extractor';

describe('getModMetaFromJar', () => {
  it('extracts the proper meta from a mod jar', async () => {
    const dir = path.join(__dirname, '__test-mods__');
    const testFiles = await fs.readdir(dir);
    const groups = groupBy(testFiles, file => {
      return path.parse(file).name;
    });

    for (const group of Object.values(groups)) {
      if (group.length !== 2) {
        throw new Error('Test file is missing its counterpart ' + group[0]);
      }

      const [expectedOutputFile, jarFile] = path.extname(group[0]) === '.json' ? group : [group[1], group[0]];

      const jar: Buffer = await fs.readFile(path.join(dir, jarFile));
      const expectedOutput = JSON.parse(await fs.readFile(path.join(dir, expectedOutputFile), 'utf8'))

      const output = await getModMetasFromJar(jar);

      expect(output).toEqual(expectedOutput);
    }
  });
});
