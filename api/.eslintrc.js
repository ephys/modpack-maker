// eslint-disable-next-line import/no-commonjs
module.exports = {
  extends: [
    '@foobarhq/eslint-config',
    '@foobarhq/eslint-config/jest',
    '@foobarhq/eslint-config-typescript',
  ],
  rules: {
    'babel/new-cap': 'off',
    'no-use-before-define': 'off',
    '@typescript-eslint/consistent-type-imports': 'off',
  },
  env: {
    node: true,
  },
};

