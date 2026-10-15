import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,purchaseOrder,validateState} from '../dist/engine.js';
import {marketCycle} from '../dist/market-cycle.js';
import {unseenMarketSteps} from '../dist/market-presentation.js';
import {initializeRoomBots,advanceRoomBots} from '../multiplayer/room-bots.mjs';
import {roomView} from '../multiplayer/rooms.mjs';

test('percurso alinha ida e volta para 2–4 participantes e toda referência',()=>{
  for(let count=2;count<=4;count++)for(let reference=0;reference<count;reference++){
    const order=purchaseOrder(count,reference);
    for(let turn=0;turn<order.length;turn++){
      const steps=marketCycle({phase:'market',players:Array(count),market:{order,turn}});
      assert.equal(steps.find(s=>s.status==='current').index,turn);
      assert.equal(steps.filter(s=>s.status==='done').length,turn);
      for(let i=0;i<count;i++){
        assert.equal(steps[i].playerId,steps[2*count-i-1].playerId);
        assert.equal(steps[i].column,steps[2*count-i-1].column);
      }
    }
  }
  assert.deepEqual(marketCycle({phase:'arena'}),[]);
});

test('servidor registra oportunidades públicas separadas, inclusive duas seguidas do mesmo bot',()=>{
  const members=[{name:'Ana'},{name:'Bot 1',bot:true},{name:'Bot 2',bot:true},{name:'Bot 3',bot:true}];
  const s=initializeRoomBots(newGame(members.map(p=>p.name),45),members);
  s.deck.push(...s.draft.choices);s.draft=null;s.phase='market';s.reference=3;
  s.market={cards:s.deck.splice(0,8),order:purchaseOrder(4,3),turn:1,choiceDone:false};
  for(const p of s.players)p.scrap=30;
  const before=JSON.stringify(s),result=advanceRoomBots(s,members);
  assert.equal(JSON.stringify(s),before);validateState(result);
  assert.equal(result.market.turn,7);
  assert.deepEqual(result.marketReplay.steps.map(s=>s.turn),[1,2,3,4,5,6]);
  assert.deepEqual(result.marketReplay.steps.map(s=>s.playerId),[1,2,3,3,2,1]);
  for(const step of result.marketReplay.steps){
    assert.equal(step.actions.filter(a=>['BUY','PASS'].includes(a.type)).length,1);
    assert.ok(step.cards.every(c=>s.market.cards.some(original=>original.id===c.id)));
    if(step.boughtId)assert.ok(step.cards.some(c=>c.id===step.boughtId));
    assert.deepEqual(Object.keys(step).sort(),['actions','boughtId','cards','order','playerId','turn']);
  }
  const room={code:'ABC234',revision:1,hostId:0,updatedAt:0,members,game:result};
  const projected=roomView(room,0).game;
  assert.deepEqual(projected.marketReplay,result.marketReplay);
  assert.deepEqual(roomView(room,2).game.marketReplay,projected.marketReplay);
  assert.ok(projected.players.slice(1).every(p=>p.modules.every(c=>c===null)&&!p.inventory.length));
  assert.doesNotMatch(JSON.stringify(projected.marketReplay),/"(?:modules|inventory|rng|deck|bot|hash)":/);
  assert.deepEqual(advanceRoomBots(result,members).marketReplay,result.marketReplay);
  room.game.round++;assert.equal(roomView(room,0).game.marketReplay,null);
});

test('reprodução recupera somente passos novos e não repete ao reconectar, virar a arena ou iniciar revanche',()=>{
  const a={phase:'market',round:2,marketReplay:{round:2,steps:[{turn:1}]}},b={...a,marketReplay:{round:2,steps:[{turn:1},{turn:2},{turn:3}]}};
  assert.deepEqual(unseenMarketSteps(a,b),[{turn:2},{turn:3}]);
  assert.deepEqual(unseenMarketSteps(b,b),[]);
  assert.deepEqual(unseenMarketSteps(null,b),[]);
  assert.deepEqual(unseenMarketSteps({...a,phase:'result',round:1},b),b.marketReplay.steps);
  assert.deepEqual(unseenMarketSteps({...a,phase:'gameover'},b),[]);
  assert.deepEqual(unseenMarketSteps(b,{...a,round:1}),[]);
  assert.deepEqual(unseenMarketSteps(b,{...b,round:3}),[]);
});
