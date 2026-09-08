import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

const tsPlugin = typescript({
  tsconfig: './tsconfig.json',
  declaration: false,
  declarationMap: false,
});

export default [
  {
    input: 'src/iife-entry.ts',
    output: {
      file: 'dist/watchbug.js',
      format: 'iife',
      name: 'Watchbug',
      exports: 'default',
      sourcemap: false,
      plugins: [terser()],
    },
    external: [],
    plugins: [typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      declarationMap: false,
    })],
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/watchbug.esm.js',
      format: 'es',
      sourcemap: false,
    },
    external: [],
    plugins: [typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      declarationMap: false,
    })],
  },
];
