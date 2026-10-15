import {act, currentPlayer, newGame, prepareTogether, validateState} from '../dist/engine.js';
import {recordMarketAction} from '../dist/market-activity.js';
import {profileName,profileKey} from './profiles.mjs';
import {advanceRoomBots,initializeRoomBots} from './room-bots.mjs';

const CODE = /^[A-HJ-NP-Z2-9]{6}$/;
const TOKEN = /^[a-f0-9]{64}$/;
const COMMAND = /^[a-f0-9]{32}$/;
const TTL = 7 * 24 * 60 * 60 * 1000;
const PLAYER_ACTIONS = new Set(['DRAFT_PICK', 'EQUIP', 'UNEQUIP', 'SELL', 'UNLOCK', 'UPGRADE', 'BUY', 'END_TURN', 'CONFIRM_ASSEMBLY']);
export class RoomError extends Error {
  constructor(message, status = 400) {super(message); this.status = status;}
}
const requireRoom = (ok, message, status = 400) => {if (!ok) throw new RoomError(message, status);};
const clone = value => structuredClone(value);
const pick = (source, fields) => Object.fromEntries(fields.map(key => [key, clone(source[key])]));
export async function tokenHash(token) {
  requireRoom(TOKEN.test(token ?? ''), 'Sessão inválida. Entre novamente na sala.', 401);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
}
function playerName(value) {
  try{return profileName(value);}catch(error){throw new RoomError(error.message);}
}
function validateCode(code) {requireRoom(CODE.test(code ?? ''), 'Informe os 6 caracteres do código da sala.');}
function playerId(room, hash) {
  const id = room.members.findIndex(p => p.hash === hash);
  requireRoom(id >= 0, 'Esta sessão não pertence à sala. Entre novamente.', 401);
  return id;
}
function rememberArena(state) {
  if (!['arena', 'result', 'gameover'].includes(state.phase) || state.botMemory?.round === state.round) return state;
  state.botMemory = {round: state.round, players: state.players.map(p => ({id: p.id, unlocked: p.unlocked,
    modules: p.modules.map(c => c ? {type: c.type, upgraded: c.upgraded} : null),
    cards: p.modules.filter(Boolean).map(c => ({type: c.type, upgraded: c.upgraded}))}))};
  return state;
}
const preparationEpoch = (room, state) => `${room.matchId ?? 'legacy'}:${state.round}`;

// Explicit projection: deck, RNG, credentials and private loadouts never leave the server.
export function roomView(room, id) {
  let game = null,preparation=null;
  if (room.game) {
    const state = prepareTogether(room.game), revealed = ['arena', 'result', 'gameover'].includes(state.phase);
    game = pick(state, ['version', 'phase', 'round', 'rollCount', 'reference', 'assemblyPlayer', 'result']);
    game.sharedPhase=state.phase;
    game.notice = '';
    game.players = state.players.map(p => {
      const own = p.id === id;
      const result = pick(p, ['id', 'name', 'color', 'unlocked', 'scrap', 'points', 'hp', 'maxHp', 'pos', 'alive', 'dice']);
      result.modules = own || revealed ? clone(p.modules) : Array(6).fill(null);
      result.inventory = own ? clone(p.inventory) : [];
      result.hidden = !own && !revealed;
      result.bot=Boolean(room.members[p.id].bot);
      return result;
    });
    game.draft = state.draft ? {...pick(state.draft, ['player', 'picks']), choices: state.draft.player === id ? clone(state.draft.choices) : []} : null;
    game.market = state.market ? clone(state.market) : null;
    game.lastRoll = revealed ? clone(state.lastRoll) : null;
    game.botMemory = clone(state.botMemory ?? null);
    game.marketActivity = state.marketActivity ? clone(state.marketActivity) : null;
    game.marketReplay = state.marketReplay?.round===state.round ? clone(state.marketReplay) : null;
    if(state.preparation) {
      const seat=state.preparation.seats[id];
      game.phase=seat.picks<3?'draft':'assembly';
      game.assemblyPlayer=id;
      game.draft=seat.picks<3?{player:id,picks:seat.picks,choices:clone(seat.choices)}:null;
      game.preparation={ready:seat.ready,players:state.preparation.seats.map((p,id)=>({id,picks:p.picks,ready:p.ready}))};
      preparation={epoch:preparationEpoch(room,state),revision:seat.revision};
    }
  }
  return {code: room.code, revision: room.revision, playerId: id, hostId: room.hostId,
    members: room.members.map((p, i) => ({id: i, name: p.name,bot:Boolean(p.bot)})), game,
    preparation,expiresAt: room.updatedAt + TTL};
}

export function createRoomService(store, {now = Date.now, seed = () => crypto.getRandomValues(new Uint32Array(1))[0]} = {}) {
  async function read(code) {
    validateCode(code);
    const room = await store.get(code);
    requireRoom(room && room.updatedAt + TTL > now(), 'Sala não encontrada ou expirada. Confira o código.', 404);
    return room;
  }
  async function mutate(code, change) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const room = await read(code), previous = room.revision;
      const result = change(room);
      if (result.unchanged) return result.value;
      room.revision++;
      room.updatedAt = now();
      if (await store.update(room, previous)) return result.view ? roomView(room, result.id) : result.value;
    }
    throw new RoomError('A sala está recebendo outras ações. Tente novamente.', 409);
  }
  return {
    async create(code, name, token) {
      validateCode(code);
      const hash = await tokenHash(token);
      const profile=await store.ensureProfile(playerName(name),now());
      const room = {code, revision: 0, hostId: 0, members: [{name: profile.name, hash}], game: null,
        receipts: [], updatedAt: now()};
      if (await store.insert(room)) return roomView(room, 0);
      const existing = await read(code);
      requireRoom(existing.members[0]?.hash === hash, 'Este código já existe. Crie outra sala.', 409);
      return roomView(existing, 0);
    },
    async join(code, name, token) {
      const hash = await tokenHash(token), cleanName = playerName(name);
      const profile=await store.ensureProfile(cleanName,now());
      return mutate(code, room => {
        const existing = room.members.findIndex(p => p.hash === hash);
        if (existing >= 0) return {unchanged: true, value: roomView(room, existing)};
        requireRoom(!room.game, 'Esta partida já começou. Só os participantes podem retomá-la.', 409);
        requireRoom(room.members.length < 4, 'Sala cheia: o limite é de 4 jogadores.', 409);
        requireRoom(!room.members.some(p => profileKey(p.name) === profileKey(cleanName)), 'Já existe um jogador com esse nome. Use outro nome.');
        room.members.push({name: profile.name, hash});
        return {view: true, id: room.members.length - 1};
      });
    },
    async get(code, token) {
      const hash = await tokenHash(token), room = await read(code);
      return roomView(room, playerId(room, hash));
    },
    async command(code, token, input) {
      const hash = await tokenHash(token);
      requireRoom(input && COMMAND.test(input.commandId ?? '') && Number.isSafeInteger(input.revision) && input.revision >= 0, 'Comando inválido. Atualize a sala.');
      requireRoom(input.action && typeof input.action.type === 'string', 'Ação inválida.');
      const action = pick(input.action, ['type', 'id', 'slot', 'reorder']);
      const signature = JSON.stringify(action);
      return mutate(code, room => {
        if(room.game)room.game=prepareTogether(room.game);
        const receipt = room.receipts.find(r => r.hash === hash && r.commandId === input.commandId);
        if (receipt) {
          requireRoom(receipt.signature === signature, 'O identificador deste comando já foi usado.', 409);
          return {unchanged: true, value: action.type === 'LEAVE' ? {left: true} : roomView(room, playerId(room, hash))};
        }
        const id = playerId(room, hash);
        if(input.preparation) {
          const seat=room.game?.preparation?.seats[id];
          requireRoom(seat&&input.preparation.epoch===preparationEpoch(room,room.game)&&input.preparation.revision===seat.revision,
            'Sua preparação mudou. Confira seu robô antes de tentar novamente.',409);
        } else requireRoom(input.revision === room.revision, 'A partida avançou. A sala será atualizada; confira sua próxima ação.', 409);
        if(action.type==='ADD_BOT'||action.type==='REMOVE_BOT') {
          requireRoom(id===room.hostId,'Somente o criador da sala pode adicionar ou remover bots.',403);
          requireRoom(!room.game,'Adicione ou remova bots antes de iniciar a partida.',409);
          if(action.type==='ADD_BOT') {
            requireRoom(room.members.length<4,'Sala cheia: o limite é de 4 participantes.',409);
            let number=1,name;
            do{name=`Bot ${String(number++).padStart(2,'0')}`;}while(room.members.some(p=>profileKey(p.name)===profileKey(name)));
            room.members.push({name,bot:true});
          } else {
            const target=Number(action.id);
            requireRoom(Number.isInteger(target)&&target>=0&&room.members[target]?.bot,'Selecione um bot desta sala.');
            room.members.splice(target,1);
            if(target<room.hostId)room.hostId--;
          }
        } else if (action.type === 'START' || action.type === 'REMATCH') {
          requireRoom(id === room.hostId, 'Somente o criador da sala pode iniciar a partida.', 403);
          requireRoom(action.type === 'START' ? !room.game : room.game?.phase === 'gameover', 'A partida já está em andamento.', 409);
          requireRoom(room.members.length >= 2, 'Aguarde pelo menos mais um jogador.');
          room.game = initializeRoomBots(prepareTogether(newGame(room.members.map(p => p.name), seed())),room.members);
          room.matchId=crypto.randomUUID();
        } else if (action.type === 'LEAVE') {
          requireRoom(!room.game, 'A partida começou. Sua vaga fica reservada para reconexão.', 409);
          room.members.splice(id, 1);
          if(!room.members.some(p=>!p.bot)){room.members=[];room.hostId=0;}
          else if(room.hostId===id)room.hostId=room.members.findIndex(p=>!p.bot);
          else if(room.hostId>id)room.hostId--;
          room.receipts.push({hash, commandId: input.commandId, signature});
          room.receipts = room.receipts.slice(-128);
          return {value: {left: true}};
        } else {
          requireRoom(room.game, 'Aguarde o início da partida.', 409);
          if (['ROLL', 'NEXT_ARENA'].includes(action.type)) {
            requireRoom(id === room.hostId, 'O criador da sala conduz as rolagens e a próxima arena.', 403);
          } else {
            requireRoom(PLAYER_ACTIONS.has(action.type), 'Ação desconhecida.');
            const improvement=['UNLOCK','UPGRADE'].includes(action.type);
            requireRoom(room.game.preparation||improvement||currentPlayer(room.game)?.id === id, 'Aguarde sua vez de jogar.', 403);
          }
          try {
            let next = recordMarketAction(room.game, act(room.game, action, id), {...action,playerId:id});
            if (action.type === 'BUY') next = act(next, {type: 'END_TURN'});
            room.game = rememberArena(validateState(prepareTogether(next)));
          } catch (error) {throw new RoomError(error.message);}
        }
        if(room.game) {
          try{room.game=advanceRoomBots(room.game,room.members);}catch(error){throw new RoomError(error.message);}
        }
        room.receipts.push({hash, commandId: input.commandId, signature});
        room.receipts = room.receipts.slice(-128);
        return {view: true, id:playerId(room,hash)};
      });
    }
  };
}
