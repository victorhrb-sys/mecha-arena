import {act, allCards, currentPlayer, newGame, UPGRADE_COST} from '../dist/engine.js';

// The first seat belongs to the human, including saves from the local test version.
export const HUMAN_ID = 0;
export const humanPlayer = state => state.players[HUMAN_ID];
export const isBotTurn = state => Boolean(currentPlayer(state) && currentPlayer(state).id !== HUMAN_ID);
export function newSoloGame(name, opponents = 1, seed = Date.now()) {
  if (!Number.isInteger(opponents) || opponents < 1 || opponents > 3) throw new Error('Escolha de 1 a 3 bots.');
  return newGame([name, ...Array.from({length: opponents}, (_, i) => `Bot ${String(i + 1).padStart(2, '0')}`)], seed);
}

function value(card, others, playerId) {
  const same = others.filter(c => c.type === card.type && !c.upgraded).length;
  let score = {A: 5, K: 5, Q: 2, J: 1}[card.type] + (card.upgraded ? 6 : 0);
  if (['A', 'K'].includes(card.type) && !others.some(c => ['A', 'K'].includes(c.type))) score += 10;
  if (card.type === 'Q' && !others.some(c => c.type === 'Q')) score += 5;
  if (card.type === 'J' && !others.some(c => c.type === 'J')) score += 3;
  if (!card.upgraded && same === 2) score += 7;
  if (!card.upgraded && same === 1) score += 1;
  if (card.type === (playerId % 2 ? 'A' : 'K')) score += 1;
  return score;
}
function best(cards, others, id) {
  return [...cards].sort((a, b) => value(b, others, id) - value(a, others, id) || a.id.localeCompare(b.id))[0];
}
function loadout(player) {
  const remaining = allCards(player), chosen = [];
  while (remaining.length && chosen.length < player.unlocked) {
    const card = best(remaining, chosen, player.id);
    chosen.push(card); remaining.splice(remaining.findIndex(c => c.id === card.id), 1);
  }
  // Fast attacks and movement occupy the earliest faces. Shields still grant passive HP.
  chosen.sort((a, b) => ['A', 'K', 'Q', 'J'].indexOf(a.type) - ['A', 'K', 'Q', 'J'].indexOf(b.type)
    || Number(b.upgraded) - Number(a.upgraded) || a.id.localeCompare(b.id));
  return chosen;
}

// The policy receives only its own equipment and the visible offer. It cannot
// inspect opponents' hidden cards, the deck order or future dice.
export function chooseAction({phase, player, choices = [], choiceDone = false}) {
  const owned = allCards(player);
  if (phase === 'draft') return {type: 'DRAFT_PICK', id: best(choices, owned, player.id).id};
  if (phase === 'assembly') {
    const desired = loadout(player);
    for (let slot = 0; slot < desired.length; slot++) {
      if (player.modules[slot]?.id !== desired[slot].id) return {type: 'EQUIP', id: desired[slot].id, slot};
    }
    if (player.inventory.length > 1) {
      const reserve = best(player.inventory, desired, player.id);
      return {type: 'SELL', id: player.inventory.find(c => c.id !== reserve.id).id};
    }
    return {type: 'CONFIRM_ASSEMBLY'};
  }
  if (phase === 'market') {
    const cost = player.unlocked + 1;
    if (player.unlocked < 6 && owned.length > player.unlocked && player.scrap >= cost) return {type: 'UNLOCK'};
    if (!choiceDone && choices.length && player.scrap >= 3) {
      const card = best(choices, owned, player.id);
      const triple = owned.filter(c => c.type === card.type && !c.upgraded).length === 2;
      if (owned.length < player.unlocked + 1 || triple) return {type: 'BUY', id: card.id};
    }
    if (player.scrap >= UPGRADE_COST) {
      const candidates = loadout(player).filter(c => !c.upgraded);
      if (candidates.length) {
        const upgrade = best(candidates, [], player.id);
        return {type: 'UPGRADE', id: upgrade.id};
      }
    }
    return {type: 'END_TURN'};
  }
  return null;
}
export function decisionView(state) {
  return {phase: state.phase, player: currentPlayer(state),
    choices: state.phase === 'draft' ? state.draft.choices : state.market?.cards ?? [],
    choiceDone: state.market?.choiceDone ?? false};
}
export function actAsHuman(state, action) {
  if (isBotTurn(state)) throw new Error('Aguarde os bots terminarem a vez.');
  return act(state, action);
}
export function advanceBots(input) {
  let state = input, steps = 0;
  while (isBotTurn(state)) {
    if (++steps > 200) throw new Error('Não foi possível concluir a vez dos bots. Retome a partida para tentar novamente.');
    state = act(state, chooseAction(decisionView(state)));
  }
  return state;
}

