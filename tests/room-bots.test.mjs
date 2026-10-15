import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createRoomService} from '../multiplayer/rooms.mjs';
import {localStore} from '../multiplayer/local-store.mjs';
import {createProfileService,profileKey} from '../multiplayer/profiles.mjs';
import {initializeRoomBots,roomBotDecisionView} from '../multiplayer/room-bots.mjs';
import {chooseAction} from '../dist/bots.js';
import {currentPlayer,newGame,prepareTogether,validateState,serialize,deserialize} from '../dist/engine.js';

const code='BTX234',token=id=>(id+1).toString(16).padStart(64,'0');let sequence=0;
const commandId=()=> (++sequence).toString(16).padStart(32,'0');
async function fixture(t,{humans=1,bots=0}={}) {
  const db=localStore(':memory:');t.after(db.close);
  const service=createRoomService(db.store,{seed:()=>7314+humans*100+bots});
  const get=id=>service.get(code,token(id));
  const send=(id,view,action,receipt=commandId())=>service.command(code,token(id),{revision:view.revision,preparation:view.preparation,commandId:receipt,action});
  await service.create(code,'Pessoa 0',token(0));
  for(let i=0;i<bots;i++)await send(0,await get(0),{type:'ADD_BOT'});
  // Interleaved room seats exercise human players after bot slots.
  for(let i=1;i<humans;i++)await service.join(code,'Pessoa '+i,token(i));
  return {db,service,get,send};
}

for(const [humans,bots] of [[1,1],[1,2],[1,3],[2,1],[2,2],[3,1]])test(`${humans} humanos e ${bots} bots completam partida, gravam estatísticas humanas e mantêm bots na revanche`,async t=>{
  const f=await fixture(t,{humans,bots});
  let view=await f.send(0,await f.get(0),{type:'START'}),steps=0;
  assert.equal(view.game.draft.picks,0);
  assert.ok(view.game.preparation.players.filter(p=>view.members[p.id].bot).every(p=>p.ready));
  assert.ok(view.game.players.filter(p=>p.bot).every(p=>p.modules.every(c=>c===null)&&p.inventory.length===0));
  while(view.game.phase!=='gameover'&&steps++<2500){
    const seat=view.game.preparation?.players.find(p=>!p.ready)?.id??currentPlayer(view.game)?.id??view.hostId;
    assert.equal(view.members[seat].bot,false,'o servidor nunca deve parar aguardando um bot');
    const id=Number(view.members[seat].name.split(' ').at(-1)),local=await f.get(id),s=local.game;
    const action=s.phase==='arena'?{type:'ROLL'}:s.phase==='result'?{type:'NEXT_ARENA'}:chooseAction({phase:s.phase,player:s.players[seat],choices:s.draft?.choices??s.market?.cards??[],choiceDone:s.market?.choiceDone??false});
    const receipt=commandId();view=await f.send(id,local,action,receipt);
    const saved=await f.db.store.get(code);validateState(saved.game);
    if(steps%13===0){assert.deepEqual(await f.send(id,local,action,receipt),view);assert.deepEqual(deserialize(serialize(saved.game)),saved.game);}
    assert.equal(JSON.stringify(view).includes('"skill"'),false);assert.equal('rng' in view.game,false);
  }
  assert.ok(steps<2500);
  const profiles=createProfileService(f.db.store);
  for(let id=0;id<humans;id++){
    const profile=await profiles.get('Pessoa '+id),seat=view.members.findIndex(p=>p.name==='Pessoa '+id);
    assert.equal(profile.stats.matches,1);assert.equal(profile.stats.wins,Number(seat===view.game.result.winner));
    assert.equal(profile.history[0].botCount,bots);assert.equal(profile.history[0].players.filter(p=>p.bot).length,bots);
  }
  for(const bot of view.members.filter(p=>p.bot))assert.equal(await f.db.store.findProfile(profileKey(bot.name)),undefined);
  view=await f.send(0,await f.get(0),{type:'REMATCH'});
  assert.equal(view.members.filter(p=>p.bot).length,bots);assert.equal(view.game.draft.picks,0);
  assert.equal((await profiles.get('Pessoa 0')).stats.matches,1);
});

test('somente o criador adiciona/remove bots, respeitando lotação, início e reenvio idempotente',async t=>{
  const f=await fixture(t,{humans:2});let view=await f.get(0);
  await assert.rejects(f.send(1,view,{type:'ADD_BOT'}),error=>error.status===403);
  const receipt=commandId(),twice=await Promise.all([f.send(0,view,{type:'ADD_BOT'},receipt),f.send(0,view,{type:'ADD_BOT'},receipt)]);
  assert.deepEqual(twice[0],twice[1]);view=twice[0];assert.equal(view.members.length,3);
  await assert.rejects(f.send(1,view,{type:'REMOVE_BOT',id:'2'}),error=>error.status===403);
  await assert.rejects(f.send(0,view,{type:'REMOVE_BOT',id:'1'}),error=>error.status===400);
  view=await f.send(0,view,{type:'ADD_BOT'});await assert.rejects(f.send(0,view,{type:'ADD_BOT'}),error=>error.status===409);
  await assert.rejects(f.service.join(code,'Outro',token(3)),error=>error.status===409);
  view=await f.send(0,view,{type:'REMOVE_BOT',id:'2'});assert.equal(view.members.length,3);
  view=await f.send(0,view,{type:'START'});
  await assert.rejects(f.send(0,view,{type:'ADD_BOT'}),error=>error.status===409);
  await assert.rejects(f.send(0,view,{type:'REMOVE_BOT',id:'2'}),error=>error.status===409);
});

test('criador que sai é substituído por humano, remoção de bot corrige assentos e saída do último humano limpa os bots',async t=>{
  const f=await fixture(t,{humans:2,bots:2});
  await f.send(0,await f.get(0),{type:'LEAVE'});let view=await f.get(1);
  assert.equal(view.playerId,2);assert.equal(view.hostId,2);assert.equal(view.members[0].bot,true);
  view=await f.send(1,view,{type:'REMOVE_BOT',id:'0'});assert.equal(view.playerId,1);assert.equal(view.hostId,1);
  await f.send(1,view,{type:'LEAVE'});
  const saved=await f.db.store.get(code);assert.equal(saved.members.length,0);
  view=await f.service.join(code,'Nova pessoa',token(2));assert.equal(view.hostId,0);assert.equal(view.members.length,1);
});

test('bots não veem escolhas ou montagens privadas e não alteram a visão humana ao decidir',()=>{
  const members=[{name:'Ana'},{name:'Bot 01',bot:true}];
  const state=initializeRoomBots(prepareTogether(newGame(members.map(p=>p.name),7314)),members);
  const original=structuredClone(state),view=roomBotDecisionView(state,1),altered=structuredClone(state);
  altered.rng=1;altered.deck.reverse();altered.preparation.seats[0].choices=[];altered.players[0].modules.fill({id:'secret'});
  assert.deepEqual(roomBotDecisionView(altered,1),view);assert.equal('rng' in view,false);assert.equal('deck' in view,false);
  view.choices.pop();view.player.inventory.push({id:'not-real'});assert.deepEqual(state,original);
});

test('nomes de bots não colidem com humanos da sala nem ganham estatísticas de perfis homônimos',async t=>{
  const db=localStore(':memory:');t.after(db.close);const service=createRoomService(db.store);
  let view=await service.create(code,'Bot 01',token(0));
  view=await service.command(code,token(0),{revision:view.revision,commandId:commandId(),action:{type:'ADD_BOT'}});
  assert.equal(view.members[1].name,'Bot 02');assert.equal(view.members[0].bot,false);
  const publicProfile=await db.store.ensureProfile('Bot 02',Date.now());
  const saved=await db.store.get(code);saved.game=newGame(saved.members.map(p=>p.name),7214);
  saved.game.phase='gameover';saved.game.result={winner:1};saved.game.players[1].points=5;saved.matchId='bot-winner-test';saved.revision++;
  await db.store.update(saved,saved.revision-1);
  assert.equal((await db.store.profileSummary(publicProfile.id)).stats.matches,0);
  assert.equal((await createProfileService(db.store).get('Bot 01')).stats.losses,1);
});

test('dois humanos continuam escolhendo simultaneamente com bots prontos',async t=>{
  const f=await fixture(t,{humans:2,bots:2});await f.send(0,await f.get(0),{type:'START'});
  const views=await Promise.all([f.get(0),f.get(1)]);
  await Promise.all(views.map((view,id)=>f.send(id,view,{type:'DRAFT_PICK',id:view.game.draft.choices[0].id})));
  for(let id=0;id<2;id++)assert.equal((await f.get(id)).game.draft.picks,1);
});

test('reiniciar o servidor conserva os bots e não repete suas escolhas',async t=>{
  const directory=await mkdtemp(path.join(tmpdir(),'mecha-bots-')),filename=path.join(directory,'rooms.sqlite');
  let db=localStore(filename);t.after(async()=>{db.close();await rm(directory,{recursive:true,force:true});});
  let service=createRoomService(db.store,{seed:()=>723});await service.create(code,'Ana',token(0));
  const command=async(type)=>{const view=await service.get(code,token(0));const input={commandId:commandId(),revision:view.revision,action:{type}};return {input,view:await service.command(code,token(0),input)};};
  await command('ADD_BOT');const started=await command('START'),saved=await db.store.get(code);
  db.close();db=localStore(filename);service=createRoomService(db.store);
  assert.deepEqual(await service.get(code,token(0)),started.view);
  assert.deepEqual(await service.command(code,token(0),started.input),started.view);
  assert.deepEqual(await db.store.get(code),saved);
});
