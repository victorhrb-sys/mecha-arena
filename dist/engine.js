export const VERSION = 1;
export const INITIAL_SCRAP = 0;
export const UPGRADE_COST = 12;
export const LAB_RULESET = 'laboratory-v2';
export const isLaboratory = s => [LAB_RULESET,'laboratory-v1'].includes(s?.ruleset);
export const draftPickCount = s => isLaboratory(s)?s.initialPicks??3:3;
export function enableLaboratory(input) {
  requireRule(!isLaboratory(input)&&input.phase==='draft'&&input.draft?.player===0&&input.draft.picks===0,'Laboratório deve começar em uma partida nova.');
  const s=copy(input);s.ruleset=LAB_RULESET;s.initialPicks=1;
  s.deck.push(...s.draft.choices,...TYPES.map(type=>({id:`${type}8`,type,upgraded:false})));
  s.players.forEach(p=>{
    p.charge=0;p.diceResults=[];
    for(const type of ['K','A'])p.inventory.push(s.deck.splice(s.deck.findIndex(c=>c.type===type),1)[0]);
  });
  draftOptions(s);
  return s;
}
export function migrateLaboratory(input) {
  if(input.ruleset!=='laboratory-v1')return input;
  validateState(input);
  const s=copy(input);s.ruleset=LAB_RULESET;s.initialPicks=3;
  s.deck.push(...TYPES.map(type=>({id:`${type}8`,type,upgraded:false})));
  return validateState(s);
}
function gainCharge(p,amount) {
  const before=p.charge;p.charge=Math.min(6,before+amount);return p.charge-before;
}
export const TYPES = ['A', 'K', 'Q', 'J'];
export const COLORS = ['#60d6df', '#ffa667', '#c195f8', '#b7d977'];
export const CARDS = {
  A: {name:'Canhão', description:'Causa 1 dano ao adversário mais avançado.', improved:'Dois disparos de 1 dano. Escolhe o alvo a cada disparo.', color:'#f47f75'},
  K: {name:'Propulsor', description:'Avança 1 casa.', improved:'Avança 2 casas.', color:'#6dd6e5'},
  Q: {name:'Escudo', description:'+1 HP máximo. Recupera 1 HP ao ativar.', improved:'+2 HP máximo. Recupera 2 HP ao ativar.', color:'#b6a0f4'},
  J: {name:'Coletor', description:'Ganha 1 sucata.', improved:'Ganha 2 sucatas.', color:'#f0c572'}
};
const copy = x => JSON.parse(JSON.stringify(x));
function requireRule(condition, message) {if (!condition) throw new Error(message);}
function random(s) {
  s.rng = (s.rng + 0x6D2B79F5) >>> 0;
  let t = s.rng; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
function shuffle(s, cards) {
  for (let i=cards.length-1;i>0;i--) {const j=Math.floor(random(s)*(i+1)); [cards[i],cards[j]]=[cards[j],cards[i]];}
  return cards;
}
export function allCards(p) {return [...p.modules.filter(Boolean), ...p.inventory];}
export function maxHp(p) {return 1+p.modules.reduce((n,c)=>n+(c?.type==='Q'?(c.upgraded?2:1):0),0);}
export function currentPlayer(s) {
  if(s.preparation?.seats) return null;
  if(s.phase==='draft') return s.players[s.draft.player];
  if(s.phase==='assembly') return s.players[s.assemblyPlayer];
  if(s.phase==='market') return s.players[s.market.order[s.market.turn]];
  return null;
}
function detach(p,id) {
  const slot=p.modules.findIndex(c=>c?.id===id);
  if(slot>=0) {const c=p.modules[slot];p.modules[slot]=null;return c;}
  const index=p.inventory.findIndex(c=>c.id===id);
  requireRule(index>=0,'Este equipamento não está com o jogador da vez.');
  return p.inventory.splice(index,1)[0];
}
function combine(s,p) {
  for(const type of TYPES) {
    let group=allCards(p).filter(c=>c.type===type&&!c.upgraded);
    while(group.length>=3) {
      const [keeper,...returned]=group.slice(0,3);keeper.upgraded=true;
      returned.forEach(c=>s.deck.push({...detach(p,c.id),upgraded:false}));
      s.notice=`${p.name} combinou três cartas de ${CARDS[type].name}: equipamento melhorado!`;
      group=allCards(p).filter(c=>c.type===type&&!c.upgraded);
    }
  }
}
function draftOptions(s) {shuffle(s,s.deck);s.draft.choices=s.deck.splice(0,3);}
// Opt-in preparation for network play. Existing solo games keep their turn order.
// Offers are reserved from the same deck, so no two players can own the same card.
export function prepareTogether(input) {
  if(input.preparation||!['draft','assembly'].includes(input.phase)) return input;
  const s=copy(input),draft=s.draft;
  s.preparation={seats:s.players.map((p,id)=>({
    picks:s.phase==='assembly'||id<draft.player?3:id===draft.player?draft.picks:0,
    choices:s.phase==='draft'&&id===draft.player?draft.choices:[],
    ready:s.phase==='assembly'&&id<s.assemblyPlayer,revision:0
  }))};
  for(const seat of s.preparation.seats) if(seat.picks<3&&!seat.choices.length) {
    shuffle(s,s.deck);seat.choices=s.deck.splice(0,3);
  }
  s.draft=null;
  return validateState(s);
}
export function newGame(names, seed=Date.now()) {
  requireRule(names.length>=2&&names.length<=4,'Escolha de 2 a 4 jogadores.');
  const s={version:VERSION,rng:Number(seed)>>>0,phase:'draft',round:1,rollCount:0,notice:'',lastRoll:null,result:null,assemblyPlayer:0,
    players:names.map((name,id)=>({id,name:String(name).trim().slice(0,24)||`Jogador ${id+1}`,color:COLORS[id],modules:Array(6).fill(null),inventory:[],unlocked:3,scrap:INITIAL_SCRAP,points:0,hp:1,maxHp:1,pos:0,alive:true,dice:null})),
    deck:TYPES.flatMap(type=>Array.from({length:8},(_,i)=>({id:`${type}${i}`,type,upgraded:false}))),
    draft:{player:0,picks:0,choices:[]},market:null};
  s.reference=Math.floor(random(s)*names.length);draftOptions(s);return s;
}
export function purchaseOrder(count,reference) {
  const first=Array.from({length:count},(_,i)=>(reference+1+i)%count);
  return [...first,...first.slice().reverse()];
}
function startMarket(s) {
  s.round++;s.phase='market';s.notice='';s.result=null;s.lastRoll=null;
  shuffle(s,s.deck);
  s.market={cards:s.deck.splice(0,s.players.length*2),order:purchaseOrder(s.players.length,s.reference),turn:0,choiceDone:false};
}
function startArena(s) {
  s.phase='arena';s.notice='';s.rollCount=0;s.lastRoll=null;
  s.players.forEach(p=>{p.maxHp=maxHp(p);p.hp=p.maxHp;p.pos=0;p.alive=true;p.dice=null;if(isLaboratory(s))p.diceResults=[];});
  checkEnd(s);
}
function finishArena(s,reason,winner=null) {
  if(s.phase!=='arena') return;
  if(winner!==null) {s.players[winner].points++;s.reference=winner;}
  s.players.forEach(p=>p.scrap+=3);
  const titles={race:'Objetivo conquistado',survival:'Último robô na arena',race_tie:'Chegada simultânea',mutual:'Destruição mútua',stalemate:'Arena sem possibilidade de vitória'};
  s.result={reason,winner,title:titles[reason],round:s.round};
  s.phase=winner!==null&&s.players[winner].points>=5?'gameover':'result';
}
function checkEnd(s) {
  const alive=s.players.filter(p=>p.alive);
  const arrived=alive.filter(p=>p.pos>=4);
  if(arrived.length>1) finishArena(s,'race_tie');
  else if(arrived.length===1) finishArena(s,'race',arrived[0].id);
  else if(!alive.length) finishArena(s,'mutual');
  else if(alive.length===1) finishArena(s,'survival',alive[0].id);
  else if(alive.every(p=>p.modules.every(c=>!c||!['A','K'].includes(c.type)))) finishArena(s,'stalemate');
  return s.phase!=='arena';
}
function snapshot(s) {return s.players.map(p=>({id:p.id,hp:p.hp,maxHp:p.maxHp,pos:p.pos,scrap:p.scrap,points:p.points,alive:p.alive,dice:p.dice,...(isLaboratory(s)?{charge:p.charge,diceResults:[...p.diceResults]}:{})}));}
// Entire equipment activations share the pre-group state. A double shot sees its
// own first shot, never another simultaneous attack. No dead shooter loses shot 2.
function attackGroup(s,actors) {
  const base=snapshot(s); const damage=s.players.map(()=>0); const lines=[],attacks=[];
  for(const actor of actors) {
    const localHp=base.map(p=>p.hp);
    for(let execution=0;execution<(actor.executions??1);execution++) {
      let lockedTarget=null;
      for(let shot=0;shot<(actor.card.upgraded?2:1);shot++) {
        const opponents=base.filter(p=>p.id!==actor.id&&p.alive&&localHp[p.id]>0);
        if(!opponents.length) break;
        const furthest=Math.max(...opponents.map(p=>p.pos));
        const targets=opponents.filter(p=>p.pos===furthest);
        const keepingTarget=isLaboratory(s)&&targets.some(p=>p.id===lockedTarget);
        const target=keepingTarget?targets.find(p=>p.id===lockedTarget):targets[Math.floor(random(s)*targets.length)];
        lockedTarget=target.id;
        localHp[target.id]--;damage[target.id]++;
        attacks.push({attackerId:actor.id,targetId:target.id,damage:1,shot:shot+1,totalShots:actor.card.upgraded?2:1,...(isLaboratory(s)?{execution:execution+1}: {})});
        lines.push(`${s.players[actor.id].name} → ${s.players[target.id].name}: −1 HP${actor.executions>1?` · execução ${execution+1}/${actor.executions}`:''}${actor.card.upgraded?` · disparo ${shot+1}/2`:''}${targets.length>1&&!keepingTarget?' · alvo sorteado':''}`);
      }
    }
  }
  damage.forEach((n,id)=>{s.players[id].hp=Math.max(0,s.players[id].hp-n);s.players[id].alive=s.players[id].hp>0;});
  return {lines,attacks};
}
export function resolveRoll(input, forcedDice) {
  requireRule(input.phase==='arena','A rolagem só está disponível na Arena.');
  const s=copy(input),lab=isLaboratory(s),chargedIds=[],criticalIds=[],emptyCriticalIds=[],chargeGains=[];s.rollCount++;
  s.players.forEach((p,i)=>{
    if(!p.alive) {p.dice=null;if(lab)p.diceResults=[];return;}
    const count=lab&&p.charge===6?2:1;
    if(count===2){p.charge=0;chargedIds.push(p.id);}
    const values=forcedDice?(Array.isArray(forcedDice[i])?forcedDice[i]:[forcedDice[i]]):Array.from({length:count},()=>1+Math.floor(random(s)*6));
    requireRule(values.length===count&&values.every(value=>Number.isInteger(value)&&value>=1&&value<=6),'Resultado de dado inválido.');p.dice=values[0];
    if(lab){
      p.diceResults=values;
      const amount=gainCharge(p,values.reduce((n,v)=>n+(v===6?2:v>=4?1:0),0));
      if(amount)chargeGains.push({playerId:p.id,amount});
      if(count===2&&values[0]===values[1]){
        (values[0]<=p.unlocked&&p.modules[values[0]-1]?criticalIds:emptyCriticalIds).push(p.id);
      }
    }
  });
  const roll={number:s.rollCount,dice:s.players.map(p=>p.dice),before:snapshot(s),events:[]};
  if(lab)Object.assign(roll,{diceResults:s.players.map(p=>[...p.diceResults]),chargedIds,criticalIds,emptyCriticalIds,chargeGains});
  for(let face=1;face<=6&&s.phase==='arena';face++) for(const type of TYPES) {
    if(s.phase!=='arena') break;
    const actors=s.players.filter(p=>p.alive&&(lab?p.diceResults.includes(face)&&face<=p.unlocked:p.dice===face)&&p.modules[face-1]?.type===type)
      .map(p=>({id:p.id,card:p.modules[face-1],executions:lab&&criticalIds.includes(p.id)?3:1}));
    if(!actors.length) continue;
    let lines=[],attacks=[];
    if(type==='A') ({lines,attacks}=attackGroup(s,actors));
    else for(const a of actors) for(let execution=0;execution<a.executions;execution++) {
      const p=s.players[a.id],n=a.card.upgraded?2:1;
      if(type==='K') {const moved=Math.min(n,4-p.pos);p.pos+=moved;lines.push(`${p.name} avança ${moved} ${moved===1?'casa':'casas'}.`);}
      if(type==='Q') {const healed=Math.min(n,p.maxHp-p.hp);p.hp+=healed;const charge=lab?gainCharge(p,n-healed):0;lines.push((healed?`${p.name} recupera ${healed} HP.`:`${p.name} já está com o HP máximo.`)+(charge?` +${charge} ${charge===1?'carga':'cargas'}.`:''));}
      if(type==='J') {p.scrap+=n;lines.push(`${p.name} ganha ${n} ${n===1?'sucata':'sucatas'}.`);}
    }
    const activeIds=actors.map(a=>a.id);
    const changed=snapshot(s);checkEnd(s);
    roll.events.push({face,type,activeIds,lines,attacks,snapshot:changed,simultaneous:actors.length>1});
  }
  if(!roll.events.length) roll.events.push({face:null,type:null,activeIds:[],lines:['Nenhum equipamento ativado. Role os dados novamente.'],snapshot:snapshot(s),simultaneous:false});
  s.lastRoll=roll;return s;
}
export function act(input, action, playerId) {
  requireRule(input&&input.version===VERSION,'Partida incompatível.');
  if(action.type==='ROLL') return resolveRoll(input);
  const s=copy(input);s.notice='';
  const preparation=s.preparation,seat=preparation?.seats[playerId];
  if(preparation) {
    requireRule(Number.isInteger(playerId)&&seat,'Identifique o jogador que está preparando o robô.');
    requireRule(!seat.ready,'Sua montagem já foi confirmada. Aguarde os outros jogadores.');
    requireRule(action.type==='DRAFT_PICK'||seat.picks===3,'Conclua suas três escolhas antes de montar.');
  }
  const improvement=['UNLOCK','UPGRADE'].includes(action.type);
  const actor=playerId??action.playerId;
  const p=preparation||improvement&&actor!==undefined?s.players[actor]:currentPlayer(s);
  const assembling=s.phase==='assembly'||Boolean(preparation&&seat.picks===3);
  if(improvement){requireRule(s.phase==='market'||assembling,'Melhorias disponíveis somente na Compra e na Montagem.');requireRule(p,'Jogador inválido.');}
  switch(action.type) {
    case 'DRAFT_PICK': {
      requireRule(s.phase==='draft','A seleção inicial já terminou.');
      const draft=seat??s.draft;
      requireRule(draft.picks<draftPickCount(s),'Você já concluiu suas escolhas.');
      const index=draft.choices.findIndex(c=>c.id===action.id);requireRule(index>=0,'Escolha uma das cartas disponíveis.');
      p.inventory.push(draft.choices.splice(index,1)[0]);s.deck.push(...draft.choices);draft.choices=[];combine(s,p);draft.picks++;
      if(preparation) {
        if(draft.picks<3){shuffle(s,s.deck);draft.choices=s.deck.splice(0,3);}
        if(preparation.seats.every(other=>other.picks===3))s.phase='assembly';
        break;
      }
      if(s.draft.picks===draftPickCount(s)) {s.draft.player++;s.draft.picks=0;}
      if(s.draft.player===s.players.length) {s.draft=null;s.phase='assembly';s.assemblyPlayer=0;}
      else draftOptions(s);
      break;
    }
    case 'EQUIP': {
      requireRule(assembling,'Reorganize os equipamentos na Montagem.');
      const slot=Number(action.slot);requireRule(Number.isInteger(slot)&&slot>=0&&slot<p.unlocked,'Este módulo está bloqueado.');
      const previousSlot=p.modules.findIndex(c=>c?.id===action.id);if(previousSlot===slot) break;
      if(action.reorder&&previousSlot>=0) {
        const [moving]=p.modules.splice(previousSlot,1);
        p.modules.splice(slot,0,moving);
        break;
      }
      const card=detach(p,action.id),occupant=p.modules[slot];p.modules[slot]=card;
      if(occupant) {if(previousSlot>=0)p.modules[previousSlot]=occupant;else p.inventory.push(occupant);}
      break;
    }
    case 'UNEQUIP':
      requireRule(assembling,'Reorganize os equipamentos na Montagem.');
      p.inventory.push(detach(p,action.id));break;
    case 'SELL': {
      requireRule(s.phase==='market'||assembling,'Venda equipamentos durante Compra ou Montagem.');
      const sold=detach(p,action.id);s.deck.push({...sold,upgraded:false});p.scrap++;s.notice=`${CARDS[sold.type].name} vendido por 1 sucata.`;break;
    }
    case 'UNLOCK': {
      requireRule(action.slot===undefined||action.slot===p.unlocked,'Construa os módulos na ordem 4 → 5 → 6.');
      requireRule(p.unlocked<6,'Todos os módulos já estão habilitados.');const cost=p.unlocked+1;
      requireRule(p.scrap>=cost,`São necessárias ${cost} sucatas.`);p.scrap-=cost;p.unlocked++;s.notice=`Módulo ${cost} desbloqueado.`;break;
    }
    case 'UPGRADE': {
      const card=allCards(p).find(c=>c.id===action.id);
      requireRule(card,'Este equipamento não está com o jogador da vez.');
      requireRule(!card.upgraded,'Este equipamento já está melhorado.');
      requireRule(p.scrap>=UPGRADE_COST,`São necessárias ${UPGRADE_COST} sucatas para melhorar.`);
      p.scrap-=UPGRADE_COST;card.upgraded=true;
      s.notice=`${CARDS[card.type].name} melhorado por ${UPGRADE_COST} sucatas.`;break;
    }
    case 'BUY': {
      requireRule(s.phase==='market'&&!s.market.choiceDone,'Esta oportunidade de compra já foi usada.');
      const index=s.market.cards.findIndex(c=>c.id===action.id);requireRule(index>=0,'A carta não está mais na loja.');
      requireRule(p.scrap>=3,'São necessárias 3 sucatas para comprar.');p.scrap-=3;
      p.inventory.push(s.market.cards.splice(index,1)[0]);s.market.choiceDone=true;combine(s,p);break;
    }
    case 'END_TURN': {
      requireRule(s.phase==='market','A fase de Compra não está ativa.');s.market.turn++;s.market.choiceDone=false;
      if(s.market.turn===s.market.order.length) {s.deck.push(...s.market.cards);s.market=null;s.phase='assembly';s.assemblyPlayer=0;}break;
    }
    case 'CONFIRM_ASSEMBLY':
      requireRule(assembling,'A Montagem não está ativa.');
      requireRule(p.inventory.length<=1,'Equipe ou venda os excedentes. Só uma carta pode ficar na reserva.');
      if(preparation) {
        seat.ready=true;
        if(preparation.seats.every(other=>other.ready)){delete s.preparation;startArena(s);}
      } else if(++s.assemblyPlayer===s.players.length) startArena(s);
      break;
    case 'NEXT_ARENA':
      requireRule(s.phase==='result','A Arena ainda não terminou ou a partida já acabou.');startMarket(s);break;
    default: throw new Error('Ação desconhecida.');
  }
  if(seat)seat.revision++;
  return s;
}
export function validateState(s) {
  requireRule(s?.version===VERSION,'Versão da partida salva não reconhecida.');
  requireRule(s.ruleset===undefined||isLaboratory(s),'Regras da partida salva não reconhecidas.');
  requireRule(['draft','assembly','market','arena','result','gameover'].includes(s.phase),'Fase inválida.');
  requireRule(Array.isArray(s.players)&&s.players.length>=2&&s.players.length<=4,'Jogadores inválidos.');
  requireRule(Number.isInteger(s.rng)&&s.rng>=0&&s.rng<=4294967295,'Sorteio salvo inválido.');
  requireRule(Number.isInteger(s.reference)&&s.reference>=0&&s.reference<s.players.length,'Referência inválida.');
  const cards=[...s.deck,...(s.draft?.choices??[]),...(s.market?.cards??[])];
  if(s.preparation) {
    requireRule(['draft','assembly'].includes(s.phase)&&s.draft===null,'Preparação simultânea fora de fase.');
    requireRule(Array.isArray(s.preparation.seats)&&s.preparation.seats.length===s.players.length,'Preparação inválida.');
    for(const seat of s.preparation.seats) {
      requireRule(Number.isInteger(seat.picks)&&seat.picks>=0&&seat.picks<=3&&typeof seat.ready==='boolean'&&(!seat.ready||seat.picks===3),'Progresso da preparação inválido.');
      requireRule(Number.isSafeInteger(seat.revision)&&seat.revision>=0,'Revisão da preparação inválida.');
      requireRule(Array.isArray(seat.choices)&&seat.choices.length===(seat.picks<3?3:0),'Oferta inicial inválida.');
      cards.push(...seat.choices);
    }
    requireRule(s.preparation.seats.some(seat=>!seat.ready),'Todos já confirmaram a montagem.');
    requireRule((s.phase==='assembly')===s.preparation.seats.every(seat=>seat.picks===3),'Fase da preparação inválida.');
  }
  s.players.forEach((p,i)=>{
    if(isLaboratory(s)) {
      requireRule(Number.isInteger(p.charge)&&p.charge>=0&&p.charge<=6,'Carga inválida.');
      requireRule(Array.isArray(p.diceResults)&&p.diceResults.length<=2&&p.diceResults.every(v=>Number.isInteger(v)&&v>=1&&v<=6),'Dados inválidos.');
    }
    requireRule(p.id===i&&typeof p.name==='string'&&p.name.length<=24,'Identidade inválida.');
    requireRule(p.modules.length===6&&Array.isArray(p.inventory),'Equipamentos inválidos.');
    requireRule(p.unlocked>=3&&p.unlocked<=6&&Number.isInteger(p.unlocked),'Módulos inválidos.');
    requireRule(p.modules.slice(p.unlocked).every(c=>c===null),'Equipamento em módulo bloqueado.');
    requireRule([p.scrap,p.points,p.hp,p.maxHp,p.pos].every(n=>Number.isInteger(n)&&n>=0),'Recursos inválidos.');
    requireRule(p.pos<=4&&typeof p.alive==='boolean','Posição inválida.');cards.push(...allCards(p));
  });
  const copies=s.ruleset===LAB_RULESET?9:8,total=copies*TYPES.length;
  if(s.ruleset===LAB_RULESET)requireRule([1,3].includes(s.initialPicks),'Preparação do Laboratório inválida.');
  requireRule(cards.length===total&&new Set(cards.map(c=>c.id)).size===total,'O baralho salvo está incompleto.');
  TYPES.forEach(type=>requireRule(cards.filter(c=>c.type===type).length===copies,'Composição de baralho inválida.'));
  cards.forEach(c=>requireRule(TYPES.includes(c.type)&&new RegExp(`^${c.type}[0-${copies-1}]$`).test(c.id)&&typeof c.upgraded==='boolean','Carta inválida.'));
  if(s.phase==='draft'&&!s.preparation) requireRule(s.draft&&s.draft.choices.length===3&&s.draft.player>=0&&s.draft.player<s.players.length&&s.draft.picks>=0&&s.draft.picks<draftPickCount(s),'Seleção inicial inválida.');
  if(s.phase==='assembly'&&!s.preparation) requireRule(s.assemblyPlayer>=0&&s.assemblyPlayer<s.players.length,'Montagem inválida.');
  if(s.phase==='market') requireRule(s.market&&s.market.turn>=0&&s.market.turn<s.market.order.length&&s.market.order.every(i=>Number.isInteger(i)&&i>=0&&i<s.players.length),'Compra inválida.');
  if(['result','gameover'].includes(s.phase)) requireRule(s.result&&typeof s.result.title==='string'&&(s.result.winner===null||s.players[s.result.winner]),'Resultado inválido.');
  return s;
}
export function serialize(s) {validateState(s);return JSON.stringify(s);}
export function deserialize(text) {return validateState(JSON.parse(text));}
