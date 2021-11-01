module.exports = {
  extends: [
    '@foobarhq/eslint-config',
    '@foobarhq/eslint-config/browser',
    '@foobarhq/eslint-config/jest',
    '@foobarhq/eslint-config-typescript',
  ],
  plugins: ['small-import'],
  rules: {
    'babel/new-cap': 'off',
    'no-use-before-define': 'off',
    'no-console': 'error',
    'small-import/no-full-import': ['error', {
      packages: {
        lodash: '/',
        'date-fns': '/',
        rambda: '/src/',
        '@mui/material': '/',
        '@mui/icons-material': '/',
      },
    }],
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

