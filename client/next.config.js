// eslint-disable-next-line import/no-commonjs
module.exports = {
  webpack: config => {
    config.module.rules.push({
      test(arg) {
        return /\/common\/.*\.ts/.test(arg);
      },
      loader: 'babel-loader',
      options: {
        presets: ['@babel/preset-typescript'],
      },
    });

    return config;
  },
};
