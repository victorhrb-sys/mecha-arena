import test from 'node:test';
import assert from 'node:assert/strict';
import {startSolo,soloAction,readSolo,saveSolo,SOLO_SAVE_KEY} from '../dist/solo.js';
import {chooseAction,decisionView} from '../dist/bots.js';
import {validateState} from '../dist/engine.js';

for(const count of [1,2,3])test(`partida local completa com ${count} bots, retomada e revanche`,()=>{
  let game=startSolo('  Victor  ',count,830+count),steps=0;
  const values=new Map([['mecha-arena.rooms','preservado']]);
  const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  while(game.phase!=='gameover'&&steps++<4000){
    const action=game.phase==='arena'?{type:'ROLL'}:game.phase==='result'?{type:'NEXT_ARENA'}:chooseAction(decisionView(game));
    game=soloAction(game,action);validateState(game);
    saveSolo(storage,game);assert.deepEqual(readSolo(storage),game);
    game=readSolo(storage);
  }
  assert.ok(steps<4000);assert.equal(game.phase,'gameover');
  assert.equal(values.get('mecha-arena.rooms'),'preservado');
  const rematch=soloAction(game,{type:'REMATCH'});
  assert.equal(rematch.players.length,count+1);assert.equal(rematch.players[0].name,'Victor');
  assert.equal(rematch.phase,'draft');assert.ok(rematch.players.every(p=>p.points===0));
});
test('salvamento inválido e configuração inválida são rejeitados',()=>{
  assert.equal(readSolo({getItem:()=>null}),null);
  assert.throws(()=>readSolo({getItem:()=>'{'}));
  assert.throws(()=>startSolo('',3));assert.throws(()=>startSolo('Ana',4));
  assert.throws(()=>soloAction(startSolo('Ana',3),{type:'REMATCH'}));
  assert.throws(()=>saveSolo({setItem(){throw new Error('quota');}},startSolo('Ana',1)),/quota/);
  assert.equal(SOLO_SAVE_KEY,'mecha-arena.solo.v1');
});
