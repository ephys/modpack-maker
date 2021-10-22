module.exports = {
  extends: [
    '@foobarhq/eslint-config',
    '@foobarhq/eslint-config/jest',
    '@foobarhq/eslint-config-typescript',
  ],
  rules: {
    'babel/new-cap': 'off',
    'no-use-before-define': 'off',
    'no-console': 'error',
    'valid-jsdoc': 'off',
  },
  env: {
    node: true,
  },
  parserOptions: {
    requireConfigFile: false,
  },
};

