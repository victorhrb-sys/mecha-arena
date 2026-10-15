import test from 'node:test';
import assert from 'node:assert/strict';
import {act, allCards, currentPlayer, serialize, deserialize, validateState} from '../dist/engine.js';
import {newSoloGame, humanPlayer, isBotTurn, advanceBots, actAsHuman, chooseAction, decisionView} from '../dist/bots.js';

function finishHumanDraft(state) {
  while (state.phase === 'draft' && !isBotTurn(state)) state = actAsHuman(state, chooseAction(decisionView(state)));
  return state;
}
function card(state, player, type, inventory = true, slot = 0) {
  const index = state.deck.findIndex(c => c.type === type);
  assert.ok(index >= 0);
  const c = state.deck.splice(index, 1)[0];
  if (inventory) player.inventory.push(c); else player.modules[slot] = c;
  return c;
}
function assemblyFixture() {
  const state = newSoloGame('Victor', 1, 25);
  delete state.players[1].bot; // Fixtures below pin the retained classic policy.
  state.deck.push(...state.draft.choices);state.draft = null;state.phase = 'assembly';state.assemblyPlayer = 1;
  card(state, state.players[0], 'K', false);
  return state;
}

test('um humano e 1–3 bots, preservando o nome e as regras de preparação', () => {
  for (const count of [1, 2, 3]) {
    const state = newSoloGame('Victor', count, 20);
    assert.equal(humanPlayer(state).name, 'Victor');
    assert.ok(state.players.every(p => p.scrap === 0));
    assert.equal(state.players.length, count + 1);
    assert.equal(state.players[1].name, 'Bot 01');
    assert.equal(isBotTurn(state), false);
    assert.equal(advanceBots(state), state);
    validateState(state);
  }
  assert.throws(() => newSoloGame('Victor', 0));
});

test('bots terminam suas escolhas e devolvem o controle na montagem sem alterar as escolhas humanas', () => {
  const state = finishHumanDraft(newSoloGame('Victor', 3, 52)), before = serialize(state);
  const output = advanceBots(state);
  assert.equal(serialize(state), before, 'O avanço deve ser atômico, sem mutar a partida anterior.');
  assert.equal(output.phase, 'assembly');
  assert.equal(currentPlayer(output).id, 0);
  assert.deepEqual(humanPlayer(output), humanPlayer(state));
  for (const bot of output.players.slice(1)) assert.ok(allCards(bot).length > 0);
  assert.deepEqual(advanceBots(deserialize(before)), output);
  assert.throws(() => actAsHuman(state, {type: 'DRAFT_PICK', id: state.draft.choices[0].id}), /Aguarde/);
  validateState(output);
});

test('montagem do bot equipa uma condição de vitória, vende excedentes e respeita a reserva', () => {
  const state = assemblyFixture(), bot = state.players[1];
  for (const type of ['J', 'J', 'Q', 'Q', 'A', 'K']) card(state, bot, type);
  const output = advanceBots(state), result = output.players[1];
  assert.equal(output.phase, 'arena');
  assert.ok(result.modules.some(c => c && ['A', 'K'].includes(c.type)));
  assert.equal(result.inventory.length, 1);
  assert.equal(result.modules.filter(Boolean).length, 3);
  assert.equal(result.scrap, 2);
  assert.equal(output.rollCount, 0, 'Os bots não iniciam rolagens.');
  validateState(output);
});

test('loja vazia e falta de sucata não travam; turno humano seguinte permanece intacto', () => {
  let state = assemblyFixture();state.phase = 'market';
  state.market = {cards: [], order: [1, 0, 0, 1], turn: 0, choiceDone: false};
  state.players[1].scrap = 0;
  state = advanceBots(state);
  assert.equal(state.market.turn, 1);
  assert.equal(currentPlayer(state).id, 0);
  assert.equal(state.market.choiceDone, false);
  assert.equal(advanceBots(state), state);
  validateState(state);
});

test('bot desbloqueia em sequência, compra com custo normal e não duplica compras ao retomar', () => {
  let state = assemblyFixture(), bot = state.players[1];
  for (const type of ['A', 'K', 'Q', 'J', 'A', 'K']) card(state, bot, type);
  const index = state.deck.findIndex(c => c.type === 'Q'), offered = state.deck.splice(index, 1)[0];
  state.phase = 'market';state.market = {cards: [offered], order: [1, 0, 0, 1], turn: 0, choiceDone: false};
  bot.scrap = 20;
  const out = advanceBots(state);
  assert.equal(out.players[1].unlocked, 6);
  assert.equal(out.players[1].scrap, 2); // 20 - 4 - 5 - 6 - 3
  assert.ok(allCards(out.players[1]).some(c => c.id === offered.id));
  assert.deepEqual(advanceBots(deserialize(serialize(out))), out);
  state = act(state, {type: 'BUY', id: offered.id}); // Resume a legacy save after its purchase.
  const resumed = advanceBots(deserialize(serialize(state)));
  assert.equal(resumed.players[1].scrap, 2);
  validateState(resumed);
});

test('a política recebe somente o próprio robô e as ofertas; decisões não usam sorteios futuros', () => {
  const state = finishHumanDraft(newSoloGame('Victor', 2, 87));
  const view = decisionView(state);
  assert.deepEqual(Object.keys(view).sort(), ['choiceDone', 'choices', 'lastArena', 'phase', 'player', 'round', 'scoreboard']);
  const before = chooseAction(view), altered = structuredClone(state);
  altered.deck.reverse();altered.rng = 123456;
  altered.players[0].inventory.reverse();
  assert.deepEqual(chooseAction(decisionView(altered)), before);
});

test('bot também paga 12 para melhorar uma carta, sem repetir ao retomar',()=>{
  const state=assemblyFixture();const cannon=card(state,state.players[1],'A',false);
  state.phase='market';state.market={cards:[],order:[1,0,0,1],turn:0,choiceDone:false};state.players[1].scrap=12;
  const out=advanceBots(state);
  assert.equal(out.players[1].modules[0].id,cannon.id);assert.equal(out.players[1].modules[0].upgraded,true);
  assert.equal(out.players[1].scrap,0);assert.equal(currentPlayer(out).id,0);
  assert.deepEqual(advanceBots(deserialize(serialize(out))),out);
});

for (const opponents of [1, 2, 3]) test(`partidas completas contra ${opponents} bots: turnos, custos, retomada e vitória`, () => {
  for (const seed of [17, 206, 984]) {
    let state = newSoloGame('Victor', opponents, seed), steps = 0;
    while (state.phase !== 'gameover' && steps++ < 8000) {
      state = advanceBots(deserialize(serialize(state)));
      assert.equal(isBotTurn(state), false);
      if (state.phase === 'gameover') break;
      if (currentPlayer(state)) {
        assert.equal(currentPlayer(state).id, 0);
        state = actAsHuman(state, chooseAction(decisionView(state)));
      } else if (state.phase === 'arena') state = actAsHuman(state, {type: 'ROLL'});
      else if (state.phase === 'result') state = actAsHuman(state, {type: 'NEXT_ARENA'});
      validateState(state);
    }
    assert.equal(state.phase, 'gameover', `Não terminou: seed ${seed}, ${steps} ações.`);
    assert.equal(state.players[state.result.winner].points, 5);
    assert.deepEqual(advanceBots(deserialize(serialize(state))), state);
  }
});
