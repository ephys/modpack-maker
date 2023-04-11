export default {
  presets: [
    ['@babel/preset-env', {
      modules: false,
      targets: {
        node: '16.13',
      },
    }],
  ],
  plugins: [
    ['@babel/plugin-proposal-decorators', {
      legacy: true,
    }],
  ],
  overrides: [{
    test: [
      'src/**/*.ts',
      '../common/**/*.ts',
    ],
    presets: [
      '@babel/preset-typescript',
    ],
  }],
};
