import { readFile, mkdir, rm, stat, readdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

async function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true, ...opts });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch (e) {
    if (e && e.code === 'ENOENT') return false;
    throw e;
  }
}

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function copyDir(src, dest) {
  await ensureDir(dest);
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else if (entry.isFile()) {
      await copyFile(from, to);
    }
  }
}

function sanitizeName(name) {
  return String(name || 'extension')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function psSingleQuoted(s) {
  return `'${String(s).replaceAll("'", "''")}'`;
}

async function main() {
  const manifestPath = path.join(repoRoot, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const version = manifest.version || '0.0.0';
  const baseName = sanitizeName(manifest.name || 'extension');

  const releaseDir = path.join(repoRoot, 'release');
  const stageDir = path.join(releaseDir, 'stage');
  const zipName = `${baseName}-${version}.zip`;
  const zipPath = path.join(releaseDir, zipName);

  // 1) Build bundles
  await run('npm', ['run', 'build'], { cwd: repoRoot });

  // 2) Prepare staging directory
  await rm(stageDir, { recursive: true, force: true });
  await ensureDir(stageDir);

  // 3) Copy required files into stage
  // manifest + background
  await copyFile(path.join(repoRoot, 'manifest.json'), path.join(stageDir, 'manifest.json'));
  await copyFile(path.join(repoRoot, 'service_worker.js'), path.join(stageDir, 'service_worker.js'));

  // assets
  if (await pathExists(path.join(repoRoot, 'assets'))) {
    await copyDir(path.join(repoRoot, 'assets'), path.join(stageDir, 'assets'));
  }

  // common (used by service_worker as ESM imports)
  if (await pathExists(path.join(repoRoot, 'common'))) {
    await copyDir(path.join(repoRoot, 'common'), path.join(stageDir, 'common'));
  }

  // content/dist (content script bundle target from manifest)
  await ensureDir(path.join(stageDir, 'content'));
  if (await pathExists(path.join(repoRoot, 'content', 'dist'))) {
    await copyDir(path.join(repoRoot, 'content', 'dist'), path.join(stageDir, 'content', 'dist'));
  } else {
    throw new Error('Missing content/dist build output. Build step may have failed.');
  }

  // sidepanel: html + dist assets
  await ensureDir(path.join(stageDir, 'sidepanel'));
  await copyFile(
    path.join(repoRoot, 'sidepanel', 'sidepanel.html'),
    path.join(stageDir, 'sidepanel', 'sidepanel.html'),
  );
  if (await pathExists(path.join(repoRoot, 'sidepanel', 'dist'))) {
    await copyDir(path.join(repoRoot, 'sidepanel', 'dist'), path.join(stageDir, 'sidepanel', 'dist'));
  } else {
    throw new Error('Missing sidepanel/dist build output. Build step may have failed.');
  }

  // 4) Create zip archive under release/
  await ensureDir(releaseDir);

  if (process.platform === 'win32') {
    const psCmd = `Compress-Archive -Force -Path ${psSingleQuoted(path.join(stageDir, '*'))} -DestinationPath ${psSingleQuoted(zipPath)}`;
    await run('powershell.exe', ['-NoProfile', '-Command', psCmd], { cwd: repoRoot });
  } else {
    // Use zip CLI if available (most *nix systems)
    await run('zip', ['-r', zipPath, '.'], { cwd: stageDir });
  }

  // 5) Clean staging
  await rm(stageDir, { recursive: true, force: true });

  console.log(`\nPacked Chrome extension: ${zipPath}`);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});

