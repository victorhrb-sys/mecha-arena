import {act, allCards, currentPlayer, newGame, UPGRADE_COST} from './engine.js';

// The first seat belongs to the human, including saves from the local test version.
export const HUMAN_ID = 0;
export const humanPlayer = state => state.players[HUMAN_ID];
export const isBotTurn = state => Boolean(currentPlayer(state) && currentPlayer(state).id !== HUMAN_ID);
export function newSoloGame(name, opponents = 1, seed = Date.now()) {
  if (!Number.isInteger(opponents) || opponents < 1 || opponents > 3) throw new Error('Escolha de 1 a 3 bots.');
  const state = newGame([name, ...Array.from({length: opponents}, (_, i) => `Bot ${String(i + 1).padStart(2, '0')}`)], seed);
  const offset = Math.floor(noise(`${seed}:profiles`) * PROFILE_IDS.length);
  state.players.slice(1).forEach((p, i) => {p.bot = createPersona(seed, p.id, PROFILE_IDS[(offset + i) % PROFILE_IDS.length]);});
  return state;
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
function chooseLegacyAction({phase, player, choices = [], choiceDone = false}) {
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

// These are hypotheses about human styles, not a model fitted to human matches.
export const BOT_PROFILES = {
  aggressive: {name: 'Agressivo', weights: {A: 9, K: 4, Q: 5, J: 2}, order: ['A', 'K', 'Q', 'J']},
  runner: {name: 'Corredor', weights: {A: 3, K: 9, Q: 5, J: 2}, order: ['K', 'A', 'Q', 'J']},
  guardian: {name: 'Defensivo', weights: {A: 4, K: 6, Q: 8, J: 2}, order: ['K', 'Q', 'A', 'J']},
  investor: {name: 'Investidor', weights: {A: 3, K: 6, Q: 5, J: 7}, order: ['K', 'A', 'J', 'Q']},
  opportunist: {name: 'Oportunista', weights: {A: 6, K: 6, Q: 5, J: 4}, order: ['A', 'K', 'Q', 'J']},
  balanced: {name: 'Equilibrado', weights: {A: 6, K: 6, Q: 6, J: 3}, order: ['K', 'A', 'Q', 'J']}
};
export const PROFILE_IDS = Object.keys(BOT_PROFILES);
function noise(key) {
  let n = 2166136261;
  for (const ch of String(key)) n = Math.imul(n ^ ch.charCodeAt(0), 16777619);
  n ^= n >>> 16; n = Math.imul(n, 0x7feb352d); n ^= n >>> 15;
  return (n >>> 0) / 4294967296;
}
export function createPersona(seed, id, profile = PROFILE_IDS[Math.floor(noise(`${seed}:${id}:style`) * PROFILE_IDS.length)]) {
  if (!BOT_PROFILES[profile]) throw new Error('Perfil de bot desconhecido.');
  return {version: 1, profile, seed: noise(`${seed}:${id}:person`) * 4294967296 >>> 0,
    skill: 0.45 + noise(`${seed}:${id}:skill`) * 0.5,
    commitment: 0.55 + noise(`${seed}:${id}:commitment`) * 0.4};
}
export function botLabel(player) {return BOT_PROFILES[player.bot?.profile]?.name ?? 'Clássico';}

function context(view) {
  const brain = view.player.bot, profile = BOT_PROFILES[brain.profile];
  const opponents = (view.lastArena?.players ?? []).filter(p => p.id !== view.player.id);
  const pressure = opponents.length ? opponents.reduce((n, p) => n + p.cards.filter(c => c.type === 'A').reduce((a, c) => a + (c.upgraded ? 2 : 1), 0), 0) / opponents.length : 0;
  const armor = opponents.length ? opponents.reduce((n, p) => n + p.cards.filter(c => c.type === 'Q').length, 0) / opponents.length : 0;
  return {brain, profile, pressure, armor, leader: Math.max(view.player.points, ...(view.scoreboard ?? []).map(p => p.points)), round: view.round ?? 1};
}
function preference(card, others, ctx) {
  const {brain, profile, round, leader} = ctx;
  const count = type => others.filter(c => c.type === type).length;
  const adaptation = brain.skill * (1 - brain.commitment);
  let score = profile.weights[card.type];
  if (card.type === 'J') score *= leader >= 4 ? 0.08 : leader >= 3 ? 0.3 : round >= 5 ? 0.65 : 1;
  if (card.type === 'Q') score += adaptation * ctx.pressure * 4;
  if (card.type === 'K') score += adaptation * ctx.armor * 3;
  if (card.type === 'A') score += adaptation * (ctx.armor < 1 ? 3 : -1);
  if (card.upgraded) score *= card.type === 'J' ? 1.8 : 1.7;
  if (['A', 'K'].includes(card.type) && !others.some(c => ['A', 'K'].includes(c.type))) score += 18;
  if (card.type === 'Q' && !count('Q')) score += 3;
  score -= count(card.type) * (card.type === 'J' ? 3 : card.type === 'Q' ? 1.5 : 0.7);
  // Stable per round and card type: re-equipping cannot reroll an opinion.
  score += (noise(`${brain.seed}:${round}:${card.type}:${card.upgraded}`) - 0.5) * (1 - brain.skill) * 5;
  return score;
}
function ranked(cards, others, ctx) {
  return [...cards].sort((a, b) => preference(b, others, ctx) - preference(a, others, ctx) || a.id.localeCompare(b.id));
}
function plannedLoadout(player, ctx) {
  const remaining = allCards(player).sort((a, b) => a.id.localeCompare(b.id)), chosen = [];
  while (remaining.length && chosen.length < player.unlocked) {
    const next = ranked(remaining, chosen, ctx)[0];
    chosen.push(next); remaining.splice(remaining.indexOf(next), 1);
  }
  const priority = c => ctx.profile.order.indexOf(c.type) - (c.upgraded ? 0.3 : 0)
    + noise(`${ctx.brain.seed}:slot:${c.id}`) * (1 - ctx.brain.skill) * 2.5;
  return chosen.sort((a, b) => priority(a) - priority(b) || a.id.localeCompare(b.id));
}
export function chooseAction(view) {
  const {phase, player, choices = [], choiceDone = false} = view;
  // Old saves retain the classic policy, without changing their RNG or equipment.
  if (!BOT_PROFILES[player?.bot?.profile]) return chooseLegacyAction(view);
  const ctx = context(view), owned = allCards(player);
  const acquireScore = card => {
    const same = owned.filter(c => c.type === card.type && !c.upgraded).length;
    // A triple compresses three activation faces into one: costly on a small robot.
    const triple = same === 2 ? (owned.length >= 5 ? 5 : -7) : same === 1 ? 0.8 : 0;
    return preference(card, owned, ctx) + triple * (ctx.brain.profile === 'opportunist' ? 1.3 : 1);
  };
  const offers = [...choices].sort((a, b) => acquireScore(b) - acquireScore(a) || a.id.localeCompare(b.id));
  if (phase === 'draft') return {type: 'DRAFT_PICK', id: offers[0].id};
  if (phase === 'assembly') {
    const desired = plannedLoadout(player, ctx);
    for (let slot = 0; slot < desired.length; slot++) {
      if (player.modules[slot]?.id !== desired[slot].id) return {type: 'EQUIP', id: desired[slot].id, slot};
    }
    if (player.inventory.length > 1) {
      const reserve = ranked(player.inventory, desired, ctx)[0];
      const excess = ranked(player.inventory.filter(c => c.id !== reserve.id), desired, ctx).at(-1);
      return {type: 'SELL', id: excess.id};
    }
    return {type: 'CONFIRM_ASSEMBLY'};
  }
  if (phase === 'market') {
    const cost = player.unlocked + 1, candidate = offers[0];
    if (player.unlocked < 6 && player.scrap >= cost &&
      (owned.length > player.unlocked || (!choiceDone && candidate && owned.length === player.unlocked && player.scrap >= cost + 3 && acquireScore(candidate) > 2))) return {type: 'UNLOCK'};
    if (!choiceDone && candidate && player.scrap >= 3) {
      const triple = owned.filter(c => c.type === candidate.type && !c.upgraded).length === 2;
      const weakest = ranked(owned, [], ctx).at(-1);
      const improves = weakest && acquireScore(candidate) > preference(weakest, owned.filter(c => c.id !== weakest.id), ctx) + 2;
      if (acquireScore(candidate) > 1.5 && (owned.length < player.unlocked + 1 || (triple && owned.length >= 5) || improves)) return {type: 'BUY', id: candidate.id};
    }
    if (player.scrap >= UPGRADE_COST) {
      const equipped = plannedLoadout(player, ctx);
      const candidates = equipped.filter(c => !c.upgraded && (c.type !== 'J' || ctx.leader < 3));
      const gain = c => preference({...c, upgraded: true}, equipped.filter(x => x.id !== c.id), ctx) - preference(c, equipped.filter(x => x.id !== c.id), ctx);
      candidates.sort((a, b) => gain(b) - gain(a) || a.id.localeCompare(b.id));
      if (candidates.length) return {type: 'UPGRADE', id: candidates[0].id};
    }
    return {type: 'END_TURN'};
  }
  return null;
}

// Called only after equipment is publicly revealed. Memory survives reloads and
// holds the previous arena during hidden drafting/assembly, never current gear.
export function rememberArena(input) {
  if (!['arena', 'result', 'gameover'].includes(input.phase) || input.botMemory?.round === input.round) return input;
  const state = {...input, botMemory: {round: input.round, players: input.players.map(p => ({id: p.id,
    unlocked: p.unlocked,
    modules: p.modules.map(c => c ? {type: c.type, upgraded: c.upgraded} : null),
    cards: p.modules.filter(Boolean).map(c => ({type: c.type, upgraded: c.upgraded}))}))}};
  return state;
}
export function decisionView(state) {
  const own = currentPlayer(state);
  // Copy and whitelist inputs so a policy cannot mutate a live state or inspect
  // private state accidentally added elsewhere in the engine in the future.
  return structuredClone({phase: state.phase, player: own && {id: own.id, modules: own.modules, inventory: own.inventory,
    unlocked: own.unlocked, scrap: own.scrap, points: own.points, bot: own.bot},
    choices: state.phase === 'draft' ? state.draft.choices : state.market?.cards ?? [],
    choiceDone: state.market?.choiceDone ?? false, round: state.round,
    scoreboard: state.players.map(p => ({id: p.id, points: p.points, scrap: p.scrap, unlocked: p.unlocked})),
    lastArena: state.botMemory ?? null});
}
export function actAsHuman(state, action) {
  const improvement=['UNLOCK','UPGRADE'].includes(action.type);
  if (isBotTurn(state)&&!improvement) throw new Error('Aguarde os bots terminarem a vez.');
  if(improvement)action={...action,playerId:HUMAN_ID};
  return rememberArena(recordMarketAction(state, act(state, action), action));
}
export function advanceBots(input) {
  let state = input, steps = 0;
  while (isBotTurn(state)) {
    if (++steps > 200) throw new Error('Não foi possível concluir a vez dos bots. Retome a partida para tentar novamente.');
    const action = chooseAction(decisionView(state));
    state = rememberArena(recordMarketAction(state, act(state, action), action));
  }
  return state;
}
import {recordMarketAction} from './market-activity.js';
