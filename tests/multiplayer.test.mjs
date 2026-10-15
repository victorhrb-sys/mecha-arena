import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from '../server.mjs';
import {chooseAction} from '../dist/bots.js';
import {currentPlayer} from '../dist/engine.js';

let sequence = 0;
const commandId = () => (++sequence).toString(16).padStart(32, '0');
const token = id => (id + 1).toString(16).padStart(64, '0');
async function serverFixture(t, database = ':memory:') {
  const server = await createServer({database, options: {seed: () => 7314}});
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => server.listening ? new Promise(resolve => server.close(resolve)) : undefined);
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(id, route, body, expected = 200) {
    const response = await fetch(base + route, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token(id)}`}, body: body === undefined ? undefined : JSON.stringify(body)});
    const data = await response.json(); assert.equal(response.status, expected, JSON.stringify(data)); return data;
  }
  const read = id => request(id, '/api/rooms/ABC234');
  const send = (id, view, action, idempotency = commandId(), expected = 200) => request(id, '/api/rooms/ABC234/commands', {revision: view.revision,preparation:view.preparation, commandId: idempotency, action}, expected);
  async function create(count) {
    await request(0, '/api/rooms', {code: 'ABC234', name: 'Jogador 0'}, 201);
    for (let id = 1; id < count; id++) await request(id, '/api/rooms/ABC234/join', {name: `Jogador ${id}`});
    return read(0);
  }
  return {server, base, request, read, send, create};
}
function policy(view) {
  const s = view.game, own = s.players[view.playerId];
  if (s.phase === 'arena') return {type: 'ROLL'};
  if (s.phase === 'result') return {type: 'NEXT_ARENA'};
  return chooseAction({phase: s.phase, player: own, choices: s.phase === 'draft' ? s.draft.choices : s.market?.cards ?? [], choiceDone: s.market?.choiceDone ?? false});
}
const nextPlayer = view => view.game.preparation?.players.find(p=>!p.ready)?.id ?? currentPlayer(view.game)?.id ?? 0;

for (const count of [2, 3, 4]) test(`multiplayer HTTP: partida completa com ${count} sessões, todas veem o mesmo resultado`, async t => {
  const api = await serverFixture(t);
  let view = await api.send(0, await api.create(count), {type: 'START'}), steps = 0;
  while (view.game.phase !== 'gameover' && ++steps < 3500) {
    const id = nextPlayer(view);
    const local = await api.read(id);
    assert.equal(local.playerId, id);
    assert.equal('rng' in local.game, false); assert.equal('deck' in local.game, false);
    if (local.game.phase === 'draft') assert.equal(local.game.draft.choices.length, 3);
    const result = await api.send(id, local, policy(local));
    const views = await Promise.all(Array.from({length: count}, (_, seat) => api.read(seat)));
    const publicScore = state => state.players.map(p => [p.id, p.points, p.scrap, p.hp, p.pos, p.alive, p.dice]);
    for (const other of views) {
      assert.equal(other.revision, result.revision);
      assert.equal(other.game.sharedPhase, result.game.sharedPhase);
      assert.deepEqual(publicScore(other.game), publicScore(result.game));
      assert.equal(JSON.stringify(other).includes('"hash"'), false);
      if (['draft', 'assembly', 'market'].includes(other.game.phase)) {
        for (const p of other.game.players.filter(p => p.id !== other.playerId)) {
          assert.deepEqual(p.inventory, []); assert.deepEqual(p.modules, Array(6).fill(null));
        }
      } else assert.deepEqual(other.game.lastRoll, result.game.lastRoll);
    }
    view = views[0];
  }
  assert.ok(steps < 3500); assert.equal(view.game.players[view.game.result.winner].points, 5);
  for(let id=0;id<count;id++){
    const profile=await api.request(id,'/api/profiles?name='+encodeURIComponent(`Jogador ${id}`));
    assert.equal(profile.stats.matches,1);assert.equal(profile.stats.wins,Number(id===view.game.result.winner));
    assert.equal(profile.stats.arenaWins,view.game.players[id].points);assert.equal(profile.history.length,1);
    assert.equal(profile.history[0].winner,view.game.players[view.game.result.winner].name);
  }
  const rematch = await api.send(0, view, {type: 'REMATCH'});
  assert.equal(rematch.game.phase, 'draft'); assert.ok(rematch.game.players.every(p => p.points === 0 && p.scrap === 0));
  assert.equal((await api.request(0,'/api/profiles?name=Jogador%200')).stats.matches,1);
});

test('salas: limites, autorização, saída e transferência do criador antes de iniciar', async t => {
  const api = await serverFixture(t);
  let view = await api.create(4);
  await api.request(4, '/api/rooms/ABC234/join', {name: 'Quinto'}, 409);
  await api.request(8, '/api/rooms/ABC234', undefined, 401);
  await api.send(1, view, {type: 'START'}, commandId(), 403);
  const leaveId = commandId();
  assert.deepEqual(await api.send(0, view, {type: 'LEAVE'}, leaveId), {left: true});
  assert.deepEqual(await api.send(0, view, {type: 'LEAVE'}, leaveId), {left: true});
  view = await api.read(1); assert.equal(view.playerId, 0); assert.equal(view.hostId, 0);
  view = await api.send(1, view, {type: 'START'});
  await api.request(4, '/api/rooms/ABC234/join', {name: 'Tardio'}, 409);
  await api.send(2, view, {type: 'DRAFT_PICK', id: view.game.draft.choices[0].id}, commandId(), 400);
  await api.send(1, view, {type: 'LEAVE'}, commandId(), 409);
});

test('comandos concorrentes e reenvios aplicam uma única escolha; comandos antigos são rejeitados', async t => {
  const api = await serverFixture(t);
  let view = await api.send(0, await api.create(2), {type: 'START'});
  const action = {type: 'DRAFT_PICK', id: view.game.draft.choices[0].id}, id = commandId();
  const results = await Promise.all([api.send(0, view, action, id), api.send(0, view, action, id)]);
  assert.equal(results[0].revision, results[1].revision); assert.equal(results[0].game.draft.picks, 1);
  await api.send(0, view, action, commandId(), 409);
  await api.send(0, view, {type: 'ROLL'}, id, 409);
  const current = await api.read(0); assert.equal(current.game.draft.picks, 1);
  const other=await api.read(1);
  assert.equal(other.game.draft.choices.length,3);
  assert.ok(other.game.draft.choices.every(c=>!current.game.draft.choices.some(own=>own.id===c.id)));
});

test('compra e fim da oportunidade são atômicos; reinício do servidor preserva sessão e recibo', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'mecha-multi-'));
  const file = path.join(directory, 'rooms.sqlite');
  const api = await serverFixture(t, file);
  let view = await api.send(0, await api.create(2), {type: 'START'});
  while (view.game.phase !== 'market') {
    const id = nextPlayer(view);
    const local = await api.read(id); view = await api.send(id, local, policy(local));
  }
  const buyer = currentPlayer(view.game).id, local = await api.read(buyer), oldTurn = local.game.market.turn;
  const action = {type: 'BUY', id: local.game.market.cards[0].id}, receipt = commandId();
  const bought = await api.send(buyer, local, action, receipt);
  assert.equal(bought.game.market.turn, oldTurn + 1);
  assert.equal(bought.game.players[buyer].scrap, local.game.players[buyer].scrap - 3);
  await new Promise(resolve => api.server.close(resolve));
  const restarted = await serverFixture(t, file);
  assert.deepEqual(await restarted.read(buyer), bought);
  assert.deepEqual(await restarted.send(buyer, local, action, receipt), bought);
  await new Promise(resolve => restarted.server.close(resolve));
  await rm(directory, {recursive: true, force: true});
});

test('rotas rejeitam origens externas, métodos inválidos e arquivos privados', async t => {
  const api = await serverFixture(t);
  const external = await fetch(api.base + '/api/rooms', {method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'https://example.com'}, body: '{}'});
  assert.equal(external.status, 403);
  for (const route of ['/server/index.js', '/.openai/hosting.json', '/.runtime/multiplayer.sqlite']) assert.equal((await fetch(api.base + route)).status, 404);
  for (const route of ['/bots.js','/solo.js','/landing.css']) assert.equal((await fetch(api.base + route)).status, 200);
  assert.equal((await fetch(api.base + '/', {method: 'POST'})).status, 405);
});
