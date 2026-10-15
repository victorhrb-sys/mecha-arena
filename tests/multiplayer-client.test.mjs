import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomClient} from '../dist/network.js';
import {createApi} from '../multiplayer/api.mjs';
import {localStore} from '../multiplayer/local-store.mjs';

test('cliente recupera resposta perdida sem duplicar ação e retoma a identidade com outro cliente', async t => {
  const db = localStore(':memory:'); t.after(db.close);
  const api = createApi(db.store), entries = new Map();
  const storage = {getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value)};
  let latest, loseResponse = false, captured = [];
  const fetcher = async (url, options) => {
    const response = await api(new Request('http://localhost' + url, options));
    if (url.endsWith('/commands')) {captured.push(options.body); if (loseResponse) {loseResponse = false; throw new Error('lost response');}}
    return response;
  };
  const client = createRoomClient({storage, fetcher, onUpdate: view => latest = view, onStatus() {}, interval: 100000}); t.after(client.pause);
  await client.create('Ana'); const code = latest.code;
  const second = createRoomClient({storage: {getItem: () => null, setItem() {}}, fetcher, onUpdate() {}, onStatus() {}, interval: 100000}); t.after(second.pause);
  await second.join(code, 'Beto'); await client.resume();
  await client.command({type: 'START'});
  const before = latest.revision; loseResponse = true; captured = [];
  await client.command({type: 'DRAFT_PICK', id: latest.game.draft.choices[0].id});
  assert.equal(captured.length, 2); assert.equal(captured[0], captured[1]);
  assert.equal(latest.revision, before + 1); assert.equal(latest.game.draft.picks, 1);
  client.pause();
  let resumed;
  const fresh = createRoomClient({storage, fetcher, onUpdate: view => resumed = view, onStatus() {}, interval: 100000}); t.after(fresh.pause);
  await fresh.resume(); assert.deepEqual(resumed, latest); assert.equal(resumed.playerId, 0);
});
