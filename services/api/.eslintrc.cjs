module.exports = {
  extends: [
    '@ephys/eslint-config-typescript',
    '@ephys/eslint-config-typescript/jest',
  ],
  rules: {
    // eslint breaks with "rule not found"
    'unicorn/no-unreadable-iife': 'off',
    // broken
    'import/no-extraneous-dependencies': 'off',
  },
  env: {
    node: true,
  },
  parserOptions: {
    requireConfigFile: false,
  },
};

