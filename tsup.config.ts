import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: { index: 'src/index.ts', react: 'src/react.tsx' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2020',
    external: ['react'] // peer dependency — never bundled
  },
  {
    // Browser global for <script> usage: window.BdxWeb3
    entry: { 'bdx-web3': 'src/index.ts' },
    format: ['iife'],
    globalName: 'BdxWeb3',
    sourcemap: true,
    minify: true,
    target: 'es2020'
  }
])
