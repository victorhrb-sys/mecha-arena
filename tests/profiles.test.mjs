import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createApi} from '../multiplayer/api.mjs';
import {localStore} from '../multiplayer/local-store.mjs';
import {createProfileClient,PROFILE_KEY} from '../dist/profiles.js';
import {createRoomClient} from '../dist/network.js';
import {newGame} from '../dist/engine.js';

const memory=()=>{const values=new Map();return {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};};
function fixture(t){const db=localStore(':memory:');t.after(db.close);const api=createApi(db.store);
  const fetcher=(url,options)=>api(new Request('http://localhost'+url,options));
  const request=async(path,body,status=200)=>{const response=await fetcher(path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;};
  return {db,request,fetcher};}

test('nome normalizado abre o mesmo perfil público, inclusive em seleções concorrentes; dados enviados não alteram estatísticas',async t=>{
  const f=fixture(t);
  const views=await Promise.all(['Ana Silva',' ana   SILVA ','Ａna Silva'].map(name=>f.request('/api/profiles',{name,stats:{wins:99},password:'ignored'})));
  assert.equal(new Set(views.map(v=>v.id)).size,1);
  assert.deepEqual(views[0].stats,{matches:0,wins:0,losses:0,arenaWins:0,winRate:0});
  assert.equal(JSON.stringify(views).includes('password'),false);
  assert.equal((await f.request('/api/profiles?name=ANA%20SILVA')).id,views[0].id);
  await f.request('/api/profiles',{name:' '.repeat(5)},400);
  await f.request('/api/profiles',{name:'a'.repeat(25)},400);
  await f.request('/api/profiles?name=Ausente',undefined,404);
});

test('perfil lembra o nome no navegador, abre em outro dispositivo e não aceita uma resposta antiga após trocar usuário',async t=>{
  const f=fixture(t),storage=memory();
  const first=createProfileClient({storage,fetcher:f.fetcher});const ana=await first.select('Ana');
  const fresh=createProfileClient({storage,fetcher:f.fetcher});assert.equal(fresh.profile.name,'Ana');
  assert.deepEqual(await fresh.refresh(),ana);
  const second=createProfileClient({storage:memory(),fetcher:f.fetcher});assert.deepEqual(await second.select('ana'),ana);
  let release;const delayed=createProfileClient({storage:memory(),fetcher:async(url,options)=>{if(JSON.parse(options.body).name==='Antigo')await new Promise(resolve=>release=resolve);return f.fetcher(url,options);}});
  const older=delayed.select('Antigo');await delayed.select('Atual');release();await older;assert.equal(delayed.profile.name,'Atual');
  fresh.clear();assert.equal(fresh.profile,null);assert.equal(JSON.parse(storage.getItem(PROFILE_KEY)),null);
});

test('trocar perfil não transfere nem perde a vaga de uma sala; mesmo nome em outro aparelho não acessa o robô',async t=>{
  const f=fixture(t);let view;
  const client=createRoomClient({storage:memory(),fetcher:f.fetcher,onUpdate:value=>view=value,onStatus(){},interval:100000});t.after(client.pause);
  await client.create('Ana');const code=view.code;
  await assert.rejects(client.join(code,'Beto'),/já tem uma vaga/);await client.resume();assert.equal(view.members[view.playerId].name,'Ana');
  const second=createRoomClient({storage:memory(),fetcher:f.fetcher,onUpdate(){},onStatus(){},interval:100000});t.after(second.pause);
  await assert.rejects(second.join(code,'ana'),/Já existe um jogador/);
  const response=await f.fetcher('/api/rooms/'+code,{headers:{Authorization:'Bearer '+'a'.repeat(64)}});assert.equal(response.status,401);
});

function completedRoom(code,matchId){
  const game=newGame(['Ana','Beto'],12);game.phase='gameover';game.draft=null;game.players[0].points=5;game.players[1].points=3;game.result={winner:0};
  return {code,revision:1,matchId,updatedAt:Date.now(),game};
}
test('resultado e sala são gravados juntos: uma disputa de revisão não credita o resultado perdedor e reenvios não duplicam vitórias',async t=>{
  const f=fixture(t),room=completedRoom('ABC234','match1');
  await f.db.store.insert({...room,revision:0,game:null});
  const alternate=structuredClone(room);alternate.game.players[0].points=3;alternate.game.players[1].points=5;alternate.game.result.winner=1;
  const applied=await Promise.all([f.db.store.update(room,0),f.db.store.update(alternate,0)]);assert.equal(applied.filter(Boolean).length,1);
  const saved=await f.db.store.get(room.code),winner=saved.game.result.winner;
  assert.equal(await f.db.store.update(alternate,0),false);
  for(const [id,name] of ['Ana','Beto'].entries()){
    const profile=await f.request('/api/profiles?name='+name);
    assert.equal(profile.stats.matches,1);assert.equal(profile.stats.wins,Number(id===winner));
    assert.equal(profile.history[0].winner,['Ana','Beto'][winner]);
  }
  const rematch=completedRoom('ABC234','match2');rematch.revision=2;await f.db.store.update(rematch,1);
  assert.equal((await f.request('/api/profiles?name=Ana')).stats.matches,2);
});

test('histórico e perfil sobrevivem ao reinício e à expiração da sala',async t=>{
  const directory=await mkdtemp(path.join(tmpdir(),'mecha-profile-'));
  const file=path.join(directory,'game.sqlite');let db=localStore(file);
  t.after(async()=>{db.close();await rm(directory,{recursive:true,force:true});});
  const room=completedRoom('ABC234','persistent');room.updatedAt=1;
  await db.store.insert({...room,revision:0,game:null});await db.store.update(room,0);db.close();
  db=localStore(file);
  const response=await createApi(db.store)(new Request('http://localhost/api/profiles?name=Ana'));
  const profile=await response.json();assert.equal(profile.stats.wins,1);assert.equal(profile.history[0].matchId,'persistent');
});
