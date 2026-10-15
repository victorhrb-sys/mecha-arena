import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,enableLaboratory,isLaboratory,resolveRoll,act,serialize,deserialize,validateState,maxHp,allCards,migrateLaboratory,draftPickCount} from '../dist/engine.js';
import {startSolo,soloAction,saveSolo,readSolo,SOLO_SAVE_KEY,LAB_SAVE_KEY} from '../dist/solo.js';
import {chooseAction,decisionView} from '../dist/bots.js';
import {diceForRoll,persistentDice} from '../dist/dice-presentation.js';
import {resourceEffects} from '../dist/arena-playback.js';

function arena(count=3){const s=enableLaboratory(newGame(['Ana','Bruno','Carla','Davi'].slice(0,count),17));s.deck.push(...s.draft.choices);s.draft=null;s.phase='arena';for(const p of s.players){s.deck.push(...p.inventory);p.inventory=[];}return s;}
function equip(s,id,type,slot=0,upgraded=false){const i=s.deck.findIndex(c=>c.type===type),c=s.deck.splice(i,1)[0];c.upgraded=upgraded;s.players[id].modules[slot]=c;s.players[id].unlocked=Math.max(slot+1,s.players[id].unlocked);return c;}

test('carga por faces independe do módulo; teto rígido e consumo somente na próxima rolagem',()=>{
  let s=arena();equip(s,0,'K');equip(s,1,'K');equip(s,2,'K');s.players[0].charge=5;
  s=resolveRoll(s,[6,4,5]);assert.deepEqual(s.players.map(p=>p.charge),[6,1,1]);
  assert.deepEqual(s.lastRoll.chargedIds,[]);assert.deepEqual(s.lastRoll.chargeGains.map(g=>g.amount),[1,1,1]);
  s=resolveRoll(s,[[6,6],2,2]);assert.equal(s.players[0].charge,4);
  assert.deepEqual(s.lastRoll.chargedIds,[0]);assert.deepEqual(s.lastRoll.criticalIds,[]);assert.deepEqual(s.lastRoll.emptyCriticalIds,[0]);
  assert.deepEqual(s.players[0].diceResults,[6,6]);validateState(s);
  assert.throws(()=>resolveRoll({...s,players:s.players.map(p=>({...p,charge:6}))},[1,1,1]),/dado inválido/);
});
test('dois dados seguem ordem global; crítico gera três execuções sem duplicar carga natural',()=>{
  const s=arena();equip(s,0,'J',3);equip(s,0,'Q',4);equip(s,1,'J',2);equip(s,1,'K');equip(s,2,'K');
  s.players[0].charge=6;
  const out=resolveRoll(s,[[5,4],3,2]);
  assert.deepEqual(out.lastRoll.events.map(e=>e.face),[3,4,5]);assert.equal(out.players[0].scrap,1);
  // 2 cargas dos dados + 1 da cura sem dano.
  assert.equal(out.players[0].charge,3);
  const critical=resolveRoll({...s,players:s.players.map(p=>({...p,charge:p.id===0?6:0}))},[[4,4],2,2]);
  assert.equal(critical.players[0].scrap,3);assert.equal(critical.players[0].charge,2);
  assert.deepEqual(critical.lastRoll.criticalIds,[0]);
});
test('crítico de cura melhorada cura até seis; excedente vira carga e passivo não muda',()=>{
  const s=arena();equip(s,0,'Q',0,true);equip(s,0,'K',1);equip(s,1,'K');equip(s,2,'K');
  Object.assign(s.players[0],{charge:6,hp:1,maxHp:3});
  const out=resolveRoll(s,[[1,1],2,2]);
  assert.equal(out.players[0].hp,3);assert.equal(maxHp(out.players[0]),3);assert.equal(out.players[0].charge,4);
  assert.deepEqual(resourceEffects(out.lastRoll,0),[{playerId:0,type:'Q',amount:2,charge:4}]);
  const saved=serialize(out);resourceEffects(out.lastRoll,0);assert.equal(serialize(out),saved);
});
test('crítico melhorado troca alvos entre execuções, mantém cada par e usa o dano próprio anterior',()=>{
  const s=arena();equip(s,0,'A',0,true);equip(s,1,'K');equip(s,2,'K');
  s.players[0].charge=6;s.players[1].hp=s.players[2].hp=8;s.players[1].maxHp=s.players[2].maxHp=8;
  const out=resolveRoll(s,[[1,1],2,2]),shots=out.lastRoll.events[0].attacks;
  assert.equal(shots.length,6);
  for(let i=0;i<6;i+=2){assert.equal(shots[i].targetId,shots[i+1].targetId);assert.equal(shots[i].execution,i/2+1);}
  assert.equal(new Set(shots.map(a=>a.targetId)).size,2);
  const fragile=structuredClone(s);fragile.players[1].hp=1;fragile.players[1].pos=2;fragile.players[2].pos=1;
  const retarget=resolveRoll(fragile,[[1,1],2,2]).lastRoll.events[0].attacks;
  assert.equal(retarget[0].targetId,1);assert.equal(retarget[1].targetId,2);
  assert.equal(retarget.filter(a=>a.targetId===1).length,1);
});
test('crítico completa seu grupo sob dano letal simultâneo, mas mortos perdem faces posteriores',()=>{
  const s=arena();equip(s,0,'A',0,true);equip(s,1,'A');equip(s,2,'K');s.players[0].charge=6;s.players[0].pos=3;
  s.players[1].hp=5;s.players[1].maxHp=5;s.players[1].pos=2;s.players[2].hp=5;s.players[2].maxHp=5;
  const out=resolveRoll(s,[[1,1],1,2]);
  assert.equal(out.players[0].alive,false);assert.equal(out.lastRoll.events[0].attacks.filter(a=>a.attackerId===0).length,6);
  const later=arena();equip(later,0,'A');equip(later,1,'K',4);equip(later,2,'K');later.players[1].charge=6;later.players[1].pos=2;
  const result=resolveRoll(later,[1,[5,6],2]);
  assert.equal(result.players[1].alive,false);assert.equal(result.players[1].charge,3);assert.equal(result.players[1].pos,2);
  assert.ok(result.lastRoll.events.every(e=>!e.activeIds.includes(1)));
});
test('corrida crítica respeita empate simultâneo e preserva carga após mercado e nova arena',()=>{
  let s=arena(2);equip(s,0,'K');equip(s,1,'K');s.players.forEach(p=>{p.charge=6;p.pos=1;});
  s=resolveRoll(s,[[1,1],[1,1]]);assert.equal(s.result.reason,'race_tie');assert.deepEqual(s.players.map(p=>p.pos),[4,4]);
  s.players[0].charge=5;s.players[1].charge=3;
  s=act(s,{type:'NEXT_ARENA'});while(s.phase==='market')s=act(s,{type:'END_TURN'});
  while(s.phase==='assembly')s=act(s,{type:'CONFIRM_ASSEMBLY'});
  assert.equal(s.phase,'arena');assert.deepEqual(s.players.map(p=>p.charge),[5,3]);
  assert.ok(s.players.every(p=>p.hp===p.maxHp&&p.diceResults.length===0));
});
test('resultados duplos são salvos, retomados e apresentados sem novo sorteio',()=>{
  const s=arena();equip(s,0,'K');equip(s,1,'K');equip(s,2,'K');s.players[0].charge=6;
  const out=resolveRoll(s,[[3,6],4,5]),saved=serialize(out),restored=deserialize(saved);
  assert.deepEqual(diceForRoll(restored.players,restored.lastRoll).map(d=>d.face),[3,6,4,5]);
  assert.equal(persistentDice(restored.players,restored.lastRoll).length,4);
  assert.equal(serialize(restored),saved);assert.deepEqual(resolveRoll(restored),resolveRoll(out));
  assert.throws(()=>deserialize(JSON.stringify({...s,players:s.players.map(p=>({...p,charge:7}))})),/Carga inválida/);
});
test('salvamentos normal e Laboratório coexistem e rejeitam conteúdo de outro modo',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  const solo=startSolo('Victor',1,5),lab=startSolo('Victor',3,7,true);
  saveSolo(storage,solo);saveSolo(storage,lab);
  assert.deepEqual(readSolo(storage),solo);assert.deepEqual(readSolo(storage,true),lab);
  assert.ok(values.has(SOLO_SAVE_KEY)&&values.has(LAB_SAVE_KEY));assert.equal(isLaboratory(solo),false);
  values.set(SOLO_SAVE_KEY,serialize(lab));assert.throws(()=>readSolo(storage),/outro modo/);
});
test('kit fixo e uma escolha retiram cartas do baralho de nove cópias de cada tipo',()=>{
  for(const count of [1,2,3]){
    const initial=startSolo('Victor',count,2026,true);
    assert.deepEqual(initial,startSolo('Victor',count,2026,true));
    assert.equal(draftPickCount(initial),1);assert.equal(initial.draft.choices.length,3);
    for(const p of initial.players)assert.deepEqual(p.inventory.map(c=>c.type),['K','A']);
    const s=soloAction(initial,{type:'DRAFT_PICK',id:initial.draft.choices[0].id});
    assert.equal(s.phase,'assembly');assert.equal(s.assemblyPlayer,0);
    for(const p of s.players){assert.equal(allCards(p).length,3);assert.ok(allCards(p).some(c=>c.type==='A'));assert.ok(allCards(p).some(c=>c.type==='K'));}
    const cards=[...s.deck,...s.players.flatMap(allCards)];
    assert.equal(cards.length,36);assert.equal(new Set(cards.map(c=>c.id)).size,36);
    for(const type of ['A','K','Q','J'])assert.equal(cards.filter(c=>c.type===type).length,9);
    validateState(s);
  }
});
test('migração preserva escolhas antigas, RNG, recursos e histórico e não duplica cartas',()=>{
  let old=startSolo('Victor',2,37);old.ruleset='laboratory-v1';
  old.players.forEach(p=>{p.charge=2;p.diceResults=[];});
  old=soloAction(old,{type:'DRAFT_PICK',id:old.draft.choices[0].id});
  const before=serialize(old),storage={getItem:()=>before};
  let migrated=readSolo(storage,true);
  assert.equal(migrated.deck.length,old.deck.length+4);
  assert.deepEqual(migrated.draft,old.draft);assert.deepEqual(migrated.players,old.players);
  assert.equal(migrated.rng,old.rng);assert.equal(draftPickCount(migrated),3);
  assert.deepEqual(migrateLaboratory(migrated),migrated);assert.equal(serialize(old),before);
  for(let i=0;i<2;i++)migrated=soloAction(migrated,{type:'DRAFT_PICK',id:migrated.draft.choices[0].id});
  assert.equal(migrated.phase,'assembly');validateState(migrated);
  const active=arena();active.ruleset='laboratory-v1';delete active.initialPicks;active.deck=active.deck.filter(c=>!c.id.endsWith('8'));
  equip(active,0,'K');equip(active,1,'K');equip(active,2,'K');
  const rolled=resolveRoll(active,[1,2,3]),upgraded=migrateLaboratory(rolled);
  assert.deepEqual(upgraded.lastRoll,rolled.lastRoll);assert.deepEqual(upgraded.players,rolled.players);
  assert.equal(upgraded.rng,rolled.rng);validateState(upgraded);
});
for(const count of [1,2,3])test(`Laboratório completo com ${count} bots, retomada e revanche`,()=>{
  let s=startSolo('Victor',count,710+count,true),steps=0,charged=0;
  while(s.phase!=='gameover'&&steps++<4000){
    const action=s.phase==='arena'?{type:'ROLL'}:s.phase==='result'?{type:'NEXT_ARENA'}:chooseAction(decisionView(s));
    s=soloAction(s,action);validateState(s);
    if(action.type==='ROLL')charged+=s.lastRoll.chargedIds.length;
    s=deserialize(serialize(s));
  }
  assert.equal(s.phase,'gameover');assert.ok(charged>0);
  const rematch=soloAction(s,{type:'REMATCH'});assert.ok(isLaboratory(rematch));
  assert.equal(rematch.players.length,count+1);assert.ok(rematch.players.every(p=>p.charge===0&&p.points===0));
  assert.equal(draftPickCount(rematch),1);assert.ok(rematch.players.every(p=>p.inventory.length===2));
});
