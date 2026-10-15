import test from 'node:test';
import assert from 'node:assert/strict';
import {diceForRoll,persistentDice,DICE_POSES,DICE_PIPS} from '../dist/dice-presentation.js';

test('painel mantém um lugar por jogador antes e depois das rolagens',()=>{
  const players=[0,1,2,3].map(id=>({id,name:`P${id}`,color:'#abcdef',alive:id!==2,modules:Array(6).fill(null)}));
  assert.equal(persistentDice(players,null).length,4);
  assert.ok(persistentDice(players,null).every(d=>d.face===null));
  const roll={dice:[1,3,null,6],before:players.map(p=>({id:p.id,alive:p.alive}))};
  assert.deepEqual(persistentDice(players,roll).map(d=>d.face),[1,3,null,6]);
  assert.equal(persistentDice(players,roll)[2].eliminated,true);
});

test('dados usam resultados salvos e excluem somente robôs já eliminados antes da rolagem',()=>{
  const players=[0,1,2].map(id=>({id,name:`P${id}`,color:'#abcdef',modules:[null,{type:'K',upgraded:true},null,null,null,null],alive:false}));
  const roll={dice:[2,null,6],before:[{id:0,alive:true},{id:1,alive:false},{id:2,alive:true}]};
  const original=JSON.stringify({players,roll});
  const dice=diceForRoll(players,roll);
  assert.deepEqual(dice.map(d=>[d.id,d.face]),[[0,2],[2,6]]);
  assert.deepEqual(dice[0].card,{type:'K',upgraded:true});assert.equal(dice[1].card,null);
  assert.equal(JSON.stringify({players,roll}),original);
});

test('todas as faces têm pose final e quantidade correta de pontos',()=>{
  for(let face=1;face<=6;face++){
    assert.equal(DICE_POSES[face].length,2);
    assert.equal(DICE_PIPS[face].length,face);
    assert.equal(new Set(DICE_PIPS[face]).size,face);
    assert.ok(DICE_PIPS[face].every(p=>p>=1&&p<=9));
    assert.equal(diceForRoll([{id:0,name:'P',modules:Array(6).fill(null)}],{dice:[face],before:[{id:0,alive:true}]} )[0].face,face);
  }
});
