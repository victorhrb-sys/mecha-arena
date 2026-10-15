import {createRoomService, RoomError} from './rooms.mjs';
import {createProfileService,profileName} from './profiles.mjs';

export function createApi(store, options) {
  const rooms = createRoomService(store, options);
  const profiles=createProfileService(store,options);
  return async request => {
    const url = new URL(request.url);
    const headers = {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'};
    const respond = (body, status = 200) => new Response(JSON.stringify(body), {status, headers});
    try {
      if (url.pathname === '/health') return respond({app: 'mecha-arena-multiplayer'});
      if (!['GET', 'POST'].includes(request.method)) return respond({error: 'Método não permitido.'}, 405);
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) throw new RoomError('Origem não permitida.', 403);
      const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
      let body = {};
      if (request.method === 'POST') {
        if (!request.headers.get('content-type')?.startsWith('application/json')) throw new RoomError('Envie uma ação JSON.', 415);
        const text = await request.text();
        if (text.length > 4096) throw new RoomError('Comando muito grande.', 413);
        try {body = JSON.parse(text);} catch {throw new RoomError('Comando JSON inválido.');}
        if (!body || Array.isArray(body) || typeof body !== 'object') throw new RoomError('Comando inválido.');
      }
      if(url.pathname==='/api/profiles') {
        let name;try{name=profileName(request.method==='POST'?body.name:url.searchParams.get('name'));}catch(error){throw new RoomError(error.message);}
        const profile=request.method==='POST'?await profiles.open(name):await profiles.get(name);
        if(!profile)throw new RoomError('Perfil não encontrado. Escolha esse nome para começar.',404);
        return respond(profile);
      }
      if (url.pathname === '/api/rooms' && request.method === 'POST') return respond(await rooms.create(body.code, body.name, token), 201);
      const match = url.pathname.match(/^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})(?:\/(join|commands))?$/);
      if (!match) return respond({error: 'Endereço de sala inválido.'}, 404);
      const [, code, route] = match;
      if (!route && request.method === 'GET') return respond(await rooms.get(code, token));
      if (route === 'join' && request.method === 'POST') return respond(await rooms.join(code, body.name, token));
      if (route === 'commands' && request.method === 'POST') return respond(await rooms.command(code, token, body));
      return respond({error: 'Método não permitido.'}, 405);
    } catch (error) {
      if (error instanceof RoomError) return respond({error: error.message}, error.status);
      console.error('Room storage failure:', error.message);
      return respond({error: 'Não foi possível acessar a sala. Tente novamente; sua partida permanece salva.'}, 503);
    }
  };
}
