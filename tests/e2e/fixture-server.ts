/**
 * Serves tests/e2e/pages on :3211 for the Playwright suite. Pages load each other through
 * both `localhost` and `127.0.0.1`, which the browser treats as different origins, to get
 * cross-origin iframes from a single server. Supports Range requests like a real media host.
 */
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const PORT = 3211;
const ROOT = join(import.meta.dirname, 'pages');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webm': 'video/webm',
};

createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  const file = normalize(join(ROOT, pathname));
  let size: number;
  try {
    if (!file.startsWith(ROOT)) throw new Error('outside root');
    const stat = statSync(file);
    if (!stat.isFile()) throw new Error('not a file');
    size = stat.size;
  } catch {
    res.writeHead(404).end('not found');
    return;
  }

  const headers = {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'accept-ranges': 'bytes',
    'cache-control': 'no-store',
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
    createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, 'content-length': size });
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`fixture server on http://localhost:${PORT}`));
