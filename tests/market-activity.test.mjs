import test from 'node:test';
import assert from 'node:assert/strict';
import {newSoloGame} from '../dist/bots.js';
import {act, serialize, deserialize} from '../dist/engine.js';
import {recordMarketAction} from '../dist/market-activity.js';

function fixture() {
  const s = newSoloGame('Piloto', 1, 45);
  s.deck.push(...s.draft.choices); s.draft = null; s.phase = 'market';
  s.market = {cards: s.deck.splice(0, 3), order: [1, 0, 0, 1], turn: 0, choiceDone: false};
  s.players[1].scrap = 30;
  return s;
}
const apply = (s, a) => recordMarketAction(s, act(s, a), a);

test('registra compra real, persiste e não confunde conclusão com passar', () => {
  const before = fixture(), card = before.market.cards[0];
  const bought = apply(before, {type:'BUY', id:card.id});
  assert.equal(before.marketActivity, undefined);
  assert.deepEqual(bought.marketActivity.events[0], {playerId:1, type:'BUY', scrap:-3, card:{type:card.type, upgraded:false}});
  const ended = apply(bought, {type:'END_TURN'});
  assert.equal(ended.marketActivity.events.length, 1);
  assert.deepEqual(deserialize(serialize(ended)).marketActivity, bought.marketActivity);
  const passed = apply(ended, {type:'END_TURN'});
  assert.equal(passed.marketActivity.events[1].type, 'PASS');
});

test('melhoria, venda e construção guardam custos e peças da ação concluída', () => {
  let s = fixture(); const card = s.deck.pop(); s.players[1].inventory.push(card);
  s = apply(s, {type:'UPGRADE', id:card.id});
  s = apply(s, {type:'SELL', id:card.id});
  s = apply(s, {type:'UNLOCK'});
  assert.deepEqual(s.marketActivity.events.map(e=>[e.type,e.scrap]), [['UPGRADE',-12],['SELL',1],['UNLOCK',-4]]);
  assert.equal(s.marketActivity.events[1].card.upgraded, true);
  assert.equal(s.marketActivity.events[2].module, 4);
  assert.equal('inventory' in s.marketActivity.events[0], false);
});

test('não registra fases ocultas nem mistura lojas de rodadas diferentes', () => {
  let s = apply(fixture(), {type:'END_TURN'});
  s.round++;
  s = apply(s, {type:'END_TURN'});
  assert.equal(s.marketActivity.events.length, 1);
  assert.equal(s.marketActivity.round, s.round);
  const hidden = {...s, phase:'assembly'};
  assert.equal(recordMarketAction(hidden, hidden, {type:'SELL'}), hidden);
});
