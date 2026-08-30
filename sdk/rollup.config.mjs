import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/watchbug.js',
      format: 'iife',
      name: 'Watchbug',
      sourcemap: false,
      plugins: [terser()],
    },
    {
      file: 'dist/watchbug.esm.js',
      format: 'es',
      sourcemap: false,
    },
  ],
  external: [],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      declarationMap: false,
    }),
  ],
};
