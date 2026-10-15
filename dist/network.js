export const SESSION_KEY = 'mecha-arena.multiplayer.sessions.v1';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomHex = length => [...crypto.getRandomValues(new Uint8Array(length))].map(n => n.toString(16).padStart(2, '0')).join('');
export const newRoomCode = () => [...crypto.getRandomValues(new Uint8Array(6))].map(n => CODE_ALPHABET[n % 32]).join('');

export function createRoomClient({onUpdate, onStatus, storage = localStorage, fetcher = fetch, interval = 1200}) {
  let saved = {current: null, sessions: {}}, room = null, timer = null, busy = false, stopped = false, connected = false;
  try {const data = JSON.parse(storage.getItem(SESSION_KEY)); if (data?.sessions && typeof data.sessions === 'object') saved = data;} catch {}
  const persist = () => {try {storage.setItem(SESSION_KEY, JSON.stringify(saved));} catch {onStatus('Este navegador não conseguiu guardar sua sessão. Mantenha esta aba aberta.', false);}};
  const status = (message, online) => {if (online !== connected || message) {connected = online; onStatus(message, online);}};
  function update(value) {
    if (stopped) return;
    if (value.code !== saved.current) return;
    if (room?.code === value.code && value.revision <= room.revision) return;
    room = value; onUpdate(value);
  }
  async function request(path, body, session = saved.sessions[saved.current]) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetcher(path, {method: body === undefined ? 'GET' : 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`},
        body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal, cache: 'no-store'});
      const data = await response.json();
      if (!response.ok) {const error = new Error(data.error || 'Não foi possível acessar a sala.'); error.status = response.status; throw error;}
      status('', true); return data;
    } catch (error) {
      if (!error.status) status('Conexão interrompida. Tentando reconectar…', false);
      throw error;
    } finally {clearTimeout(timeout);}
  }
  function schedule() {clearTimeout(timer); if (!stopped && saved.current) timer = setTimeout(poll, interval);}
  async function poll() {
    if (stopped) return;
    try {if (!busy && saved.sessions[saved.current] && !saved.sessions[saved.current].pending) update(await request(`/api/rooms/${saved.current}`));}
    catch (error) {if ([401, 404].includes(error.status)) {stopped = true; status(error.message, false);}}
    finally {schedule();}
  }
  async function enter(mode, code, name) {
    if (busy) return;
    const target = String(code).trim().toUpperCase();
    const old = saved.sessions[target];
    const key=value=>value.normalize('NFKC').trim().replace(/\s+/gu,' ').toLowerCase();
    if(old&&key(old.name)!==key(name)){
      const error=new Error(`Este navegador já tem uma vaga nesta sala como ${old.name}. Volte a esse usuário para retomá-la.`);error.status=409;throw error;
    }
    const session = old ?? {token: randomHex(32), name, pending: mode};
    if (session.pending) session.name = name;
    saved.sessions[target] = session; saved.current = target; room = null; persist();
    busy = true; stopped = false;
    try {
      const route = session.pending === 'create' ? '/api/rooms' : `/api/rooms/${target}/join`;
      const data = await request(route, {code: target, name: session.name}, session);
      delete session.pending;session.name=data.members[data.playerId].name; persist(); update(data); return data;
    } catch (error) {status(error.status ? error.message : 'Não foi possível entrar agora. Use Retomar sala para tentar novamente.', false); throw error;}
    finally {busy = false; schedule();}
  }
  return {
    get session() {const session = saved.sessions[saved.current]; return session ? {code: saved.current, name: session.name} : null;},
    get busy() {return busy;},
    get connected() {return connected;},
    create(name) {return enter('create', newRoomCode(), name);},
    join(code, name) {return enter('join', code, name);},
    async resume() {
      const session = saved.sessions[saved.current];
      if (!session || busy) return;
      if (session.pending) return enter(session.pending, saved.current, session.name);
      stopped = false; room = null;
      try {const value = await request(`/api/rooms/${saved.current}`); update(value); return value;}
      catch (error) {status(error.status ? error.message : 'Conexão interrompida. Tentando reconectar…', false); throw error;}
      finally {schedule();}
    },
    async command(action) {
      if (busy || !room) return;
      busy = true;
      const body = {action, commandId: randomHex(16), revision: room.revision,preparation:room.preparation};
      try {
        let value;
        try {value = await request(`/api/rooms/${saved.current}/commands`, body);}
        catch (error) {if (error.status) throw error; value = await request(`/api/rooms/${saved.current}/commands`, body);}
        if (!value.left) update(value);
        else {delete saved.sessions[saved.current]; saved.current = null; room = null; persist(); stopped = true;}
        return value;
      } catch (error) {
        if (error.status === 409) {try {update(await request(`/api/rooms/${saved.current}`));} catch {}}
        throw error;
      } finally {busy = false; schedule();}
    },
    pause() {stopped = true; clearTimeout(timer);},
  };
}
