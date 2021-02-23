module.exports = {
  webpack: (config) => {
    config.module.rules.push({
      test(arg) {
        return arg.endsWith('/common/modloaders.ts');
      },
      loader: 'babel-loader',
      options: {
        presets: ['@babel/preset-typescript'],
      }
    });

    return config;
  },
};
