import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,act,resolveRoll,serialize,deserialize,validateState,allCards,maxHp,purchaseOrder,currentPlayer} from '../dist/engine.js';

function fixture(n=2,seed=17){const s=newGame(['Ana','Bruno','Carla','Davi'].slice(0,n),seed);s.deck.push(...s.draft.choices);s.draft=null;s.phase='arena';return s;}
function give(s,id,type,{slot=0,upgraded=false,inventory=false}={}){const index=s.deck.findIndex(c=>c.type===type);assert.ok(index>=0);const c=s.deck.splice(index,1)[0];c.upgraded=upgraded;if(inventory)s.players[id].inventory.push(c);else s.players[id].modules[slot]=c;return c;}
function primeHp(s){s.players.forEach(p=>p.hp=p.maxHp=maxHp(p));}
function chooseDraftType(s,type){s.deck.push(...s.draft.choices);s.draft.choices=[];for(let i=0;i<3;i++){let ix=i===0?s.deck.findIndex(c=>c.type===type):0;s.draft.choices.push(s.deck.splice(ix,1)[0]);}return act(s,{type:'DRAFT_PICK',id:s.draft.choices[0].id});}

test('montagem permite comprar módulos e melhorar por 12 sem avançar a fase',()=>{
  let s=fixture();s.phase='assembly';s.assemblyPlayer=0;s.players[0].scrap=21;
  const q=give(s,0,'Q');
  s=act(s,{type:'UNLOCK'});assert.equal(s.players[0].unlocked,4);assert.equal(s.players[0].scrap,17);
  s=act(s,{type:'UPGRADE',id:q.id});assert.equal(s.players[0].scrap,5);assert.equal(s.players[0].modules[0].upgraded,true);
  assert.equal(maxHp(s.players[0]),3);
  s=act(s,{type:'UNLOCK'});assert.equal(s.players[0].unlocked,5);assert.equal(s.players[0].scrap,0);
  assert.equal(s.phase,'assembly');assert.equal(s.assemblyPlayer,0);
  assert.throws(()=>act(s,{type:'UNLOCK'}),/6 sucatas/);
  assert.deepEqual(deserialize(serialize(s)),s);
  for(const phase of ['draft','arena','result','gameover']){
    assert.throws(()=>act({...s,phase},{type:'UNLOCK',playerId:0}),/Compra e na Montagem/);
    assert.throws(()=>act({...s,phase},{type:'UPGRADE',id:q.id,playerId:0}),/Compra e na Montagem/);
  }
});

test('inserção entre módulos desloca o intervalo nos dois sentidos e conserva as cartas',()=>{
  const s=fixture();s.phase='assembly';s.assemblyPlayer=0;s.players[0].unlocked=6;
  const cards=['A','K','Q','J','A','K'].map((type,slot)=>give(s,0,type,{slot,upgraded:slot===5}));
  const ids=cards.map(c=>c.id);
  const moved=act(s,{type:'EQUIP',id:ids[5],slot:3,reorder:true});
  assert.deepEqual(moved.players[0].modules.map(c=>c.id),[...ids.slice(0,3),ids[5],ids[3],ids[4]]);
  assert.equal(moved.players[0].modules[3].upgraded,true);validateState(moved);
  const restored=act(moved,{type:'EQUIP',id:ids[5],slot:5,reorder:true});
  assert.deepEqual(restored.players[0].modules.map(c=>c.id),ids);
  assert.deepEqual(s.players[0].modules.map(c=>c.id),ids);validateState(restored);
});

test('inserção preserva espaços vazios e rejeita módulos bloqueados',()=>{
  const s=fixture();s.phase='assembly';s.assemblyPlayer=0;
  const a=give(s,0,'A',{slot:0}),k=give(s,0,'K',{slot:2});
  const out=act(s,{type:'EQUIP',id:k.id,slot:0,reorder:true});
  assert.deepEqual(out.players[0].modules.map(c=>c?.id??null),[k.id,a.id,null,null,null,null]);
  assert.throws(()=>act(s,{type:'EQUIP',id:a.id,slot:3,reorder:true}),/bloqueado/);
  validateState(out);
});

test('preparação: 32 cartas, sucata inicial, três escolhas gratuitas e tripla inicial',()=>{
  let s=newGame(['Ana','Bruno'],123);assert.equal(s.players[0].scrap,0);
  for(let i=0;i<3;i++)s=chooseDraftType(s,'A');
  assert.equal(s.players[0].inventory.length,1);assert.equal(s.players[0].inventory[0].upgraded,true);
  assert.equal(s.players[0].scrap,0);assert.equal(s.draft.player,1);assert.equal(s.draft.picks,0);validateState(s);
});
test('a face anterior encerra a arena antes de ativar um corredor em face posterior',()=>{
  const s=fixture();give(s,0,'A');give(s,1,'K',{slot:5});s.players[1].pos=3;s.players[1].unlocked=6;
  const out=resolveRoll(s,[1,6]);assert.equal(out.result.winner,0);assert.equal(out.players[1].pos,3);assert.equal(out.lastRoll.events.length,1);
});
test('A precede K na mesma face; a eliminação impede a corrida',()=>{
  const s=fixture();give(s,0,'A');give(s,1,'K');s.players[1].pos=3;
  const out=resolveRoll(s,[1,1]);assert.equal(out.result.reason,'survival');assert.equal(out.result.winner,0);
});
test('destruição simultânea não favorece o primeiro jogador e paga só participação',()=>{
  const s=fixture();give(s,0,'A');give(s,1,'A');
  const out=resolveRoll(s,[1,1]);assert.equal(out.result.reason,'mutual');assert.deepEqual(out.players.map(p=>p.points),[0,0]);assert.deepEqual(out.players.map(p=>p.scrap),[3,3]);
  assert.equal(out.lastRoll.events[0].simultaneous,true);assert.throws(()=>act(out,{type:'ROLL'}));
});
test('A melhorado termina os dois disparos e troca de alvo mesmo sofrendo dano letal simultâneo',()=>{
  const s=fixture(3);give(s,0,'A',{upgraded:true});give(s,1,'A');give(s,2,'K');
  [3,2,1].forEach((pos,i)=>s.players[i].pos=pos);
  const out=resolveRoll(s,[1,1,2]);
  assert.deepEqual(out.players.map(p=>p.hp),[0,0,0]);assert.equal(out.result.reason,'mutual');
  assert.match(out.lastRoll.events[0].lines[0],/Ana → Bruno/);assert.match(out.lastRoll.events[0].lines[1],/Ana → Carla/);
  assert.equal(out.lastRoll.events[0].lines.length,3);
});
test('disparos simultâneos partem do mesmo estado; dano alheio não entra entre disparos',()=>{
  const s=fixture(4);give(s,0,'A',{upgraded:true});give(s,1,'A');give(s,2,'Q');give(s,3,'K');primeHp(s);
  [0,1,3,2].forEach((pos,i)=>s.players[i].pos=pos);
  const out=resolveRoll(s,[1,1,6,6]);assert.equal(out.players[2].hp,0);assert.equal(out.players[3].hp,1);
  assert.equal(out.lastRoll.events[0].lines.filter(l=>l.includes('→ Carla')).length,3);
});
test('empate de alvo usa sorteio reproduzível com a partida salva',()=>{
  const s=fixture(3);give(s,0,'A');give(s,1,'K');give(s,2,'K');
  const a=resolveRoll(s,[1,6,6]),b=resolveRoll(deserialize(serialize(s)),[1,6,6]);
  assert.deepEqual(a,b);assert.match(a.lastRoll.events[0].lines[0],/alvo sorteado/);
});
test('chegada simultânea, inclusive K melhorado, termina sem pontos',()=>{
  const s=fixture();give(s,0,'K',{upgraded:true});give(s,1,'K');s.players[0].pos=2;s.players[1].pos=3;
  const out=resolveRoll(s,[1,1]);assert.deepEqual(out.players.map(p=>p.pos),[4,4]);assert.equal(out.result.reason,'race_tie');assert.equal(out.result.winner,null);
});
test('chegada em face anterior vence antes de outro movimento',()=>{
  const s=fixture();give(s,0,'K');give(s,1,'K',{slot:1});s.players.forEach(p=>p.pos=3);
  const out=resolveRoll(s,[1,2]);assert.equal(out.result.winner,0);assert.equal(out.players[1].pos,3);
});
test('HP de Q comum/melhorado e cura limitada ao máximo; sucata melhorada',()=>{
  const s=fixture(3);give(s,0,'Q',{upgraded:true});give(s,0,'Q',{slot:1});give(s,1,'J',{upgraded:true});give(s,2,'K');primeHp(s);s.players[0].hp=3;
  assert.equal(maxHp(s.players[0]),4);
  const out=resolveRoll(s,[1,1,6]);assert.equal(out.players[0].hp,4);assert.equal(out.players[1].scrap,2);assert.equal(out.phase,'arena');
});
test('arena com apenas Q/J termina automaticamente sem pontos, sem gerar sucata de J',()=>{
  let s=fixture();give(s,0,'Q');give(s,1,'J');s.phase='assembly';s.assemblyPlayer=1;
  s=act(s,{type:'CONFIRM_ASSEMBLY'});assert.equal(s.result.reason,'stalemate');assert.deepEqual(s.players.map(p=>p.scrap),[3,3]);
});
test('nova arena restaura HP e posição mas mantém progressão; vitória termina aos 5',()=>{
  const s=fixture();give(s,0,'K');give(s,1,'A');s.players[0].pos=3;s.players[0].points=4;
  const out=resolveRoll(s,[1,6]);assert.equal(out.phase,'gameover');assert.equal(out.players[0].points,5);assert.throws(()=>act(out,{type:'NEXT_ARENA'}));
  const base=fixture();give(base,0,'Q',{upgraded:true});give(base,1,'K');base.phase='assembly';base.assemblyPlayer=1;base.players[0].hp=0;base.players[0].alive=false;base.players[0].pos=2;base.players[0].points=2;base.players[0].scrap=9;
  const reset=act(base,{type:'CONFIRM_ASSEMBLY'});assert.equal(reset.players[0].hp,3);assert.equal(reset.players[0].pos,0);assert.equal(reset.players[0].points,2);assert.equal(reset.players[0].scrap,9);assert.equal(reset.players[0].alive,true);
});
test('sequência de compra e referência preservada após empate',()=>{
  assert.deepEqual(purchaseOrder(4,3),[0,1,2,3,3,2,1,0]);assert.deepEqual(purchaseOrder(2,0),[1,0,0,1]);
  const s=fixture();give(s,0,'K');give(s,1,'K');s.players.forEach(p=>p.pos=3);s.reference=1;
  const out=act(resolveRoll(s,[1,1]),{type:'NEXT_ARENA'});assert.equal(out.reference,1);assert.deepEqual(out.market.order,[0,1,1,0]);
});
test('venda devolve carta comum por 1; desbloqueios sequenciais e não gastam escolha',()=>{
  let s=fixture();give(s,0,'A',{upgraded:true});give(s,1,'K');s.phase='result';s.result={title:'Teste',winner:null};s.reference=1;
  s=act(s,{type:'NEXT_ARENA'});s.players[0].scrap=14;
  const soldId=s.players[0].modules[0].id;s=act(s,{type:'SELL',id:soldId});assert.equal(s.players[0].scrap,15);assert.equal(s.deck.find(c=>c.id===soldId).upgraded,false);
  for(const unlocked of [4,5,6]){s=act(s,{type:'UNLOCK'});assert.equal(s.players[0].unlocked,unlocked);assert.equal(s.market.choiceDone,false);}
  assert.equal(s.players[0].scrap,0);assert.equal(s.market.turn,0);assert.throws(()=>act(s,{type:'BUY',id:s.market.cards[0].id}));validateState(s);
});
test('construção pelo módulo exige 4 → 5 → 6 e rejeita cliques fora da ordem sem cobrar',()=>{
  for(const choiceDone of [false,true]){
    let s=fixture();s.phase='market';s.market={cards:[],order:purchaseOrder(2,1),turn:0,choiceDone};s.players[0].scrap=15;
    for(const slot of [4,5,-1,6]){
      const before=serialize(s);
      assert.throws(()=>act(s,{type:'UNLOCK',slot}),/ordem 4 → 5 → 6/);
      assert.equal(serialize(s),before);
    }
    for(const [slot,balance] of [[3,11],[4,6],[5,0]]){
      s=act(s,{type:'UNLOCK',slot});
      assert.equal(s.players[0].unlocked,slot+1);assert.equal(s.players[0].scrap,balance);
      assert.equal(s.market.turn,0);assert.equal(s.market.choiceDone,choiceDone);
      const before=serialize(s);
      assert.throws(()=>act(s,{type:'UNLOCK',slot}),/ordem 4 → 5 → 6/);
      assert.equal(serialize(s),before);validateState(s);
    }
  }
});

test('nova tripla ignora carta melhorada e devolve só duas cartas comuns',()=>{
  let s=fixture();give(s,0,'A',{upgraded:true});give(s,0,'A',{inventory:true});give(s,0,'A',{inventory:true});give(s,1,'K');
  s.phase='market';s.players[0].scrap=3;s.market={cards:[s.deck.splice(s.deck.findIndex(c=>c.type==='A'),1)[0]],order:purchaseOrder(2,1),turn:0,choiceDone:false};
  s=act(s,{type:'BUY',id:s.market.cards[0].id});assert.equal(allCards(s.players[0]).filter(c=>c.upgraded).length,2);assert.equal(allCards(s.players[0]).length,2);validateState(s);
});
test('módulos trocam equipamentos; reserva excedente e edição em arena são bloqueadas',()=>{
  let s=fixture();const a=give(s,0,'A'),k=give(s,0,'K',{slot:1});give(s,0,'Q',{inventory:true});give(s,0,'J',{inventory:true});s.phase='assembly';
  assert.throws(()=>act(s,{type:'CONFIRM_ASSEMBLY'}),/reserva/);assert.throws(()=>act(s,{type:'EQUIP',id:a.id,slot:4}),/bloqueado/);
  s=act(s,{type:'EQUIP',id:a.id,slot:1});assert.equal(s.players[0].modules[0].id,k.id);assert.equal(s.players[0].modules[1].id,a.id);
  s=act(s,{type:'SELL',id:s.players[0].inventory[0].id});s=act(s,{type:'CONFIRM_ASSEMBLY'});assert.equal(s.assemblyPlayer,1);validateState(s);
  s.phase='arena';assert.throws(()=>act(s,{type:'SELL',id:a.id}));assert.throws(()=>act(s,{type:'UNLOCK'}));
});
test('loja reduzida usa apenas cartas disponíveis, conserva o baralho e não repõe na venda',()=>{
  let s=fixture(4);while(s.deck.length>5){const c=s.deck.shift();s.players[0].inventory.push(c);}s.phase='result';s.result={title:'Teste',winner:null};s.reference=3;
  s=act(s,{type:'NEXT_ARENA'});assert.equal(s.market.cards.length,5);assert.equal(s.deck.length,0);
  s=act(s,{type:'SELL',id:s.players[0].inventory[0].id});assert.equal(s.market.cards.length,5);assert.equal(s.deck.length,1);validateState(s);
});
test('retomada preserva resultado, sorteio futuro e impede duplicar recompensa',()=>{
  const s=fixture();give(s,0,'K');give(s,1,'K');s.players[0].pos=3;
  const ended=resolveRoll(s,[1,6]),restored=deserialize(serialize(ended));assert.deepEqual(restored,ended);
  assert.throws(()=>act(restored,{type:'ROLL'}));assert.equal(restored.players[0].scrap,3);
  const next=act(restored,{type:'NEXT_ARENA'});assert.throws(()=>act(next,{type:'NEXT_ARENA'}));
  const invalid=structuredClone(restored);invalid.deck[0]=invalid.deck[1];assert.throws(()=>deserialize(JSON.stringify(invalid)),/baralho/);
});

test('melhoria paga custa 12, preserva a carta e não consome a compra, antes ou depois dela',()=>{
  for(const choiceDone of [false,true]){
    let s=fixture();const cannon=give(s,0,'A');const shield=give(s,0,'Q',{inventory:true});
    s.phase='market';s.market={cards:[],order:purchaseOrder(2,1),turn:0,choiceDone};s.players[0].scrap=24;
    const before=serialize(s),deckSize=s.deck.length;
    s=act(s,{type:'UPGRADE',id:cannon.id});assert.equal(s.players[0].scrap,12);assert.equal(s.players[0].modules[0].upgraded,true);
    s=act(s,{type:'UPGRADE',id:shield.id});assert.equal(s.players[0].scrap,0);assert.equal(s.players[0].inventory[0].upgraded,true);
    assert.equal(s.market.turn,0);assert.equal(s.market.choiceDone,choiceDone);assert.equal(s.deck.length,deckSize);
    assert.equal(allCards(s.players[0]).length,2);assert.notEqual(serialize(s),before);
    const resumed=deserialize(serialize(s));assert.throws(()=>act(resumed,{type:'UPGRADE',id:cannon.id}),/já está melhorado/);
    assert.equal(resumed.players[0].scrap,0);validateState(s);
  }
});

test('melhoria paga exige saldo, carta própria e Compra ou Montagem; erros não debitam sucata',()=>{
  const s=fixture();const own=give(s,0,'A'),other=give(s,1,'Q');s.players[0].scrap=11;
  for(const phase of ['arena','result','gameover']){s.phase=phase;assert.throws(()=>act(s,{type:'UPGRADE',id:own.id}),/Compra/);}
  const draft=newGame(['Ana','Bruno'],17);assert.throws(()=>act(draft,{type:'UPGRADE',id:draft.draft.choices[0].id}),/Compra/);
  s.phase='market';s.market={cards:[],order:purchaseOrder(2,1),turn:0,choiceDone:false};
  assert.throws(()=>act(s,{type:'UPGRADE',id:own.id}),/12 sucatas/);assert.equal(s.players[0].scrap,11);
  s.players[0].scrap=12;assert.throws(()=>act(s,{type:'UPGRADE',id:other.id}),/jogador da vez/);
  assert.equal(s.players[0].scrap,12);assert.equal(own.upgraded,false);
});

test('Q pago aumenta o HP na próxima arena; melhoria paga fica fora de novas triplas e vende como comum',()=>{
  let s=fixture();const q=give(s,0,'Q');give(s,1,'K');
  s.phase='market';s.market={cards:[],order:purchaseOrder(2,1),turn:0,choiceDone:false};s.players[0].scrap=12;
  s=act(s,{type:'UPGRADE',id:q.id});assert.equal(maxHp(s.players[0]),3);
  give(s,0,'Q',{inventory:true});give(s,0,'Q',{inventory:true});
  const index=s.deck.findIndex(c=>c.type==='Q');s.market.cards.push(s.deck.splice(index,1)[0]);s.players[0].scrap=3;
  s=act(s,{type:'BUY',id:s.market.cards[0].id});assert.equal(allCards(s.players[0]).filter(c=>c.upgraded).length,2);
  s.phase='assembly';s.assemblyPlayer=1;s=act(s,{type:'CONFIRM_ASSEMBLY'});assert.equal(s.players[0].hp,3);
  s.phase='market';s.market={cards:[],order:purchaseOrder(2,1),turn:0,choiceDone:false};
  s=act(s,{type:'SELL',id:q.id});assert.equal(s.deck.find(c=>c.id===q.id).upgraded,false);validateState(s);
});

test('ataques registram origem, alvo e cada disparo sem alterar a simultaneidade',()=>{
  const s=fixture(3);give(s,0,'A',{upgraded:true});give(s,1,'A');give(s,2,'K');
  [3,2,1].forEach((pos,i)=>s.players[i].pos=pos);
  const out=resolveRoll(s,[1,1,2]),event=out.lastRoll.events[0];
  assert.deepEqual(event.attacks,[
    {attackerId:0,targetId:1,damage:1,shot:1,totalShots:2},
    {attackerId:0,targetId:2,damage:1,shot:2,totalShots:2},
    {attackerId:1,targetId:0,damage:1,shot:1,totalShots:1}
  ]);
  assert.equal(event.simultaneous,true);assert.equal(out.result.reason,'mutual');
  assert.deepEqual(deserialize(serialize(out)).lastRoll.events[0].attacks,event.attacks);
});

test('dois tiros no mesmo alvo continuam distintos; saves antigos sem dados visuais seguem válidos',()=>{
  const s=fixture();give(s,0,'A',{upgraded:true});give(s,1,'Q',{upgraded:true});primeHp(s);
  const out=resolveRoll(s,[1,6]);assert.equal(out.players[1].hp,1);
  const attacks=out.lastRoll.events[0].attacks;assert.equal(attacks.length,2);
  assert.deepEqual(attacks.map(a=>a.targetId),[1,1]);assert.deepEqual(attacks.map(a=>a.shot),[1,2]);
  const saved=serialize(out);out.lastRoll.events.forEach(e=>delete e.attacks);
  assert.doesNotThrow(()=>deserialize(serialize(out)));
  assert.equal(deserialize(saved).players[1].hp,1);
});

// Full matches use public actions only, independently of the production bot policy.
for(const count of [2,3,4])test(`partida completa com ${count} jogadores: conservação e retomada em todas as fases`,()=>{
  let s=newGame(Array.from({length:count},(_,i)=>`Piloto ${i+1}`),450+count),steps=0,arenas=0;
  while(s.phase!=='gameover'&&steps++<12000){
    validateState(s);const p=currentPlayer(s);
    if(s.phase==='draft'){
      const pref=['K','A','Q','J'];const c=[...s.draft.choices].sort((a,b)=>pref.indexOf(a.type)-pref.indexOf(b.type))[0];s=act(s,{type:'DRAFT_PICK',id:c.id});
    }else if(s.phase==='assembly'){
      const empty=p.modules.slice(0,p.unlocked).findIndex(c=>!c);
      if(p.inventory.length&&empty>=0)s=act(s,{type:'EQUIP',id:p.inventory[0].id,slot:empty});
      else if(p.inventory.length>1)s=act(s,{type:'SELL',id:p.inventory.at(-1).id});
      else s=act(s,{type:'CONFIRM_ASSEMBLY'});
    }else if(s.phase==='market'){
      if(p.unlocked<6&&p.scrap>=p.unlocked+4)s=act(s,{type:'UNLOCK'});
      else if(!s.market.choiceDone&&p.scrap>=3&&s.market.cards.length){const c=s.market.cards.find(c=>c.type==='K')??s.market.cards[0];s=act(s,{type:'BUY',id:c.id});}
      else s=act(s,{type:'END_TURN'});
    }else if(s.phase==='arena')s=act(s,{type:'ROLL'});
    else if(s.phase==='result'){arenas++;s=act(s,{type:'NEXT_ARENA'});}
    s=deserialize(serialize(s));
  }
  assert.equal(s.phase,'gameover',`Partida não terminou em ${steps} ações.`);assert.equal(s.players[s.result.winner].points,5);assert.ok(arenas>=4);validateState(s);
});
