import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PROFILE_IDS} from '../dist/bots.js';
import {playArena, playMatch, shuffled, mixedSeed, interval, pairedInterval, STAGES} from './lab.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), option = (key, fallback) => args.includes(key) ? Number(args[args.indexOf(key) + 1]) : fallback;
const samples = option('--samples', 1200), matches = option('--matches', 180), seed = option('--seed', 20260911);
for (const [name, n] of Object.entries({samples, matches, seed})) if (!Number.isSafeInteger(n) || n < 1) throw new Error(`Invalid ${name}`);
const outArg = args.indexOf('--out'), out = path.resolve(root, outArg < 0 ? 'reports/balance-v01f' : args[outArg + 1]);
await mkdir(out, {recursive: true});
const started = Date.now(), summary = {metadata: {version: 'v0.1f', seed, samples, matches, maxRolls: 600, maxRounds: 100,
  generated: new Date().toISOString(), protocol: '1.0', hashes: {}}, cards: [], matchups: [], interventions: [], openingChoices: [], tournament: [], seats: [], matches: []};
for (const file of ['dist/engine.js', 'dist/bots.js', 'simulations/legacy-bots.mjs', 'simulations/lab.mjs', 'simulations/run.mjs']) {
  summary.metadata.hashes[file] = createHash('sha256').update(await readFile(path.join(root, file))).digest('hex');
}
const tally = () => ({n: 0, wins: 0, draws: 0, censored: 0, rolls: 0, scrap: 0});
function add(stat, result, seat = 0) {
  stat.n++; stat.wins += Number(result.winner === seat); stat.draws += Number(result.winner === null && !result.censored);
  stat.censored += Number(result.censored); stat.rolls += result.rolls; stat.scrap += result.scrap[seat];
}
function finish(stat) {return {...stat, winRate: stat.wins / stat.n, ci: interval(stat.wins, stat.n), avgRolls: stat.rolls / stat.n, avgScrap: stat.scrap / stat.n};}
let arenaCount = 0;
for (const [stage, spec] of Object.entries(STAGES)) {
  for (const count of [2, 3, 4]) {
    const cells = Object.fromEntries(['A', 'K', 'Q', 'J'].map(t => [t, [tally(), tally()]]));
    const deltas = Object.fromEntries(['A', 'K', 'Q', 'J'].map(t => [t, []]));
    for (let trial = 0; trial < samples; trial++) {
      const trialSeed = mixedSeed(seed, 'cards', stage, count, trial);
      const roster = shuffled(['attack', 'race', 'defense'], trialSeed).slice(0, count - 1);
      const opponents = roster.map((p, i) => shuffled(spec.builds[p], mixedSeed(trialSeed, 'opponent', i)));
      // Identical occupied faces and background order for all four substitutions.
      const slots = shuffled(Array.from({length: spec.background.length + 1}, (_, i) => i), mixedSeed(trialSeed, 'faces'));
      const focalSeat = trial % count;
      for (const type of ['A', 'K', 'Q', 'J']) {
        const outcomes = [];
        for (const improved of [0, 1]) {
          const tokens = [type + (improved ? '*' : ''), ...spec.background], build = slots.map(i => tokens[i]);
          const loadouts = [...opponents]; loadouts.splice(focalSeat, 0, build);
          const result = playArena(loadouts, trialSeed, {round: spec.round}); arenaCount++;
          add(cells[type][improved], result, focalSeat); outcomes.push(Number(result.winner === focalSeat));
        }
        deltas[type].push(outcomes[1] - outcomes[0]);
      }
    }
    for (const type of ['A', 'K', 'Q', 'J']) summary.cards.push({stage, count, type, normal: finish(cells[type][0]), improved: finish(cells[type][1]), upgrade: pairedInterval(deltas[type])});
    console.log(`Cartas: ${stage}, ${count} jogadores; ${arenaCount} arenas.`);
  }
  const archetypes = Object.keys(spec.builds);
  for (let a = 0; a < archetypes.length; a++) for (let b = a + 1; b < archetypes.length; b++) {
    const stat = tally();
    for (let trial = 0; trial < samples; trial++) {
      const trialSeed = mixedSeed(seed, 'matchup', stage, a, b, trial), focalSeat = trial % 2;
      const builds = [shuffled(spec.builds[archetypes[a]], mixedSeed(trialSeed, a)), shuffled(spec.builds[archetypes[b]], mixedSeed(trialSeed, b))];
      if (focalSeat) builds.reverse();
      const result = playArena(builds, trialSeed, {round: spec.round}); arenaCount++; add(stat, result, focalSeat);
    }
    summary.matchups.push({stage, a: archetypes[a], b: archetypes[b], ...finish(stat)});
  }
}

// Same seed + same opponent + same seat. The pre-triple state is the legal state
// with two commons before accepting a third. The third automatically combines.
const interventions = [
  ...['A', 'K', 'Q', 'J'].map(type => ({id: `triple-${type}`, before: [type, type, ...(type === 'Q' ? ['K'] : ['Q'])], after: [`${type}*`, ...(type === 'Q' ? ['K', null] : ['Q', null])]})),
  {id: 'shield-first', before: ['K', 'J', null], after: ['K', 'J', 'Q']},
  {id: 'cannon-first-face', before: ['Q', 'A', 'K'], after: ['A', 'Q', 'K']},
  {id: 'thruster-first-face', before: ['A', 'Q', 'K'], after: ['K', 'Q', 'A']}
];
for (const experiment of interventions) {
  const before = tally(), after = tally(), deltas = [];
  for (let trial = 0; trial < samples; trial++) {
    const trialSeed = mixedSeed(seed, 'intervention', experiment.id, trial), seat = trial % 2;
    const enemy = shuffled(STAGES.opening.builds[['attack', 'race', 'defense'][trial % 3]], mixedSeed(trialSeed, 'enemy'));
    const results = [experiment.before, experiment.after].map(build => playArena(seat ? [enemy, build] : [build, enemy], trialSeed));
    arenaCount += 2; add(before, results[0], seat); add(after, results[1], seat);
    deltas.push(Number(results[1].winner === seat) - Number(results[0].winner === seat));
  }
  summary.interventions.push({...experiment, beforeStats: finish(before), afterStats: finish(after), ...pairedInterval(deltas)});
}
console.log(`Confrontos controlados concluídos: ${arenaCount} arenas. Iniciando partidas completas.`);

const profiles = [...PROFILE_IDS, 'legacy'], aggregates = new Map(), seats = new Map(), records = [];
function recordMatch(roster, trialSeed, group) {
  const match = playMatch(roster, trialSeed), id = records.length;
  records.push({...match, id, group});
  roster.forEach((profile, seat) => {
    const key = `${roster.length}:${profile}`;
    if (!aggregates.has(key)) aggregates.set(key, {count: roster.length, profile, n: 0, wins: 0, censored: 0, rounds: 0, buys: 0, sales: 0, unlocks: 0, upgrades: 0, triples: 0, draft: {A: 0, K: 0, Q: 0, J: 0}});
    const stat = aggregates.get(key), actions = match.actions[seat];
    stat.n++; stat.wins += Number(match.winner === seat); stat.censored += Number(match.censored); stat.rounds += match.rounds;
    stat.buys += actions.BUY; stat.sales += actions.SELL; stat.unlocks += actions.UNLOCK; stat.upgrades += actions.UPGRADE; stat.triples += actions.triples;
    match.draft[seat].forEach(type => stat.draft[type]++);
    const skey = `${roster.length}:${seat}`;
    if (!seats.has(skey)) seats.set(skey, {count: roster.length, seat, n: 0, wins: 0});
    const s = seats.get(skey); s.n++; s.wins += Number(match.winner === seat);
  });
}
for (let a = 0; a < profiles.length; a++) for (let b = a + 1; b < profiles.length; b++) {
  for (let trial = 0; trial < matches; trial++) {
    const roster = trial % 2 ? [profiles[b], profiles[a]] : [profiles[a], profiles[b]];
    recordMatch(roster, mixedSeed(seed, 'duels', a, b, trial), `${profiles[a]}:${profiles[b]}`);
  }
  console.log(`Partidas: ${profiles[a]} × ${profiles[b]}; ${records.length} concluídas.`);
}
for (const count of [3, 4]) {
  for (let trial = 0; trial < matches; trial++) {
    const ring = shuffled(profiles, mixedSeed(seed, 'ring', count, trial));
    // Each profile occurs once in every seat in each block of seven matches.
    for (let start = 0; start < profiles.length; start++) {
      const roster = Array.from({length: count}, (_, i) => ring[(start + i) % ring.length]);
      recordMatch(roster, mixedSeed(seed, 'multi', count, trial, start), `mixed-${count}`);
    }
  }
  console.log(`Partidas com ${count} jogadores concluídas; total ${records.length}.`);
}
summary.tournament = [...aggregates.values()].map(s => ({...s, winRate: s.wins / s.n, ci: interval(s.wins, s.n), avgRounds: s.rounds / s.n}));
summary.seats = [...seats.values()].map(s => ({...s, winRate: s.wins / s.n, ci: interval(s.wins, s.n)}));
summary.matches = records.map(({arenas, ...m}) => m);
const choiceRecords = [];
for (const profile of ['balanced', 'investor']) for (const initialPoints of [0, 4]) {
  const stats = Object.fromEntries(['A', 'K', 'Q', 'J'].map(type => [type, tally()]));
  const deltas = Object.fromEntries(['A', 'K', 'Q'].map(type => [type, []]));
  for (let trial = 0; trial < matches; trial++) {
    const trialSeed = mixedSeed(seed, 'opening-choices', profile, initialPoints, trial), seat = trial % 2;
    const enemyProfile = PROFILE_IDS[trial % PROFILE_IDS.length];
    const enemy = shuffled(STAGES.opening.builds[['attack', 'race', 'defense'][trial % 3]], mixedSeed(trialSeed, 'enemy'));
    const slots = shuffled([0, 1, 2], mixedSeed(trialSeed, 'faces')), wins = {};
    for (const type of ['A', 'K', 'Q', 'J']) {
      const tokens = [type, 'K', 'Q'], focal = slots.map(i => tokens[i]);
      const match = playMatch(seat ? [enemyProfile, profile] : [profile, enemyProfile], trialSeed, {
        initialLoadouts: seat ? [enemy, focal] : [focal, enemy], initialPoints});
      const stat = stats[type]; stat.n++; stat.wins += Number(match.winner === seat); stat.censored += Number(match.censored);
      stat.rolls += match.rounds; wins[type] = Number(match.winner === seat);
      choiceRecords.push({...match, intervention: {profile, initialPoints, type, seat}});
    }
    for (const type of ['A', 'K', 'Q']) deltas[type].push(wins.J - wins[type]);
  }
  for (const type of ['A', 'K', 'Q', 'J']) summary.openingChoices.push({profile, initialPoints, type,
    n: stats[type].n, wins: stats[type].wins, censored: stats[type].censored, winRate: stats[type].wins / stats[type].n,
    ci: interval(stats[type].wins, stats[type].n), avgRounds: stats[type].rolls / stats[type].n,
    collectorVsThis: type === 'J' ? null : pairedInterval(deltas[type])});
  console.log(`Escolha inicial: ${profile}, placar ${initialPoints} × ${initialPoints}.`);
}
summary.metadata.controlledArenas = arenaCount;
summary.metadata.fullMatches = records.length;
summary.metadata.choiceMatches = choiceRecords.length;
summary.metadata.choiceArenas = choiceRecords.reduce((n, m) => n + m.arenas.length, 0);
summary.metadata.censoredChoiceMatches = choiceRecords.filter(m => m.censored).length;
summary.metadata.matchArenas = records.reduce((n, m) => n + m.arenas.length, 0);
summary.metadata.censoredMatches = records.filter(m => m.censored).length;
summary.metadata.elapsedSeconds = (Date.now() - started) / 1000;
summary.metadata.stages = STAGES;
await writeFile(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
await writeFile(path.join(out, 'matches.jsonl'), records.map(m => JSON.stringify(m)).join('\n') + '\n');
await writeFile(path.join(out, 'opening-choices.jsonl'), choiceRecords.map(m => JSON.stringify(m)).join('\n') + '\n');
const rows = [['match', 'seed', 'players', 'seat', 'profile', 'win', 'censored', 'rounds', 'buys', 'sales', 'unlocks', 'paid_upgrades', 'triples']];
records.forEach(m => m.profiles.forEach((profile, seat) => rows.push([m.id, m.seed, m.profiles.length, seat, profile, Number(m.winner === seat), Number(m.censored), m.rounds, m.actions[seat].BUY, m.actions[seat].SELL, m.actions[seat].UNLOCK, m.actions[seat].UPGRADE, m.actions[seat].triples])));
await writeFile(path.join(out, 'matches.csv'), rows.map(r => r.join(',')).join('\n') + '\n');
console.log(JSON.stringify(summary.metadata, null, 2));
