import { mavenVersionRangeToSemver, splitMavenRange } from './version-range';

describe('mavenVersionRangeToSemver', () => {
  it('Converts forge version ranges to equivalent semver version range notations', () => {
    const tests = {
      '1.0': '1.0',
      '[1.0,2.0)': '>=1.0 <2.0',
      '[1.0,2.0]': '>=1.0 <=2.0',
      '[1.5,)': '>=1.5',
      '(,1.0],[1.2,)': '<=1.0 || >=1.2',
      '[1.14.4]': '1.14.4',
    };

    for (const [input, output] of Object.entries(tests)) {
      expect(`${input} -> ${mavenVersionRangeToSemver(input)}`).toEqual(`${input} -> ${output}`);
    }
  });
});

describe('splitMavenRange', () => {
  it('splits a maven range into individual sets', () => {
    const tests = {
      '1.0': ['1.0'],
      '[1.0,2.0)': ['[1.0,2.0)'],
      '[1.0,2.0]': ['[1.0,2.0]'],
      '(,1.0],[1.2,)': ['(,1.0]', '[1.2,)'],
      '1.0,2.0,3.0,4.0': ['1.0', '2.0', '3.0', '4.0'],
      '(,1.0],[1.2,),4.0,[1.2,),[1.2,)': ['(,1.0]', '[1.2,)', '4.0', '[1.2,)', '[1.2,)'],
    };

    for (const [input, output] of Object.entries(tests)) {
      expect(splitMavenRange(input)).toEqual(output);
    }
  });
});
