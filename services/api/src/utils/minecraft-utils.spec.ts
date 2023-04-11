import { getMinecraftVersionsInRange } from './minecraft-utils.js';

describe('getMinecraftVersionsInRange', () => {
  it('returns all minecraft versions matching a semver range', () => {
    const tests = {
      '1.16.4': ['1.16.4'],
      '>=1.16.4': ['1.17', '1.16.5', '1.16.4'],
      '>=1.15 <1.16': ['1.15.2', '1.15.1', '1.15'],
    };

    for (const [input, output] of Object.entries(tests)) {
      try {
        expect(getMinecraftVersionsInRange(input)).toEqual(output);
      } catch (error) {
        console.error('input', input, 'failed');
        throw error;
      }
    }
  });
});
