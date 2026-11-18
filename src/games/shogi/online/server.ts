import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { roomMiddleware } from './http';

const origins = new Set((process.env.ROOMS_ORIGINS ?? '').split(',').map(origin => origin.trim()).filter(Boolean));
const rooms = roomMiddleware(origin => origin === 'null' || origins.has(origin));
const host = process.env.ROOMS_HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8787);
const downloadPath = process.env.ROOMS_DOWNLOAD_HTML;
const download = downloadPath ? readFileSync(downloadPath) : null;

createServer({ requestTimeout: 10_000, headersTimeout: 8_000 }, (req, res) => {
  void rooms(req, res, () => {
    if (download && req.url === '/desk.html' && (req.method === 'GET' || req.method === 'HEAD')) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'attachment; filename="desk.html"',
        'Content-Length': download.length,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(download);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });
}).listen(port, host, () => console.log(`Room server listening on ${host}:${port}`));
