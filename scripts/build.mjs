import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuildBuild } from 'esbuild';
import { build as viteBuild } from 'vite';

// esbuild を使ってサイドパネルのバンドルを生成するビルドスクリプト。

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const target = process.argv[2];
const validTargets = new Set(['sidepanel', 'extension']);

if (!validTargets.has(target)) {
  // 想定外のターゲットが指定された場合はエラー終了。
  console.error(`Unknown build target "${target}". Expected one of: ${[...validTargets].join(', ')}`);
  process.exit(1);
}

const nodeEnv = JSON.stringify(process.env.NODE_ENV || 'production');

if (target === 'sidepanel') {
  const entryPoint = path.resolve(__dirname, `../${target}/src/main.jsx`);
  const outDir = path.resolve(__dirname, `../${target}/dist`);
  const outfile = path.join(outDir, 'index.js');

  await mkdir(outDir, { recursive: true });

  // esbuild の設定。React JSX をバンドルし、MV3 向けに最適化する。
  await esbuildBuild({
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    format: 'esm',
    sourcemap: false,
    minify: true,
    target: 'chrome117',
    define: {
      'process.env.NODE_ENV': nodeEnv,
    },
    loader: {
      '.js': 'jsx',
      '.jsx': 'jsx',
    },
  });
} else if (target === 'extension') {
  const outDir = path.resolve(__dirname, '../dist');
  await mkdir(outDir, { recursive: true });

  // Vite を利用してサービスワーカーを MV3 対応の ES Module としてバンドルする。
  await viteBuild({
    define: {
      'process.env.NODE_ENV': nodeEnv,
    },
    build: {
      outDir,
      emptyOutDir: false,
      sourcemap: false,
      minify: 'esbuild',
      target: 'chrome117',
      modulePreload: false,
      lib: {
        entry: path.resolve(__dirname, '../service_worker.js'),
        formats: ['es'],
        fileName: () => 'service_worker.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });

  // Vite のライブラリモードでコンテンツスクリプトを IIFE 形式にまとめる。
  await viteBuild({
    define: {
      'process.env.NODE_ENV': nodeEnv,
    },
    build: {
      outDir,
      emptyOutDir: false,
      sourcemap: false,
      minify: 'esbuild',
      target: 'chrome117',
      modulePreload: false,
      lib: {
        entry: path.resolve(__dirname, '../content/content.js'),
        name: 'PageAugmentorContent',
        formats: ['iife'],
        fileName: () => 'content.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });
}
