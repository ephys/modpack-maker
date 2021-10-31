import { dirname } from 'path';
import { fileURLToPath } from 'url';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import rollupTypescript from '@rollup/plugin-typescript';
import external from '@yelo/rollup-node-external';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  input: 'src/main.ts',
  output: {
    dir: 'dist',
    format: 'es',
  },
  preserveModules: true,
  external: external(),
  plugins: [
    nodeResolve(),
    // autoExternal({
    //   packagePath: path.resolve('./package.json'),
    // }),
    commonjs({
      defaultIsModuleExports: true,
    }),
    json({
      namedExports: false,
    }),
    rollupTypescript({
      filterRoot: false,
      tsconfig: `${__dirname}/tsconfig.json`,
    }),
  ],
};
