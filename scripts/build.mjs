import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// esbuild を使ってターゲットごとにバンドルを生成するビルドスクリプト、E

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const target = process.argv[2];

/** @type {Record<string, import('esbuild').BuildOptions>} */
const targetConfigs = {
  sidepanel: {
    entryPoints: [path.resolve(__dirname, '../sidepanel/src/main.jsx')],
    outfile: path.resolve(__dirname, '../sidepanel/dist/index.js'),
    format: 'esm',
    loader: {
      '.js': 'jsx',
      '.jsx': 'jsx',
    },
  },
  content: {
    entryPoints: [path.resolve(__dirname, '../content/app/content.js')],
    outfile: path.resolve(__dirname, '../content/dist/content.js'),
    format: 'iife',
  },
};

const config = targetConfigs[target];

if (!config) {
  // 想定外のターゲットが指定された場合はエラー終了
  console.error(`Unknown build target "${target}". Expected one of: ${Object.keys(targetConfigs).join(', ')}`);
  process.exit(1);
}

await mkdir(path.dirname(config.outfile), { recursive: true });

// esbuild の共通設定。MV3 向けに最適化しつつ、必要なモジュールをバンドルする、E
await build({
  bundle: true,
  sourcemap: false,
  minify: true,
  platform: 'browser',
  target: 'chrome117',
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  ...config,
});
