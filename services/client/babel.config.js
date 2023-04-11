'use strict';

module.exports = {
  presets: [
    ['@reworkjs/core/babel-preset', {
      '@babel/preset-env': {
        modules: false,
      },
    }],
  ],
  plugins: [
    'macros',
    '@babel/plugin-syntax-import-assertions',
  ],
  overrides: [{
    test: [
      '**/*.ts',
      '**/*.tsx',
      '../common/**/*.ts',
    ],
    presets: [
      '@babel/preset-typescript',
    ],
  }],
  env: {
    production: {
      plugins: ['transform-compress-graphql'],
    },
  },
};
