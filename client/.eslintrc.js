module.exports = {
  extends: [
    '@foobarhq/eslint-config',
    '@foobarhq/eslint-config/browser',
    '@foobarhq/eslint-config/jest',
    '@foobarhq/eslint-config-typescript',
  ],
  rules: {
    'babel/new-cap': 'off',
    'no-use-before-define': 'off',
    'no-console': 'error',
  },
};

