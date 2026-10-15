import {act, newGame, currentPlayer, validateState, maxHp, allCards, INITIAL_SCRAP} from '../dist/engine.js';
import {chooseAction, decisionView, rememberArena, createPersona} from '../dist/bots.js';
import {chooseAction as legacyAction} from './legacy-bots.mjs';

export function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function mixedSeed(seed, ...keys) {
  let n = seed >>> 0;
  for (const c of keys.join(':')) n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0;
  return n;
}
export function shuffled(items, seed) {
  const result = [...items], rand = seeded(seed);
  for (let i = result.length - 1; i > 0; i--) {const j = Math.floor(rand() * (i + 1)); [result[i], result[j]] = [result[j], result[i]];}
  return result;
}
export function interval(wins, n) {
  if (!n) return [0, 1];
  const p = wins / n, z = 1.96, d = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / d;
  const half = z / d * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [center - half, center + half];
}
export function pairedInterval(values) {
  const n = values.length, mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const half = 1.96 * Math.sqrt(variance / n);
  return {delta: mean, ci: [Math.max(-1, mean - half), Math.min(1, mean + half)], n};
}

// Fixtures conserve all 32 physical cards; '*' means an already improved card.
// They isolate equipment effects, not the cost/history of acquiring a build.
export function arenaFixture(loadouts, seed, round = 1) {
  const state = newGame(loadouts.map((_, i) => `Piloto ${i + 1}`), seed);
  state.deck.push(...state.draft.choices); state.draft = null;
  state.phase = 'assembly'; state.assemblyPlayer = 0; state.round = round;
  loadouts.forEach((cards, i) => {
    const p = state.players[i]; p.unlocked = Math.max(3, cards.length);
    cards.forEach((token, slot) => {
      if (!token) return;
      const type = token[0], index = state.deck.findIndex(c => c.type === type);
      if (index < 0) throw new Error(`Fixture exceeds eight ${type} cards.`);
      const card = state.deck.splice(index, 1)[0]; card.upgraded = token.includes('*'); p.modules[slot] = card;
    });
    for (const type of ['A', 'K', 'Q', 'J']) {
      if (allCards(p).filter(c => c.type === type && !c.upgraded).length >= 3) throw new Error('Fixture has an uncombined triple.');
    }
    p.maxHp = maxHp(p); p.hp = p.maxHp;
  });
  validateState(state);
  let result = state;
  while (result.phase === 'assembly') result = act(result, {type: 'CONFIRM_ASSEMBLY'});
  // Use the same battle stream across comparable fixtures; drafting is bypassed.
  result.rng = seed >>> 0;
  return result;
}
export function playArena(loadouts, seed, {maxRolls = 600, round = 1} = {}) {
  let state = arenaFixture(loadouts, seed, round);
  while (state.phase === 'arena' && state.rollCount < maxRolls) state = act(state, {type: 'ROLL'});
  const censored = state.phase === 'arena';
  return {winner: state.result?.winner ?? null, reason: censored ? 'roll_limit' : state.result.reason,
    censored, rolls: state.rollCount, scrap: state.players.map(p => p.scrap - INITIAL_SCRAP - (censored ? 0 : 3))};
}

export function playMatch(profiles, seed, {maxRounds = 100, maxRolls = 600, maxActions = 15000, validate = false, initialLoadouts = null, initialPoints = 0} = {}) {
  let state = initialLoadouts ? arenaFixture(initialLoadouts, seed) : newGame(profiles.map((p, i) => `${p} ${i}`), seed), steps = 0, recorded = 0;
  if (initialLoadouts) state.players.forEach(p => {p.points = initialPoints;});
  state.players.forEach((p, i) => {if (profiles[i] !== 'legacy') p.bot = createPersona(seed, i, profiles[i]);});
  const arenas = [], actions = profiles.map(() => ({BUY: 0, SELL: 0, UNLOCK: 0, UPGRADE: 0, triples: 0}));
  const draft = profiles.map(() => []);
  let opening = null, reason = null;
  const captureOpening = () => {
    if (state.round === recorded || !['arena', 'result', 'gameover'].includes(state.phase)) return;
    if (!opening || opening.round !== state.round) opening = {round: state.round,
      players: state.players.map((p, i) => ({profile: profiles[i], seat: i, points: p.points, scrap: p.scrap,
        unlocked: p.unlocked, cards: p.modules.filter(Boolean).map(c => `${c.type}${c.upgraded ? '*' : ''}`)}))};
  };
  while (state.phase !== 'gameover') {
    captureOpening();
    if (state.phase === 'result' && recorded !== state.round) {
      arenas.push({...opening, winner: state.result.winner, reason: state.result.reason, rolls: state.rollCount,
        endScrap: state.players.map(p => p.scrap)}); recorded = state.round;
    }
    if (state.round > maxRounds) {reason = 'round_limit'; break;}
    if (state.phase === 'arena' && state.rollCount >= maxRolls) {reason = 'roll_limit'; break;}
    if (++steps > maxActions) {reason = 'action_limit'; break;}
    const player = currentPlayer(state);
    let action;
    if (player) {
      const view = decisionView(state);
      action = profiles[player.id] === 'legacy' ? legacyAction(view) : chooseAction(view);
      if (Object.hasOwn(actions[player.id], action.type)) actions[player.id][action.type]++;
      if (action.type === 'DRAFT_PICK') draft[player.id].push(view.choices.find(c => c.id === action.id).type);
      if (['BUY', 'DRAFT_PICK'].includes(action.type)) {
        const card = view.choices.find(c => c.id === action.id);
        if (allCards(player).filter(c => c.type === card.type && !c.upgraded).length === 2) actions[player.id].triples++;
      }
    } else action = {type: state.phase === 'arena' ? 'ROLL' : 'NEXT_ARENA'};
    state = rememberArena(act(state, action));
    if (validate) validateState(state);
  }
  if (state.phase === 'gameover') {
    arenas.push({...opening, winner: state.result.winner, reason: state.result.reason, rolls: state.rollCount,
      endScrap: state.players.map(p => p.scrap)});
  }
  return {seed, profiles, winner: reason ? null : state.result.winner, censored: Boolean(reason), reason,
    rounds: arenas.length, actions, draft, arenas, points: state.players.map(p => p.points)};
}

export const STAGES = {
  opening: {name: 'Início · 3 módulos', round: 1, background: ['K', 'Q'], builds: {
    attack: ['A', 'A', 'Q'], race: ['K', 'K', 'Q'], defense: ['K', 'Q', 'Q'], economy: ['K', 'Q', 'J']}},
  middle: {name: 'Meio · 5 módulos', round: 4, background: ['A', 'K', 'Q', 'J'], builds: {
    attack: ['A', 'A', 'K', 'Q', 'J'], race: ['K', 'K', 'A', 'Q', 'J'], defense: ['K', 'Q', 'Q', 'A', 'J'], economy: ['K', 'Q', 'J', 'J', 'A']}},
  late: {name: 'Avançado · 6 módulos', round: 8, background: ['A*', 'K', 'Q', 'J', 'Q*'], builds: {
    attack: ['A*', 'A', 'K', 'Q', 'J', 'K'], race: ['K*', 'K', 'A', 'Q', 'J', 'A'], defense: ['Q*', 'Q', 'K', 'A', 'J', 'K'], economy: ['J*', 'J', 'K', 'Q', 'A', 'K']}}
};
