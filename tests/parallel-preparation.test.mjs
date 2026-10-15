import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomService,tokenHash} from '../multiplayer/rooms.mjs';
import {localStore} from '../multiplayer/local-store.mjs';
import {act,newGame,prepareTogether,validateState,serialize,deserialize} from '../dist/engine.js';

let sequence=0;
const token=id=>(id+1).toString(16).padStart(64,'0');
const code='PAR234';
async function fixture(t,count){
  const db=localStore(':memory:');t.after(db.close);
  const service=createRoomService(db.store,{seed:()=>97241});
  const get=id=>service.get(code,token(id));
  const send=(id,view,action,commandId=(++sequence).toString(16).padStart(32,'0'))=>service.command(code,token(id),{
    commandId,revision:view.revision,preparation:view.preparation,action});
  await service.create(code,'Piloto 0',token(0));
  for(let i=1;i<count;i++)await service.join(code,'Piloto '+i,token(i));
  await send(0,await get(0),{type:'START'});
  return {service,db,get,send};
}
for(const count of [2,3,4])test(`${count} jogadores escolhem, equipam e confirmam concorrentemente sem rejeitar ações dos outros`,async t=>{
  const f=await fixture(t,count),ids=Array.from({length:count},(_,i)=>i);
  for(let choice=0;choice<3;choice++){
    const views=await Promise.all(ids.map(f.get));
    assert.equal(new Set(views.map(v=>v.revision)).size,1);
    const offers=views.flatMap(v=>v.game.draft.choices);
    assert.equal(new Set(offers.map(c=>c.id)).size,3*count);
    await Promise.all(views.map((view,id)=>f.send(id,view,{type:'DRAFT_PICK',id:view.game.draft.choices[0].id})));
    validateState((await f.db.store.get(code)).game);
  }
  for(let slot=0;slot<3;slot++){
    const views=await Promise.all(ids.map(f.get));
    await Promise.all(views.map((view,id)=>view.game.players[id].inventory.length?f.send(id,view,{type:'EQUIP',id:view.game.players[id].inventory[0].id,slot}):null));
  }
  const views=await Promise.all(ids.map(f.get)),stamp=views[0].preparation;
  await Promise.all(views.slice(0,-1).map((view,id)=>f.send(id,view,{type:'CONFIRM_ASSEMBLY'})));
  assert.equal((await f.get(0)).game.phase,'assembly');
  assert.equal((await f.get(0)).game.preparation.ready,true);
  await assert.rejects(f.send(0,views[0],{type:'SELL',id:views[0].game.players[0].modules.find(Boolean).id}),error=>error.status===409);
  const final=await f.send(count-1,views.at(-1),{type:'CONFIRM_ASSEMBLY'});
  assert.ok(['arena','result'].includes(final.game.phase));
  assert.equal(final.preparation,null);
  const before=await f.db.store.get(code);validateState(before.game);
  assert.deepEqual(deserialize(serialize(before.game)),before.game);
  await assert.rejects(f.service.command(code,token(0),{revision:final.revision,commandId:(++sequence).toString(16).padStart(32,'0'),preparation:stamp,action:{type:'ROLL'}}),error=>error.status===409);
});

test('um jogador termina as escolhas e monta enquanto outro ainda está na primeira escolha',async t=>{
  const f=await fixture(t,2),original=await f.get(1);
  for(let i=0;i<3;i++){const view=await f.get(0);await f.send(0,view,{type:'DRAFT_PICK',id:view.game.draft.choices[0].id});}
  let view=await f.get(0);assert.equal(view.game.phase,'assembly');
  assert.equal((await f.get(1)).game.phase,'draft');
  assert.deepEqual((await f.get(1)).game.draft.choices,original.game.draft.choices);
  let slot=0;
  while(view.game.players[0].inventory.length){view=await f.send(0,view,{type:'EQUIP',id:view.game.players[0].inventory[0].id,slot:slot++});}
  const ready=await f.send(0,view,{type:'CONFIRM_ASSEMBLY'});
  assert.equal(ready.game.preparation.ready,true);assert.equal(ready.game.sharedPhase,'draft');
  const other=await f.send(1,original,{type:'DRAFT_PICK',id:original.game.draft.choices[0].id});
  assert.equal(other.game.draft.picks,1);
  assert.deepEqual(other.game.players[0].modules,Array(6).fill(null));
  assert.deepEqual(other.game.players[0].inventory,[]);
  const saved=(await f.db.store.get(code)).game;
  assert.deepEqual(deserialize(serialize(saved)),saved);validateState(saved);
});

test('retomada migra preparação antiga preservando escolhas, ofertas e montagens confirmadas',async t=>{
  const db=localStore(':memory:');t.after(db.close);
  let state=newGame(['Ana','Beto','Caio'],7241);
  state=act(state,{type:'DRAFT_PICK',id:state.draft.choices[0].id});
  const saved=structuredClone(state),hashes=await Promise.all([0,1,2].map(i=>tokenHash(token(i))));
  const room={code,revision:12,hostId:0,members:hashes.map((hash,id)=>({hash,name:state.players[id].name})),game:state,receipts:[],updatedAt:Date.now()};
  await db.store.insert(room);
  const service=createRoomService(db.store),mine=await service.get(code,token(0)),other=await service.get(code,token(2));
  assert.equal(mine.game.draft.picks,1);assert.deepEqual(mine.game.draft.choices,saved.draft.choices);
  assert.deepEqual(mine.game.players[0].inventory,saved.players[0].inventory);
  assert.equal(other.game.draft.choices.length,3);
  await service.command(code,token(2),{revision:other.revision,preparation:other.preparation,commandId:'a'.repeat(32),action:{type:'DRAFT_PICK',id:other.game.draft.choices[0].id}});
  validateState((await db.store.get(code)).game);
  while(state.phase==='draft')state=act(state,{type:'DRAFT_PICK',id:state.draft.choices[0].id});
  state.assemblyPlayer=1;
  const migrated=prepareTogether(state);
  assert.equal(migrated.preparation.seats[0].ready,true);
  assert.equal(migrated.preparation.seats[1].ready,false);
  assert.deepEqual(migrated.players,state.players);validateState(migrated);
});
