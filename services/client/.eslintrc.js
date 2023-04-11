module.exports = {
  extends: [
    '@ephys/eslint-config-typescript',
    '@ephys/eslint-config-typescript/browser',
    '@ephys/eslint-config-typescript/jest',
  ],
  rules: {
    'no-use-before-define': 'off',
  },
  overrides: [{
    files: ['src/api/graphql.generated.ts'],
    rules: {
      camelcase: 'off',
      'max-len': 'off',
      '@typescript-eslint/no-duplicate-imports': 'off',
      'valid-jsdoc': 'off',
    },
  }, {
    files: ['**/*.{ts,tsx}'],
    parserOptions: {
      project: './tsconfig.json',
    },
    rules: {
      'import/no-unresolved': 'off',
    },
  }],
};

