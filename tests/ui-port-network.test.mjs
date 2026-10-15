import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomService} from '../multiplayer/rooms.mjs';
import {localStore} from '../multiplayer/local-store.mjs';
import {validateState} from '../dist/engine.js';

const code='UXP234',token=id=>(id+1).toString(16).padStart(64,'0');let sequence=0;
async function fixture(t,bots=false){
  const db=localStore(':memory:');t.after(db.close);
  const service=createRoomService(db.store,{seed:()=>97241});
  const get=id=>service.get(code,token(id));
  const send=(id,view,action,commandId=(++sequence).toString(16).padStart(32,'0'))=>service.command(code,token(id),{revision:view.revision,preparation:view.preparation,commandId,action});
  await service.create(code,'Ana',token(0));await service.join(code,'Beto',token(1));
  if(bots)await send(0,await get(0),{type:'ADD_BOT'});
  await send(0,await get(0),{type:'START'});
  return {db,get,send};
}

test('inserção do convidado atravessa o servidor, preserva ordem, sigilo e reenvio',async t=>{
  const f=await fixture(t);let view=await f.get(1);
  for(let n=0;n<3;n++)view=await f.send(1,view,{type:'DRAFT_PICK',id:view.game.draft.choices[0].id});
  let slot=0;while(view.game.players[1].inventory.length)view=await f.send(1,view,{type:'EQUIP',id:view.game.players[1].inventory[0].id,slot:slot++});
  const before=view,ids=view.game.players[1].modules.map(c=>c?.id??null),moving=ids.findLast(Boolean);
  const receipt='e'.repeat(32),action={type:'EQUIP',id:moving,slot:0,reorder:true};
  // Another seat can act while this command still uses its own preparation stamp.
  const host=await f.get(0);await f.send(0,host,{type:'DRAFT_PICK',id:host.game.draft.choices[0].id});
  view=await f.send(1,before,action,receipt);
  const expected=[...ids];expected.splice(expected.indexOf(moving),1);expected.unshift(moving);
  assert.deepEqual(view.game.players[1].modules.map(c=>c?.id??null),expected);
  assert.deepEqual(await f.send(1,before,action,receipt),view);
  await assert.rejects(f.send(1,before,{...action,reorder:false},receipt),e=>e.status===409);
  const other=await f.get(0);assert.deepEqual(other.game.players[1].modules,Array(6).fill(null));
  assert.equal(other.game.marketActivity,null);validateState((await f.db.store.get(code)).game);
});

test('histórico público registra humanos e bots uma vez, permanece após reconexão e rejeita ações inválidas',async t=>{
  const f=await fixture(t,true),room=await f.db.store.get(code),s=room.game;
  for(const seat of s.preparation.seats)s.deck.push(...seat.choices);
  delete s.preparation;s.draft=null;s.phase='market';s.round=2;
  s.market={cards:s.deck.splice(0,6),order:[0,2,1,1,2,0],turn:0,choiceDone:false};
  s.players.forEach(p=>p.scrap=30);validateState(s);room.revision++;
  assert.equal(await f.db.store.update(room,room.revision-1),true);
  const before=await f.get(0),card=before.game.market.cards[0],receipt='f'.repeat(32);
  const action={type:'BUY',id:card.id};
  await assert.rejects(f.send(1,await f.get(1),action),e=>e.status===403);
  const after=await f.send(0,before,action,receipt),events=after.game.marketActivity.events;
  assert.deepEqual(events[0],{playerId:0,type:'BUY',scrap:-3,card:{type:card.type,upgraded:card.upgraded}});
  assert.equal(events.filter(e=>e.playerId===0).length,1);
  assert.ok(events.some(e=>e.playerId===2));
  assert.deepEqual(await f.send(0,before,action,receipt),after);
  const guest=await f.get(1);assert.deepEqual(guest.game.marketActivity,after.game.marketActivity);
  assert.deepEqual(guest.game.players[0].inventory,[]);
  assert.deepEqual(guest.game.players[0].modules,Array(6).fill(null));
  for(const event of events){assert.ok(Object.keys(event).every(key=>['playerId','type','scrap','card','module'].includes(key)));if(event.card)assert.deepEqual(Object.keys(event.card).sort(),['type','upgraded']);}
  const saved=await f.db.store.get(code);validateState(saved.game);
  assert.deepEqual(saved.game.marketActivity,after.game.marketActivity);
});

test('melhorias simultâneas pertencem à sessão e ficam bloqueadas depois de confirmar',async t=>{
  const f=await fixture(t);let view=await f.get(1);
  for(let n=0;n<3;n++)view=await f.send(1,view,{type:'DRAFT_PICK',id:view.game.draft.choices[0].id});
  let slot=0;while(view.game.players[1].inventory.length)view=await f.send(1,view,{type:'EQUIP',id:view.game.players[1].inventory[0].id,slot:slot++});
  const room=await f.db.store.get(code);room.game.players.forEach(p=>p.scrap=30);room.revision++;await f.db.store.update(room,room.revision-1);
  view=await f.send(1,await f.get(1),{type:'UNLOCK',playerId:0});
  assert.equal(view.game.players[1].unlocked,4);assert.equal(view.game.players[1].scrap,26);assert.equal(view.game.players[0].unlocked,3);assert.equal(view.game.sharedPhase,'draft');
  const own=view.game.players[1].modules.find(c=>c&&!c.upgraded);
  view=await f.send(1,view,{type:'UPGRADE',id:own.id,playerId:0});
  assert.equal(view.game.players[1].scrap,14);assert.equal(view.game.players[1].modules.find(c=>c?.id===own.id).upgraded,true);
  assert.equal(view.game.marketActivity,null);
  view=await f.send(1,view,{type:'CONFIRM_ASSEMBLY'});
  await assert.rejects(f.send(1,view,{type:'UNLOCK'}),/confirmada/);
  assert.equal((await f.get(1)).game.players[1].scrap,14);
});

test('construção fora da vez na loja não altera a ordem de compras nem o jogador da vez',async t=>{
  const f=await fixture(t),room=await f.db.store.get(code),s=room.game;
  for(const seat of s.preparation.seats)s.deck.push(...seat.choices);
  delete s.preparation;s.draft=null;s.phase='market';s.market={cards:s.deck.splice(0,3),order:[0,1,1,0],turn:0,choiceDone:false};
  s.players.forEach(p=>p.scrap=30);room.revision++;await f.db.store.update(room,room.revision-1);
  const view=await f.send(1,await f.get(1),{type:'UNLOCK',playerId:0});
  assert.equal(view.game.players[0].scrap,30);assert.equal(view.game.players[1].scrap,26);assert.equal(view.game.market.turn,0);
  assert.deepEqual(view.game.marketActivity.events,[{playerId:1,type:'UNLOCK',scrap:-4,module:4}]);
  await assert.rejects(f.send(1,view,{type:'BUY',id:view.game.market.cards[0].id}),e=>e.status===403);
});
