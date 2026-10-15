import {createApi} from './api.mjs';
import {D1RoomStore} from './store.mjs';
import {assets} from './assets.mjs';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
      if (!env.DB) return Response.json({error: 'O serviço de salas está temporariamente indisponível.'}, {status: 503});
      return createApi(new D1RoomStore(env.DB))(request);
    }
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, {status: 405});
    const asset = assets[url.pathname === '/' ? '/index.html' : url.pathname];
    if (!asset) return new Response('Arquivo não encontrado.', {status: 404});
    const [type, data, binary] = asset;
    const body = request.method === 'HEAD' ? null : binary ? Uint8Array.from(atob(data), c => c.charCodeAt(0)) : data;
    return new Response(body, {headers: {'Content-Type': type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin'}});
  }
};
