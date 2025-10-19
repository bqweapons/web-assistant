import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const target = process.argv[2];
const validTargets = new Set(['sidepanel']);

if (!validTargets.has(target)) {
  console.error(`Unknown build target "${target}". Expected one of: ${[...validTargets].join(', ')}`);
  process.exit(1);
}

const entryPoint = path.resolve(__dirname, `../${target}/src/main.jsx`);
const outDir = path.resolve(__dirname, `../${target}/dist`);
const outfile = path.join(outDir, 'index.js');

await mkdir(outDir, { recursive: true });

await build({
  entryPoints: [entryPoint],
  outfile,
  bundle: true,
  format: 'esm',
  sourcemap: false,
  minify: true,
  target: 'chrome117',
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  loader: {
    '.js': 'jsx',
    '.jsx': 'jsx',
  },
});
