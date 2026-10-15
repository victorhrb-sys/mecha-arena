import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as engine from '../dist/engine.js';
import * as icons from '../dist/icons.js';
import * as playback from '../dist/arena-playback.js';
import * as dice from '../dist/dice-presentation.js';
import * as cycle from '../dist/market-cycle.js';
import * as marketPresentation from '../dist/market-presentation.js';
import * as solo from '../dist/solo.js';
import {chooseAction,decisionView} from '../dist/bots.js';
import {roomView} from '../multiplayer/rooms.mjs';
import {initializeRoomBots,advanceRoomBots} from '../multiplayer/room-bots.mjs';

function ui({command,landing=false,storage=new Map(),search='',session=null,profile={id:'test',name:'Piloto',stats:{matches:0,wins:0,losses:0,arenaWins:0,winRate:0},history:[]}}={}) {
  const app = {innerHTML: '', querySelector: () => null, querySelectorAll: () => []};
  const dialog = {open: false, innerHTML: '', showModal() {this.open = true;}, close() {this.open = false;}};
  const tasks = new Map(), listeners = new Map(); let next = 0;
  const context = vm.createContext({...engine, ...solo, ...icons, ...playback, ...dice, ...cycle, ...marketPresentation, URLSearchParams, crypto, performance, history:{replaceState(){}},
    createPlaybackClock:()=>playback.createPlaybackClock({schedule:fn=>{tasks.set(++next,fn);return next;},cancel:id=>tasks.delete(id)}),
    setTimeout: fn => {tasks.set(++next, fn); return next;}, clearTimeout: id => tasks.delete(id),
    localStorage: {getItem: key => storage.get(key)??null, setItem(key,value) {storage.set(key,value);}}, location: {origin: 'http://localhost', pathname: '/', search}, navigator: {},
    window: {matchMedia: () => ({matches: true}), addEventListener() {}},
    document: {activeElement: null, querySelectorAll: () => [], querySelector: selector => selector === '#app' ? app : selector === '#dialog' ? dialog : {}, addEventListener(name, fn) {listeners.set(name, [...listeners.get(name) ?? [], fn]);}},
    createRoomClient: () => ({session,command,pause(){}}),
    createProfileClient: () => ({get profile(){return profile;},select:async name=>{profile={id:'test',name,stats:{matches:0,wins:0,losses:0,arenaWins:0,winRate:0},history:[]};return profile;},refresh:async()=>profile,clear(){profile=null;}}),
  });
  const source = readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
  vm.runInContext(source, context);
  if(!landing)vm.runInContext("mode='multiplayer';render();",context);
  return {app, dialog, context, emit(name,event={}) {for(const fn of listeners.get(name) ?? []) fn(event);}, show(view) {context.testView = view; vm.runInContext("mode='multiplayer';home=true; playback=null; online=true; receiveRoom(testView);", context); return app.innerHTML;},
    animate() {vm.runInContext('animateRoll()', context); let limit = 100; while (tasks.size && limit--) {const [id, task] = tasks.entries().next().value; tasks.delete(id); task();} assert.ok(limit > 0);}};
}

function click(surface,action){
  const el={dataset:{action},disabled:false};
  surface.emit('click',{target:{closest:selector=>selector==='[data-action]'?el:null},preventDefault(){}});
}

test('histórico da loja mostra a ordem durante compras e continua abrindo após a fase',()=>{
  const surface=ui(),room={code:'ABC234',revision:1,hostId:0,members:[{name:'Ana'},{name:'Beto'}],game:engine.newGame(['Ana','Beto'],19)};
  room.game.deck.push(...room.game.draft.choices);room.game.phase='market';room.game.draft=null;
  room.game.market={cards:[],order:[0,1,1,0],turn:1,choiceDone:false};
  surface.show(roomView(room,0));
  vm.runInContext('showMarketLog()',surface.context);
  assert.match(surface.dialog.innerHTML,/Ordem das escolhas da loja/);
  assert.match(surface.dialog.innerHTML,/aria-current="step"/);
  room.game.phase='assembly';room.game.market=null;
  surface.show(roomView(room,0));
  assert.doesNotThrow(()=>vm.runInContext('showMarketLog()',surface.context));
  assert.match(surface.dialog.innerHTML,/Decisões da loja/);
  assert.doesNotMatch(surface.dialog.innerHTML,/Ordem das escolhas da loja/);
});

test('landing não retoma sala automaticamente; solo funciona sem perfil ou chamadas online e retoma após recarregar',async()=>{
  const storage=new Map();let calls=0;
  const surface=ui({landing:true,profile:null,storage,session:{code:'ABC234',name:'Ana'},command:()=>{calls++;}});
  assert.match(surface.app.innerHTML,/Single player/);assert.match(surface.app.innerHTML,/Multiplayer/);
  assert.doesNotMatch(surface.app.innerHTML,/Criar sala|Escolha seu nome de usuário/);
  click(surface,'choose-solo');assert.match(surface.app.innerHTML,/value="3" selected/);
  surface.emit('input',{target:{matches:()=>true,dataset:{nameIndex:'0'},value:'Ana'}});
  surface.emit('submit',{target:{id:'solo-form'},preventDefault(){}});
  assert.match(surface.app.innerHTML,/<b>Ana<\/b>/);
  let steps=0;
  while(vm.runInContext('game.phase',surface.context)!=='gameover'&&steps++<4000){
    const game=vm.runInContext('game',surface.context);
    surface.context.testAction=game.phase==='arena'?{type:'ROLL'}:game.phase==='result'?{type:'NEXT_ARENA'}:chooseAction(decisionView(game));
    await vm.runInContext('dispatch(testAction)',surface.context);
    vm.runInContext('playbackClock.cancel();playback=null;if(marketPlayback)finishMarketPlayback();render();',surface.context);
    assert.doesNotMatch(surface.app.innerHTML,/undefined|Reconectando/);
  }
  assert.ok(steps<4000);assert.equal(calls,0);
  const saved=storage.get(solo.SOLO_SAVE_KEY);assert.ok(saved);
  click(surface,'home');assert.match(surface.app.innerHTML,/Modos de jogo/);
  vm.runInContext('receiveRoom({})',surface.context);assert.match(surface.app.innerHTML,/Modos de jogo/);
  const resumed=ui({landing:true,profile:null,storage});click(resumed,'choose-solo');
  assert.match(resumed.app.innerHTML,/data-action="resume-solo"/);click(resumed,'resume-solo');
  assert.equal(vm.runInContext('game.phase',resumed.context),'gameover');
  await vm.runInContext("dispatch({type:'REMATCH'})",resumed.context);
  assert.equal(vm.runInContext('game.players.length',resumed.context),4);
  assert.equal(vm.runInContext('game.phase',resumed.context),'draft');
});

test('convite abre multiplayer e salvamento corrompido permite nova partida',()=>{
  const invited=ui({landing:true,profile:null,search:'?sala=ABC234'});
  assert.match(invited.app.innerHTML,/<h1>Multiplayer<\/h1>/);
  assert.match(invited.app.innerHTML,/ABC234/);
  const surface=ui({landing:true,profile:null,storage:new Map([[solo.SOLO_SAVE_KEY,'invalid']])});
  click(surface,'choose-solo');assert.match(surface.app.innerHTML,/Não foi possível recuperar/);
  assert.match(surface.app.innerHTML,/>Jogar<\/button>/);
});

test('Laboratório entra sem rede, preserva solo, retoma carga e mostra crítico somente com efeito',async()=>{
  const normal=solo.startSolo('Normal',1,4),storage=new Map([[solo.SOLO_SAVE_KEY,engine.serialize(normal)]]);
  const surface=ui({landing:true,profile:null,storage,command(){throw new Error('Laboratório não usa rede');}});
  click(surface,'choose-laboratory');assert.match(surface.app.innerHTML,/<h1>Laboratório<\/h1>/);
  surface.emit('input',{target:{matches:()=>true,dataset:{nameIndex:'0'},value:'Teste <b>'}});
  surface.emit('submit',{target:{id:'solo-form'},preventDefault(){}});
  assert.match(surface.app.innerHTML,/<b>Teste &lt;b&gt;<\/b>/);
  assert.match(surface.app.innerHTML,/Você já tem um Canhão e um Propulsor/);
  assert.match(surface.app.innerHTML,/\/ 1 escolha/);assert.doesNotMatch(surface.app.innerHTML,/três escolhas/);
  assert.match(surface.app.innerHTML,/Equipamentos iniciais/);assert.match(surface.app.innerHTML,/class="charge-icon"/);
  assert.equal(storage.get(solo.SOLO_SAVE_KEY),engine.serialize(normal));assert.ok(storage.has(solo.LAB_SAVE_KEY));
  let s=vm.runInContext('game',surface.context);s=structuredClone(s);s.deck.push(...s.draft.choices);s.draft=null;s.phase='arena';
  for(const p of s.players){p.charge=6;const ix=s.deck.findIndex(c=>c.type==='Q');p.modules[0]=s.deck.splice(ix,1)[0];p.hp=p.maxHp=2;}
  const ix=s.deck.findIndex(c=>c.type==='K');s.players[0].modules[1]=s.deck.splice(ix,1)[0];
  s=engine.resolveRoll(s,[[1,1],[4,5],[6,6],[2,3]]);
  surface.context.labFixture=s;
  vm.runInContext('enterSolo(labFixture);animateRoll()',surface.context);
  assert.match(surface.app.innerHTML,/<strong>CRÍTICO<\/strong>/);assert.doesNotMatch(surface.app.innerHTML,/CRÍTICO —/);
  assert.equal(vm.runInContext("document.querySelector('#app').innerHTML.includes('undefined')",surface.context),false);
  assert.match(surface.app.innerHTML,/Sem efeito/);
  assert.match(surface.app.innerHTML,/charge-gain/);assert.match(surface.app.innerHTML,/aria-label="\+2 cargas"/);
  const healing=vm.runInContext('playback',surface.context);
  vm.runInContext('playback={eventIndex:0};',surface.context);
  assert.match(vm.runInContext('resourceBadge(game.players[0])',surface.context),/aria-label="\+3 cargas"/);
  surface.context.restorePlayback=healing;vm.runInContext('playback=restorePlayback',surface.context);
  assert.equal((surface.app.innerHTML.match(/class="dice-cube /g)??[]).length,8);
  const stored=storage.get(solo.LAB_SAVE_KEY);surface.animate();assert.equal(storage.get(solo.LAB_SAVE_KEY),stored);
  click(surface,'home');click(surface,'choose-solo');assert.match(surface.app.innerHTML,/Normal · Arena/);
  click(surface,'home');click(surface,'choose-laboratory');click(surface,'resume-solo');
  assert.equal(vm.runInContext('game.players[0].charge',surface.context),3);
  assert.equal(vm.runInContext('mode',surface.context),'laboratory');
  click(surface,'menu');assert.match(surface.dialog.innerHTML,/Progresso salvo/);
  click(surface,'rules');assert.match(surface.dialog.innerHTML,/mesmo alvo enquanto possível/);
});

test('escolhas de bots avançam visualmente, bloqueiam comandos e aplicam atualizações recebidas ao terminar',async()=>{
  let calls=0;
  const surface=ui({command:async()=>{calls++;}}),members=[{name:'Ana'},{name:'Bot 1',bot:true},{name:'Beto'},{name:'Bot 3',bot:true}];
  const s=initializeRoomBots(engine.newGame(members.map(p=>p.name),45),members);
  s.deck.push(...s.draft.choices);s.draft=null;s.phase='market';s.reference=3;
  s.market={cards:s.deck.splice(0,8),order:engine.purchaseOrder(4,3),turn:3,choiceDone:false};
  for(const p of s.players)p.scrap=30;
  const room={code:'ABC234',revision:1,hostId:0,updatedAt:0,members,game:s};
  surface.show(roomView(room,2));room.game=advanceRoomBots(s,members);room.revision++;
  surface.context.testView=roomView(room,2);vm.runInContext('receiveRoom(testView)',surface.context);
  assert.match(surface.app.innerHTML,/Compras dos bots/);assert.match(surface.app.innerHTML,/Bot 3 · 1ª escolha/);
  assert.match(surface.app.innerHTML,/Comprado ✓|Passou/);
  await vm.runInContext("dispatch({type:'END_TURN'})",surface.context);assert.equal(calls,0);
  vm.runInContext('marketPlayback.index=1;render()',surface.context);assert.match(surface.app.innerHTML,/Bot 3 · 2ª escolha/);
  room.revision++;surface.context.testView=roomView(room,2);vm.runInContext('receiveRoom(testView)',surface.context);
  assert.equal(vm.runInContext('room.revision',surface.context),2);
  vm.runInContext('finishMarketPlayback()',surface.context);
  assert.equal(vm.runInContext('room.revision',surface.context),3);
  assert.equal(vm.runInContext('marketPlayback',surface.context),null);
  assert.match(surface.app.innerHTML,/Você · 2ª escolha/);
  assert.doesNotMatch(surface.app.innerHTML,/Compras dos bots/);
  vm.runInContext('receiveRoom(testView)',surface.context);assert.equal(vm.runInContext('marketPlayback',surface.context),null);
});

test('a interface renderiza todas as fases para cada assento e anima os resultados recebidos', () => {
  const surface = ui(); assert.match(surface.app.innerHTML, /Criar sala/); assert.match(surface.app.innerHTML, /value="join"/);
  const room = {code: 'ABC234', revision: 0, hostId: 0, updatedAt: Date.now(), members: ['Ana', 'Beto', 'Caio', 'Dora'].map(name => ({name})), game: null};
  assert.match(surface.show(roomView(room, 2)), /Aguardando Ana iniciar/);
  room.game = engine.newGame(room.members.map(p => p.name), 7314);
  const checked = new Set(); let steps = 0;
  while (room.game.phase !== 'gameover' && steps++ < 3000) {
    if (!checked.has(room.game.phase)) {
      checked.add(room.game.phase);
      for (const p of room.game.players) {
        const html = surface.show(roomView(room, p.id));
        assert.match(html, new RegExp(`<span>Você</span><b>${p.name}</b>`));
        assert.equal(html.includes('undefined'), false);
        if (room.game.phase === 'arena') {
          assert.match(html, /arena-board/);
          assert.match(html,/dice-presentation/);
          assert.equal((html.match(/class="dice-owner">Você/g)??[]).length,1);
          if (p.id !== 0) assert.match(html, /Ana conduz as rolagens/);
        }
      }
    }
    const own = engine.currentPlayer(room.game);
    const action = room.game.phase === 'arena' ? {type: 'ROLL'} : room.game.phase === 'result' ? {type: 'NEXT_ARENA'} : chooseAction({phase: room.game.phase, player: own, choices: room.game.draft?.choices ?? room.game.market?.cards ?? [], choiceDone: room.game.market?.choiceDone});
    room.game = engine.act(room.game, action); room.revision++;
    if (action.type === 'BUY') room.game = engine.act(room.game, {type: 'END_TURN'});
    if (action.type === 'ROLL' && room.game.round === 1) {
      surface.show(roomView(room, 3));surface.context.window.matchMedia=()=>({matches:steps%2===0});surface.animate();
      assert.match(surface.app.innerHTML,/Resultados dos dados/);
    }
  }
  assert.deepEqual([...checked].sort(), ['arena', 'assembly', 'draft', 'market', 'result']);
  for (const p of room.game.players) {
    const html = surface.show(roomView(room, p.id));
    if (p.id === room.game.result.winner) assert.match(html, /Você venceu a partida!/);
    else assert.match(html, /venceu a partida/);
  }
});

test('nomes recebidos da sala são escapados na tela inicial e no placar', () => {
  const surface = ui(), room = {code: 'ABC234', revision: 0, hostId: 0, updatedAt: Date.now(), members: [{name: '<img onerror=alert(1)>'}, {name: 'Beto'}], game: null};
  const html = surface.show(roomView(room, 1));
  assert.equal(html.includes('<img onerror'), false); assert.match(html, /&lt;img/);
});

test('sala mostra bots e só oferece adicionar/remover ao criador antes da partida',()=>{
  const surface=ui(),room={code:'ABC234',revision:0,hostId:0,updatedAt:Date.now(),members:[{name:'Ana'},{name:'Bot 01',bot:true},{name:'Beto'},{name:'Bot 02',bot:true}],game:null};
  const host=surface.show(roomView(room,0));
  assert.match(host,/data-action="add-bot"[^>]*disabled/);assert.match(host,/data-action="remove-bot"/);assert.match(host,/Participantes <span class="muted">4\/4/);
  const guest=surface.show(roomView(room,2));assert.equal(guest.includes('data-action="add-bot"'),false);assert.equal(guest.includes('data-action="remove-bot"'),false);
  room.game=engine.newGame(room.members.map(p=>p.name),7314);
  const playing=surface.show(roomView(room,0));assert.equal(playing.includes('data-action="add-bot"'),false);
  assert.match(vm.runInContext('standings()',surface.context),/role-tag">Bot/);
});

test('entrada pede somente nome, preserva convite e mostra salas após selecionar perfil',async()=>{
  const surface=ui({profile:null});
  vm.runInContext('joinCode="ABC234";render();',surface.context);
  assert.match(surface.app.innerHTML,/Nome de usuário/);assert.match(surface.app.innerHTML,/Sem senha/);
  assert.equal(surface.app.innerHTML.includes('type="password"'),false);assert.match(surface.app.innerHTML,/ABC234/);
  vm.runInContext('names[0]="Ana";',surface.context);
  surface.emit('submit',{target:{id:'profile-form'},preventDefault(){}});await new Promise(setImmediate);
  assert.match(surface.app.innerHTML,/class="profile-identity"/);assert.match(surface.app.innerHTML,/Ana/);
  assert.match(surface.app.innerHTML,/Criar sala/);assert.match(surface.app.innerHTML,/value="ABC234"/);
});

test('perfil apresenta estatísticas reais e escapa o nome no título e no histórico',async()=>{
  const name='<img onerror=alert(1)>',surface=ui({profile:{id:'test',name,stats:{matches:2,wins:1,losses:1,winRate:50,arenaWins:8},history:[{won:true,playedAt:Date.now(),players:[{name,points:5},{name:'Beto',points:3,bot:true}],winner:name,arenas:9,botCount:1}]}});
  await vm.runInContext('showProfile()',surface.context);
  assert.match(surface.dialog.innerHTML,/50%/);assert.match(surface.dialog.innerHTML,/Vitória/);
  assert.equal(surface.dialog.innerHTML.includes('<img onerror'),false);assert.match(surface.dialog.innerHTML,/&lt;img/);
  assert.match(surface.dialog.innerHTML,/Com 1 bot/);assert.match(surface.dialog.innerHTML,/Beto \(bot\)/);
});

test('preparação mostra montagem independente e espera somente após confirmar', () => {
  const surface=ui(), room={code:'ABC234',revision:0,hostId:0,updatedAt:Date.now(),members:[{name:'Ana'},{name:'Beto'}],game:engine.prepareTogether(engine.newGame(['Ana','Beto'],7314))};
  const apply=(action,id)=>{room.game=engine.act(room.game,action,id);room.revision++;};
  for(let n=0;n<3;n++)apply({type:'DRAFT_PICK',id:room.game.preparation.seats[0].choices[0].id},0);
  assert.match(surface.show(roomView(room,0)),/Pronto ✓/);
  assert.match(surface.show(roomView(room,0)),/Escolhendo · 0\/3/);
  assert.match(surface.show(roomView(room,1)),/Montando/);
  assert.match(surface.show(roomView(room,1)),/draft-cards/);
  for(const [slot,card] of room.game.players[0].inventory.entries())apply({type:'EQUIP',id:card.id,slot},0);
  apply({type:'CONFIRM_ASSEMBLY'},0);
  const html=surface.show(roomView(room,0));
  assert.match(html,/Aguardando os demais/);assert.match(html,/Pronto ✓/);
  assert.equal(html.includes('data-action="confirm"'),false);
  assert.match(surface.show(roomView(room,1)),/draft-cards/);
});

test('atualizações dos outros jogadores não interrompem o arraste de uma peça', () => {
  const surface=ui(), room={code:'ABC234',revision:0,hostId:0,updatedAt:Date.now(),members:[{name:'Ana'},{name:'Beto'}],game:engine.prepareTogether(engine.newGame(['Ana','Beto'],7314))};
  for(let n=0;n<3;n++)room.game=engine.act(room.game,{type:'DRAFT_PICK',id:room.game.preparation.seats[0].choices[0].id},0);
  const before=surface.show(roomView(room,0));
  surface.emit('dragstart',{target:{closest:()=>({dataset:{id:room.game.players[0].inventory[0].id},classList:{add(){}}})},dataTransfer:{setData(){}},preventDefault(){assert.fail('arraste deveria estar disponível');}});
  room.game=engine.act(room.game,{type:'DRAFT_PICK',id:room.game.preparation.seats[1].choices[0].id},1);room.revision++;
  surface.context.testView=roomView(room,0);vm.runInContext('receiveRoom(testView);render();',surface.context);
  assert.equal(surface.app.innerHTML,before);
  surface.emit('dragend');assert.match(surface.app.innerHTML,/Escolhendo · 1\/3/);
});

test('consulta e histórico usam o assento local e continuam acessíveis durante a espera',()=>{
  const surface=ui(),room={code:'ABC234',revision:0,hostId:0,updatedAt:Date.now(),members:[{name:'Ana'},{name:'Beto'},{name:'Caio'}],game:engine.newGame(['Ana','Beto','Caio'],7314)};
  const s=room.game;s.deck.push(...s.draft.choices);s.draft=null;s.phase='market';s.round=2;
  s.market={cards:s.deck.splice(0,3),order:[0,1,2],turn:0,choiceDone:false};
  s.botMemory={round:1,players:s.players.map(p=>({id:p.id,unlocked:3,modules:[{type:'K',upgraded:false},null,null,null,null,null]}))};
  s.marketActivity={round:2,events:[{playerId:0,type:'BUY',scrap:-3,card:{type:'A',upgraded:false}},{playerId:1,type:'PASS',scrap:0}]};
  const html=surface.show(roomView(room,1));assert.match(html,/Ana está escolhendo/);assert.match(html,/aria-label="Decisões dos adversários nesta loja"/);assert.match(html,/Comprou/);
  assert.match(html,/Ordem das escolhas da loja/);assert.match(html,/data-action="end-turn"[^>]*disabled/);
  const rows=vm.runInContext('marketActivityRows()',surface.context);assert.match(rows,/Ana/);assert.match(rows,/Caio/);assert.equal(rows.includes('Beto'),false);
  const standings=vm.runInContext('standings()',surface.context);
  assert.match(standings,/Última montagem revelada de Ana/);assert.equal(standings.includes('Última montagem revelada de Beto'),false);
  assert.match(standings,/Módulo 1: Propulsor/);
  vm.runInContext('showMarketActivity=false;render();',surface.context);assert.equal(surface.app.innerHTML.includes('aria-label="Decisões dos adversários nesta loja"'),false);
  vm.runInContext('showMarketLog()',surface.context);assert.match(surface.dialog.innerHTML,/Comprou/);
  s.round=3;surface.show(roomView(room,1));assert.equal(vm.runInContext('marketEvents().length',surface.context),0);
});

test('construção visível na loja funciona durante a escolha de outro humano',async()=>{
  const actions=[],surface=ui({command:async action=>actions.push(action)});
  const room={code:'ABC234',revision:0,hostId:0,updatedAt:0,members:[{name:'Ana'},{name:'Beto'}],game:engine.newGame(['Ana','Beto'],7314)};
  const s=room.game;s.deck.push(...s.draft.choices);s.draft=null;s.phase='market';
  s.market={cards:s.deck.splice(0,4),order:[0,1,1,0],turn:0,choiceDone:false};s.players[1].scrap=30;
  surface.show(roomView(room,1));
  const element={disabled:false,dataset:{action:'unlock',slot:'3'}};
  surface.emit('click',{target:{closest:selector=>selector==='[data-action]'?element:null},preventDefault(){}});
  await new Promise(setImmediate);
  assert.equal(actions.length,1);assert.equal(actions[0].type,'UNLOCK');
});

test('consulta na arena inclui o anfitrião como adversário para os convidados',()=>{
  const surface=ui(),room={code:'ABC234',revision:0,hostId:0,updatedAt:Date.now(),members:[{name:'Ana'},{name:'Beto'}],game:engine.newGame(['Ana','Beto'],7314)};
  const s=room.game;s.deck.push(...s.draft.choices);s.draft=null;s.phase='arena';
  s.players.forEach(p=>{p.modules[0]=s.deck.pop();});
  surface.show(roomView(room,1));
  const html=vm.runInContext('board(visiblePlayers())',surface.context);
  assert.match(html,/data-action="arena-inspect" data-id="0"/);assert.equal(html.includes('data-action="arena-inspect" data-id="1"'),false);
  assert.match(html,/hp-amount/);
  const preview=vm.runInContext('opponentPreview(game.players[0],{arena:true,contentOnly:true})',surface.context);
  assert.match(preview,/Ana · Arena 1/);assert.match(preview,/Módulo 1:/);
});

test('menu de melhorias aguarda confirmação online e bloqueia cliques repetidos',async()=>{
  let release,calls=0;const surface=ui({command:()=>{calls++;return new Promise(resolve=>release=resolve);}});
  const room={code:'ABC234',revision:0,hostId:0,updatedAt:Date.now(),members:[{name:'Ana'},{name:'Beto'}],game:engine.prepareTogether(engine.newGame(['Ana','Beto'],97241))};
  for(let n=0;n<3;n++)room.game=engine.act(room.game,{type:'DRAFT_PICK',id:room.game.preparation.seats[1].choices[0].id},1);
  room.game.players[1].scrap=30;surface.show(roomView(room,1));
  const pending=vm.runInContext("improve({type:'UNLOCK'})",surface.context);
  assert.match(surface.dialog.innerHTML,/data-action="improve-slot"[^>]*disabled/);
  await vm.runInContext("improve({type:'UNLOCK'})",surface.context);assert.equal(calls,1);
  room.game=engine.act(room.game,{type:'UNLOCK'},1);room.revision++;
  surface.context.nextView=roomView(room,1);vm.runInContext('receiveRoom(nextView)',surface.context);release();await pending;
  assert.match(surface.dialog.innerHTML,/Construir módulo 5/);assert.match(surface.dialog.innerHTML,/26 sucatas/);
  assert.equal(/data-action="improve-slot"[^>]*disabled/.test(surface.dialog.innerHTML),false);
  room.game.preparation.seats[1].ready=true;surface.context.nextView=roomView(room,1);vm.runInContext('receiveRoom(nextView)',surface.context);
  assert.match(surface.dialog.innerHTML,/data-action="improve-slot"[^>]*disabled/);
});
