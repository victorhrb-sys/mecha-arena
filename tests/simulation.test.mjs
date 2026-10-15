import test from 'node:test';
import assert from 'node:assert/strict';
import {act, allCards, validateState, serialize, deserialize} from '../dist/engine.js';
import {newSoloGame, createPersona, PROFILE_IDS, chooseAction, decisionView, rememberArena, advanceBots} from '../dist/bots.js';
import {arenaFixture, playArena, playMatch, interval, STAGES} from '../simulations/lab.mjs';

test('perfis e habilidade são reproduzíveis; novos oponentes têm estilos distintos', () => {
  const state = newSoloGame('Teste', 3, 718);
  assert.equal(new Set(state.players.slice(1).map(p => p.bot.profile)).size, 3);
  assert.deepEqual(state, newSoloGame('Teste', 3, 718));
  const skills = PROFILE_IDS.map((profile, id) => createPersona(123, id, profile).skill);
  assert.ok(new Set(skills).size > 1);
});

test('mesmas ofertas produzem estratégias distintas e o investidor abandona J no ponto decisivo', () => {
  const draft = newSoloGame('Teste', 1, 571), view = decisionView(draft);
  view.player.inventory = [{id: 'K7', type: 'K', upgraded: false}, {id: 'Q7', type: 'Q', upgraded: false}];
  view.choices = ['A', 'K', 'Q', 'J'].map(type => ({id: type + '0', type, upgraded: false}));
  const chosen = PROFILE_IDS.map(profile => chooseAction({...view, player: {...view.player, bot: createPersona(99, 0, profile)}}).id);
  assert.ok(new Set(chosen).size >= 3, chosen.join(','));
  view.player.bot = createPersona(99, 0, 'investor');
  assert.equal(chooseAction(view).id, 'J0');
  view.scoreboard[1].points = 4;
  assert.notEqual(chooseAction(view).id, 'J0');
});

test('bot observa apenas montagem revelada e não muda decisões com dados privados', () => {
  let state = arenaFixture([['A', 'K', 'Q'], ['K', 'K', 'Q']], 531);
  state = rememberArena(state);
  const revealed = structuredClone(state.botMemory);
  while (state.phase === 'arena') state = act(state, {type: 'ROLL'});
  state = act(state, {type: 'NEXT_ARENA'});
  state.players.forEach(p => {p.bot = createPersona(22, p.id, 'balanced');});
  const view = decisionView(state), ownId = view.player.id, enemy = 1 - ownId;
  state.players[enemy].modules.reverse(); state.players[enemy].inventory.push({secret: true});
  state.deck.reverse(); state.rng = 123456;
  assert.deepEqual(decisionView(state), view);
  assert.deepEqual(state.botMemory, revealed);
  assert.deepEqual(chooseAction(view), chooseAction(decisionView(state)));
  view.player.inventory.push({secret: false});
  assert.notDeepEqual(view.player.inventory, state.players[ownId].inventory);
});

test('todos os estilos completam partidas legais com retomada e sem violar conservação', () => {
  for (const count of [2, 3, 4]) for (let offset = 0; offset < PROFILE_IDS.length; offset++) {
    const profiles = Array.from({length: count}, (_, i) => PROFILE_IDS[(offset + i) % PROFILE_IDS.length]);
    const match = playMatch(profiles, 2071 + offset, {validate: true});
    assert.equal(match.censored, false, JSON.stringify({profiles, reason: match.reason}));
    assert.equal(match.points[match.winner], 5);
  }
  let state = newSoloGame('Teste', 3, 123);
  while (state.phase === 'draft' && state.draft.player === 0) state = act(state, chooseAction(decisionView(state)));
  const saved = deserialize(serialize(state));
  assert.deepEqual(advanceBots(saved), advanceBots(state));
  validateState(saved);
});

test('montagens controladas são legais, preservam 32 cartas e efeitos passivos de Q', () => {
  for (const stage of Object.values(STAGES)) for (const type of ['A', 'K', 'Q', 'J']) {
    const state = arenaFixture([[type, ...stage.background], ...['attack', 'race', 'defense'].map(key => stage.builds[key])], 573);
    validateState(state);
    assert.equal(state.deck.length + state.players.flatMap(allCards).length, 32);
  }
  assert.equal(arenaFixture([['K', 'Q', 'Q*'], ['A', 'K', 'J']], 1).players[0].maxHp, 4);
  assert.throws(() => arenaFixture([['A', 'A', 'A'], ['K']], 1), /triple/);
});

test('limite de execução é censura, não empate, e J melhorado não muda a vitória da arena', () => {
  const capped = playArena([['K', 'Q'], ['K', 'Q']], 52, {maxRolls: 0});
  assert.equal(capped.censored, true); assert.equal(capped.reason, 'roll_limit');
  const draw = playArena([['Q', 'J'], ['Q', 'J']], 52);
  assert.equal(draw.censored, false); assert.equal(draw.reason, 'stalemate');
  for (let seed = 1; seed <= 20; seed++) {
    const normal = playArena([['K', 'Q', 'J'], ['A', 'K', 'Q']], seed);
    const improved = playArena([['K', 'Q', 'J*'], ['A', 'K', 'Q']], seed);
    assert.equal(normal.winner, improved.winner); assert.equal(normal.rolls, improved.rolls);
    assert.equal(improved.scrap[0], normal.scrap[0] * 2);
  }
  const match = playMatch(['runner', 'guardian'], 123, {maxActions: 1});
  assert.equal(match.censored, true); assert.equal(match.winner, null);
  assert.ok(interval(50, 100)[0] < 0.5 && interval(50, 100)[1] > 0.5);
});
