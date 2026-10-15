import http from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {networkInterfaces} from 'node:os';
import {createApi} from './multiplayer/api.mjs';
import {localStore} from './multiplayer/local-store.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
export async function createServer({database = path.join(root, '.runtime/multiplayer.sqlite'), options} = {}) {
  if (database !== ':memory:') await mkdir(path.dirname(database), {recursive: true});
  const storage = localStore(database), api = createApi(storage.store, options);
  const base = path.join(root, 'dist');
  const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png'};
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
        const chunks = []; let length = 0;
        for await (const chunk of req) {length += chunk.length; if (length > 4096) {res.writeHead(413); res.end(); return;} chunks.push(chunk);}
        const request = new Request(url, {method: req.method, headers: req.headers,
          body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks)});
        const response = await api(request);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer())); return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) {res.writeHead(405); res.end(); return;}
      const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
      if (!/^(?:[\w-]+\.(?:html|js|css)|assets\/[\w.-]+\.png)$/.test(rel) || ['balance.html'].includes(rel)) {res.writeHead(404); res.end(); return;}
      const file = path.resolve(base, rel);
      if (!file.startsWith(base + path.sep)) {res.writeHead(403); res.end(); return;}
      const body = await readFile(file);
      res.writeHead(200, {'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff'});
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) {console.error(error.message); if (!res.headersSent) res.writeHead(error.code === 'ENOENT' ? 404 : 500); res.end('Não foi possível atender esta solicitação.');}
  });
  server.on('close', storage.close);
  return server;
}
export async function startServer() {
  const port = Number(process.env.PORT || 43818), host = process.env.HOST || '0.0.0.0';
  const server = await createServer();
  server.on('error', error => {console.error(error.code === 'EADDRINUSE' ? `A porta ${port} já está em uso.` : error.message); process.exitCode = 1;});
  server.listen(port, host, () => {
    console.log(`Mecha Arena\nLocal: http://127.0.0.1:${port}`);
    for (const info of Object.values(networkInterfaces()).flat()) if (info.family === 'IPv4' && !info.internal) console.log(`Mesma rede: http://${info.address}:${port}`);
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await startServer();
