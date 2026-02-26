import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HOST = '127.0.0.1';
const DEFAULT_PORT = 4173;
const DEFAULT_DOC_PATH = '/kintai-schedule-mock.html';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = path.resolve(SCRIPT_DIR, '..', '..', 'docs');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

const decodePath = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const resolveFilePath = (requestPathname) => {
  const normalizedPath = decodePath(requestPathname || '/').replace(/\\/g, '/');
  const targetPath = normalizedPath === '/' ? DEFAULT_DOC_PATH : normalizedPath;
  const filePath = path.resolve(DOCS_ROOT, `.${targetPath}`);
  if (!filePath.startsWith(DOCS_ROOT)) {
    return null;
  }
  return filePath;
};

const openUrlInBrowser = (url) => {
  const spawnOptions = { stdio: 'ignore', detached: true };
  try {
    if (process.platform === 'win32') {
      const child = spawn('cmd.exe', ['/d', '/s', '/c', 'start', '""', url], spawnOptions);
      child.unref();
      return true;
    }
    if (process.platform === 'darwin') {
      const child = spawn('open', [url], spawnOptions);
      child.unref();
      return true;
    }
    const child = spawn('xdg-open', [url], spawnOptions);
    child.unref();
    return true;
  } catch (error) {
    console.warn('[dev] failed to auto-open browser', error);
    return false;
  }
};

const createDocsServer = async (startPort = DEFAULT_PORT) => {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${HOST}:${startPort}`);
    const filePath = resolveFilePath(url.pathname);
    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const body = await fs.readFile(filePath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  });

  const listen = (port) =>
    new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, HOST, () => {
        server.off('error', reject);
        resolve(port);
      });
    });

  let port = startPort;
  while (port < startPort + 50) {
    try {
      await listen(port);
      return { server, port };
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
        port += 1;
        continue;
      }
      throw error;
    }
  }
  throw new Error(`No available port found for docs server (start=${startPort}).`);
};

const main = async () => {
  const { server, port } = await createDocsServer(DEFAULT_PORT);
  console.log(`[docs] serving ${DOCS_ROOT}`);
  console.log(`[docs] http://${HOST}:${port}${DEFAULT_DOC_PATH} (default)`);
  console.log(`[docs] http://${HOST}:${port}/datasource-form-a.html`);
  console.log(`[docs] http://${HOST}:${port}/datasource-form-b.html`);

  const defaultDocsUrl = `http://${HOST}:${port}${DEFAULT_DOC_PATH}`;
  openUrlInBrowser(defaultDocsUrl);

  const wxtCwd = path.resolve(SCRIPT_DIR, '..');
  const wxtProcess =
    process.platform === 'win32'
      ? spawn('cmd.exe', ['/d', '/s', '/c', 'npm run dev:wxt'], {
          cwd: wxtCwd,
          stdio: 'inherit',
        })
      : spawn('npm', ['run', 'dev:wxt'], {
          cwd: wxtCwd,
          stdio: 'inherit',
        });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`[dev] shutting down (${signal})...`);
    server.close();
    if (!wxtProcess.killed) {
      wxtProcess.kill('SIGTERM');
    }
    setTimeout(() => process.exit(0), 200);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  wxtProcess.on('exit', (code) => {
    server.close();
    process.exit(code ?? 0);
  });
  wxtProcess.on('error', (error) => {
    console.error('[dev] failed to spawn WXT process', error);
    server.close();
    process.exit(1);
  });
};

main().catch((error) => {
  console.error('[dev] failed to start', error);
  process.exit(1);
});
