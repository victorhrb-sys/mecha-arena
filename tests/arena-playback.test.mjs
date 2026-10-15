import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame, resolveRoll, maxHp, serialize, deserialize} from '../dist/engine.js';
import {resourceEffects, createAutoRoller, createPlaybackClock, normalizeSpeed} from '../dist/arena-playback.js';

function fixture(types) {
  const state = newGame(types.map((_, i) => `Piloto ${i}`), 50);
  state.deck.push(...state.draft.choices); state.draft = null; state.phase = 'arena';
  types.forEach((type, id) => {
    const index = state.deck.findIndex(c => c.type === type[0]), card = state.deck.splice(index, 1)[0];
    card.upgraded = type.endsWith('*'); state.players[id].modules[0] = card;
    state.players[id].hp = state.players[id].maxHp = maxHp(state.players[id]);
  });
  return state;
}
function scheduler() {
  const jobs = new Map(); let id = 0;
  return {jobs, schedule(fn) {jobs.set(++id, fn); return id;}, cancel(id) {jobs.delete(id);},
    tick() {const [id, fn] = jobs.entries().next().value; jobs.delete(id); fn();}};
}

test('coleta simultânea exibe +1 e +2 sucatas reais; rever o efeito não credita de novo', () => {
  const state = resolveRoll(fixture(['J', 'J*', 'K']), [1, 1, 6]);
  const saved = serialize(state), roll = deserialize(saved).lastRoll;
  const expected = [{playerId: 0, type: 'J', amount: 1}, {playerId: 1, type: 'J', amount: 2}];
  assert.deepEqual(resourceEffects(roll, 0), expected);
  assert.deepEqual(resourceEffects(roll, 0), expected);
  assert.equal(serialize(state), saved);
  assert.equal(state.players[0].scrap, 1); assert.equal(state.players[1].scrap, 2);
});

test('escudo mostra apenas a cura aplicada: cura parcial, completa e HP cheio', () => {
  const initial = fixture(['Q', 'Q*', 'K']);
  initial.players[0].hp = 1; initial.players[1].hp = 2;
  const partial = resolveRoll(initial, [1, 1, 6]);
  assert.deepEqual(resourceEffects(partial.lastRoll, 0), [{playerId: 0, type: 'Q', amount: 1}, {playerId: 1, type: 'Q', amount: 1}]);
  initial.players[1].hp = 1;
  assert.equal(resourceEffects(resolveRoll(initial, [1, 1, 6]).lastRoll, 0)[1].amount, 2);
  const full = resolveRoll(fixture(['Q', 'Q*', 'K']), [1, 1, 6]);
  assert.deepEqual(resourceEffects(full.lastRoll, 0).map(e => e.amount), [0, 0]);
  assert.deepEqual(resourceEffects(full.lastRoll, -1), []);
});

test('efeito de cura usa o estado após um ataque anterior na mesma rolagem', () => {
  const initial = fixture(['A', 'Q*']);
  initial.players[1].modules[1] = initial.players[1].modules[0]; initial.players[1].modules[0] = null;
  const out = resolveRoll(initial, [1, 2]);
  assert.equal(out.lastRoll.events[0].type, 'A');
  assert.deepEqual(resourceEffects(out.lastRoll, 1), [{playerId: 1, type: 'Q', amount: 1}]);
  assert.equal(out.players[1].hp, 3);
});

test('rolagens automáticas aguardam cada animação e param no resultado sem avançar à compra', () => {
  for (const points of [0, 4]) {
    let game = fixture(['K', 'Q']); game.players[0].points = points;
    const clock = scheduler(), saves = [];
    const runner = createAutoRoller({getPhase: () => game.phase,
      roll: () => {game = resolveRoll(game, [1, 6]); saves.push(serialize(game));}, ...clock});
    runner.start(); assert.equal(game.rollCount, 1); assert.equal(clock.jobs.size, 0);
    while (game.phase === 'arena') {
      runner.afterPlayback(); runner.afterPlayback(); assert.equal(clock.jobs.size, 1);
      clock.tick(); assert.equal(clock.jobs.size, 0);
    }
    runner.afterPlayback(); assert.equal(runner.running, false); assert.equal(clock.jobs.size, 0);
    assert.equal(game.rollCount, 4); assert.equal(saves.length, 4);
    assert.equal(game.phase, points === 4 ? 'gameover' : 'result'); assert.equal(game.round, 1);
    assert.equal(deserialize(saves.at(-1)).players[0].scrap, 3);
    runner.start(); assert.equal(saves.length, 4);
  }
});

test('pausar durante a animação ou no intervalo impede qualquer próxima rolagem', () => {
  const clock = scheduler(); let rolls = 0;
  const runner = createAutoRoller({getPhase: () => 'arena', roll: () => rolls++, ...clock});
  runner.start(); runner.stop(); runner.afterPlayback();
  assert.equal(rolls, 1); assert.equal(clock.jobs.size, 0);
  runner.start(); runner.afterPlayback(); const stale = [...clock.jobs.values()][0];
  runner.stop(); assert.equal(clock.jobs.size, 0); stale(); assert.equal(rolls, 2);
  const loaded = createAutoRoller({getPhase: () => 'arena', roll: () => rolls++, ...clock});
  loaded.afterPlayback(); assert.equal(loaded.running, false); assert.equal(clock.jobs.size, 0);
});

test('empate e mudança de fase interrompem a sequência, e salvar não altera saldos existentes', () => {
  let phase = 'arena', rolls = 0; const clock = scheduler();
  const runner = createAutoRoller({getPhase: () => phase, roll: () => {rolls++; phase = 'result';}, ...clock});
  runner.start(); runner.afterPlayback(); assert.equal(runner.running, false); assert.equal(rolls, 1);
  phase = 'market'; runner.start(); assert.equal(rolls, 1);
  const existing = fixture(['K', 'Q']); existing.players[0].scrap = 17;
  assert.equal(deserialize(serialize(existing)).players[0].scrap, 17);
});

function timeline() {
  let time = 0, serial = 0; const jobs = new Map();
  return {jobs, now: () => time, advance: ms => {time += ms;},
    schedule(callback, delay) {jobs.set(++serial, {callback, at: time + delay}); return serial;},
    cancel: id => jobs.delete(id),
    tick() {const [id, job] = [...jobs].sort((a, b) => a[1].at - b[1].at)[0]; jobs.delete(id); time = job.at; job.callback();}
  };
}

test('velocidade muda o tempo restante sem reiniciar nem duplicar a ativação', () => {
  const time = timeline(), clock = createPlaybackClock(time); let activations = 0;
  clock.schedule(() => activations++, 1600);
  const original = [...time.jobs.values()][0].callback;
  time.advance(400); clock.setSpeed(2);
  assert.equal([...time.jobs.values()][0].at, 1000); // 400 + 1200 / 2
  original(); assert.equal(activations, 0);
  time.advance(300); clock.setSpeed(.5);
  assert.equal([...time.jobs.values()][0].at, 1900); // 700 + 600 / 0.5
  time.tick(); assert.equal(activations, 1); assert.equal(time.jobs.size, 0);
  assert.equal(normalizeSpeed(100), 4); assert.equal(normalizeSpeed(-1), .5); assert.equal(normalizeSpeed('inválida'), 1);
});

test('a pausa cancela o intervalo automático mesmo após uma mudança de velocidade', () => {
  const time = timeline(), clock = createPlaybackClock({...time, speed: 4}); let rolls = 0;
  const runner = createAutoRoller({getPhase: () => 'arena', roll: () => rolls++, schedule: clock.schedule, cancel: clock.cancel});
  runner.start(); runner.afterPlayback(); assert.equal([...time.jobs.values()][0].at, 162.5);
  time.advance(50); clock.setSpeed(.5); assert.equal([...time.jobs.values()][0].at, 950);
  const pending = [...time.jobs.values()][0].callback;
  runner.stop(); pending(); assert.equal(rolls, 1); assert.equal(time.jobs.size, 0);
});

test('ritmos diferentes preservam a mesma arena, os ganhos e o resultado salvo', () => {
  const outcomes = [], elapsed = [];
  for (const speed of [.5, 1, 4]) {
    const time = timeline(), clock = createPlaybackClock({...time, speed}); let game = fixture(['K', 'Q']);
    const runner = createAutoRoller({getPhase: () => game.phase, schedule: clock.schedule, cancel: clock.cancel,
      roll: () => {game = resolveRoll(game, [1, 6]); clock.schedule(() => runner.afterPlayback(), 900);}});
    runner.start();
    let guard = 0; while (time.jobs.size && guard++ < 20) time.tick();
    assert.equal(game.phase, 'result'); assert.equal(runner.running, false); assert.equal(game.rollCount, 4);
    outcomes.push(serialize(game)); elapsed.push(time.now());
  }
  assert.equal(outcomes[0], outcomes[1]); assert.equal(outcomes[1], outcomes[2]);
  assert.equal(elapsed[0], elapsed[1] * 2); assert.equal(elapsed[2], elapsed[1] / 4);
});
