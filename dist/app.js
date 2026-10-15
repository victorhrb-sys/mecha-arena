import {currentPlayer,CARDS,COLORS,allCards,maxHp,UPGRADE_COST,isLaboratory,draftPickCount} from './engine.js';
import {createRoomClient} from './network.js';
import {createProfileClient} from './profiles.js';
import {readSolo,saveSolo,startSolo,soloAction} from './solo.js';
const humanPlayer = state => state.players[localId];
const isWaiting = state => state.preparation?state.preparation.ready:Boolean(currentPlayer(state) && currentPlayer(state).id !== localId);
import {cardIcon,scrapIcon,constructionIcon,fullHpIcon,chargeIcon} from './icons.js';
import {resourceEffects,createAutoRoller,createPlaybackClock,MIN_SPEED,MAX_SPEED} from './arena-playback.js';
import {persistentDice,DICE_POSES,DICE_PIPS,DICE_ROLL_MS,DICE_REVEAL_MS} from './dice-presentation.js';
import {marketCycle} from './market-cycle.js';
import {unseenMarketSteps} from './market-presentation.js';

const app=document.querySelector('#app'),dialog=document.querySelector('#dialog');
let room=null,localId=0,lobby=false,queuedView=null,online=false,connectionMessage='';
let joinCode=new URLSearchParams(location.search).get('sala')?.toUpperCase()??'';
let mode=joinCode?'multiplayer':'landing',soloSaved=null,soloLoadError='',botCount=3;
const localMode=()=>mode==='solo'||mode==='laboratory';
const connected=()=>localMode()||online;
const SPEED_KEY='mecha-arena.playback-speed';
const PHASE_SCENES={
  draft:{scene:'workshop',title:'Preparação',description:'Faça suas três escolhas para preparar seu robô.'},
  market:{scene:'shop',title:'Loja',description:'Compre, venda e melhore seus equipamentos.'},
  assembly:{scene:'workshop',title:'Montagem',description:'Monte seu robô no seu ritmo e confirme quando estiver pronto.'},
  arena:{scene:'arena',title:'Arena de combate',description:'Role os dados e acompanhe a disputa.'}
};
let game=null,home=true,names=[''];
const profiles=createProfileClient();
let profileError='',dialogView='';
const canImprove=()=>!home&&!lobby&&!marketPlayback&&['market','assembly'].includes(game?.phase)&&!game.preparation?.ready;
const sameName=(a,b)=>a?.normalize('NFKC').trim().replace(/\s+/gu,' ').toLowerCase()===b?.normalize('NFKC').trim().replace(/\s+/gu,' ').toLowerCase();
let selected=null,playback=null,saveError='',loadError='',savedAt='',message='',timer=null;
let sending=false,openOpponents=new Set();
let mobileMarketPane='shop',mobileArenaPane='battle';
let marketPlayback=null,marketTimer=null;
let showMarketActivity=true;
const playbackClock=createPlaybackClock();
let speedDragging=false,pieceDragging=false,renderPending=false;
const autoRoller=createAutoRoller({getPhase:()=>home?null:game?.phase,roll:()=>dispatch({type:'ROLL'}),schedule:playbackClock.schedule,cancel:playbackClock.cancel});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const robot='<img src="./assets/arena-robot.png" alt="" draggable="false">';
function scrapAmount(value){const label=String(value),unit=Math.abs(Number(value))===1?'sucata':'sucatas';return `<span class="scrap-amount" role="img" aria-label="${esc(label)} ${unit}" title="${esc(label)} ${unit}"><span aria-hidden="true">${esc(label)}</span>${scrapIcon()}</span>`;}
function effectAmount(value,type){
  const amount=String(value),n=Math.abs(Number(value));
  const label=type==='A'?`${amount} de dano`:`Avança ${amount} ${n===1?'casa':'casas'}`;
  return `<span class="effect-amount ${type==='A'?'damage-amount':'movement-amount'}" role="img" aria-label="${esc(label)}" title="${esc(label)}"><span aria-hidden="true">${esc(amount)}</span>${cardIcon(type)}</span>`;
}
function hpSymbol(maximum=false){return `<span class="hp-symbol ${maximum?'hp-maximum':''}" role="img" aria-label="${maximum?'HP máximo':'HP'}" title="${maximum?'HP máximo':'HP'}">${fullHpIcon()}${maximum?'<small aria-hidden="true">máx</small>':''}</span>`;}
function hpAmount(value,maximum=false){const label=`${value} HP${maximum?' máximo':''}`;return `<span class="hp-amount" role="img" aria-label="${esc(label)}" title="${esc(label)}"><span aria-hidden="true">${esc(value)}</span>${hpSymbol(maximum)}</span>`;}
function chargeAmount(value){const label=`${value} ${Math.abs(Number(value))===1?'carga':'cargas'}`;return `<span class="charge-amount" role="img" aria-label="${esc(label)}" title="${esc(label)}"><span aria-hidden="true">${esc(value)}</span>${chargeIcon()}</span>`;}
function resourceText(text){return esc(text).replace(/([+−-]?\d+)\s+(cargas?|sucatas?|(?:de\s+)?dano|casas?|HP(?:\s+(?:máximo|máx|max))?)\b/gi,(_,amount,unit)=>/^carga/i.test(unit)?chargeAmount(amount):/^sucata/i.test(unit)?scrapAmount(amount):/^HP/i.test(unit)?hpAmount(amount,/\s/.test(unit)):effectAmount(amount,/dano/i.test(unit)?'A':'K'));}
let helpIndex=0;
function help(text,label='esta etapa'){
  const id=`help-${helpIndex++}`;
  return `<span class="help-tip"><button type="button" class="help-trigger" aria-label="Ajuda sobre ${esc(label)}" aria-describedby="${id}">?</button><span class="help-content" id="${id}" role="tooltip">${resourceText(text)}</span></span>`;
}
function load() {
  try{showMarketActivity=localStorage.getItem('mecha-arena.market-activity')!=='hidden';}catch{}
  try{const speed=localStorage.getItem(SPEED_KEY);if(speed!==null)playbackClock.setSpeed(speed);}catch{}
}
const client=createRoomClient({onUpdate:receiveRoom,onStatus:(text,connected)=>{
  if(mode!=='multiplayer')return;
  online=connected;connectionMessage=text;if(!connected)autoRoller.stop();render();
}});
function isHost(){return localMode()||room?.hostId===localId;}
function inviteUrl(){return location.origin+location.pathname+'?sala='+room.code;}
function receiveRoom(value){
  if(mode!=='multiplayer')return;
  if(playback||marketPlayback||pieceDragging){queuedView=value;return;}
  const previous=game,wasHome=home;
  room=value;localId=value.playerId;game=value.game;lobby=!game;home=false;loadError='';
  const roomName=value.members[localId].name;
  if(!sameName(profiles.profile?.name,roomName))void updateProfile(roomName);
  else if(game?.phase==='gameover'&&previous?.phase!=='gameover')void updateProfile();
  if(previous?.phase!==game?.phase||currentPlayer(previous??{})?.id!==currentPlayer(game??{})?.id){selected=null;mobileMarketPane='shop';}
  if(selected&&game&&!allCards(humanPlayer(game)).some(c=>c.id===selected))selected=null;
  const newRoll=game?.lastRoll&&!wasHome&&(previous?.round!==game.round||previous?.lastRoll?.number!==game.lastRoll.number);
  if(dialog.open&&dialogView==='improvements'){dialog.close();showImprovements();}
  const marketSteps=wasHome?[]:unseenMarketSteps(previous,game);
  if(newRoll){mobileArenaPane='battle';animateRoll();}
  else if(marketSteps.length)startMarketPlayback(marketSteps);else render();
}
function finishMarketPlayback(){
  clearTimeout(marketTimer);marketTimer=null;marketPlayback=null;
  if(queuedView){const next=queuedView;queuedView=null;receiveRoom(next);}else render();
}
function startMarketPlayback(steps){
  autoRoller.stop();marketPlayback={steps,index:0};
  function step(){
    render();
    const choice=steps[marketPlayback.index];
    announce(`${game.players[choice.playerId].name}: ${choice.turn<game.players.length?'primeira':'segunda'} escolha concluída.`);
    marketTimer=setTimeout(()=>{
      if(++marketPlayback.index<steps.length)step();else finishMarketPlayback();
    },1100);
  }
  step();
}
async function networkAction(run){
  if(sending)return;sending=true;message='';render();
  try{await run();}catch(error){autoRoller.stop();message=error.status?error.message:'Não foi possível confirmar a ação. A sala será sincronizada; confira o estado antes de tentar de novo.';}
  finally{sending=false;render();}
}
function roomBar(){
  if(home||lobby||localMode()||online&&!sending)return '';
  return '<div class="room-bar" role="status">'+(sending?'Enviando…':'Reconectando…')+'</div>';
}
function renderLobby(){
  const host=room.members[room.hostId],full=room.members.length>=4;
  return `<main class="home-layout"><section class="setup panel lobby"><div class="entry-heading"><h1>Sala ${esc(room.code)}</h1>${help('Convide pelo link ou adicione bots. O criador inicia com 2 a 4 participantes.','sala')}</div>
    <div class="lobby-roster-heading"><h2>Participantes <span class="muted">${room.members.length}/4</span></h2>${isHost()?button(full?'Sala cheia':'＋ Bot','add-bot',`class="btn" aria-label="Adicionar bot" ${full?'disabled':''}`):''}</div>
    <ol class="room-members">${room.members.map(p=>`<li><span class="seat-color" style="--pilot:${COLORS[p.id]}">${p.id+1}</span><b>${esc(p.name)}</b><span class="member-role">${p.bot?'Bot':p.id===localId?'Você':p.id===room.hostId?'Criador':'Jogador'}</span>${p.bot&&isHost()?button('Remover','remove-bot',`class="btn subtle remove-bot" data-id="${p.id}" aria-label="Remover ${esc(p.name)}"`):''}</li>`).join('')}</ol>
    <section class="lobby-invite" aria-label="Convidar amigos"><label class="field-label" for="invite-link">Link de convite</label><div class="invite-actions"><input id="invite-link" class="room-link" readonly value="${esc(inviteUrl())}">${button('Copiar','copy-invite','class="btn" aria-label="Copiar link de convite"')}</div></section>
    ${isHost()?`<div class="lobby-controls">${button('Iniciar partida','start-room','class="btn primary" '+(room.members.length<2?'disabled':''))}</div>${room.members.length<2?'<p class="profile-note">Adicione um bot ou convide alguém.</p>':''}`:`<p class="waiting-message" role="status">Aguardando ${esc(host.name)} iniciar.</p>`}${button('Sair','leave-room','class="btn subtle" aria-label="Sair da sala"')}</section></main>`;
}
function announce(text){document.querySelector('#announcement').textContent=text;}
function button(label,action,opts=''){const match=opts.match(/class="([^"]*)"/);const cls=match?match[1]:'btn';return `<button class="${cls}" data-action="${action}" ${opts.replace(/class="[^"]*"/,'')}>${label}</button>`;}
function visiblePlayers(){return playback?game.players.map((p,i)=>({...p,...playback.snapshot[i]})):game.players;}
function chargeMeter(p){
  if(!isLaboratory(game))return '';
  const value=p.charge??0,label=`Carga ${value} de 6${value===6?' · próxima rolagem com dois dados':''}`;
  return `<span class="charge-meter ${value===6?'charge-ready':''}" role="img" aria-label="${label}" title="${label}">${chargeIcon()}<span class="charge-segments" aria-hidden="true">${Array.from({length:6},(_,i)=>`<i class="${i<value?'filled':''}"></i>`).join('')}</span><b aria-hidden="true">${value}/6</b></span>`;
}
function playerDice(p){return (p.diceResults?.length?p.diceResults:[p.dice]).map(n=>die(n,playback?.diceStage==='rolling')).join('');}
function cardDescription(c){return mode==='laboratory'&&c.type==='A'&&c.upgraded?'Dois disparos de 1 dano no mesmo alvo enquanto possível.':c.upgraded?CARDS[c.type].improved:CARDS[c.type].description;}
function playerHud(){
  const p=visiblePlayers()[localId],inArena=['arena','result','gameover'].includes(game.phase),hp=inArena?p.hp:maxHp(p),limit=inArena?p.maxHp:maxHp(p);
  return `<section class="player-hud ${combatClasses(p)}" aria-label="Seus recursos" style="--pilot:${p.color}"><div class="hud-identity"><span>Você</span><b>${esc(p.name)}</b></div><div class="hud-stat hud-hp ${inArena&&p.alive&&hp===1&&hp<limit?'low-hp':''}"><span>${inArena?'Vida':'Vida máxima'}</span><strong class="hp-counter">${hp}${inArena?`<small> / ${limit}</small>`:''}${hpSymbol(!inArena)}</strong></div><div class="hud-stat hud-scrap"><span>Sucata</span><strong class="scrap-counter">${scrapAmount(p.scrap)}</strong></div><div class="hud-stat hud-points"><span>Pontos</span><strong>${p.points}<small> / 5</small></strong></div>${chargeMeter(p)}</section>`;
}
function header(){return `<header class="header"><a class="wordmark" href="#" data-action="home" aria-label="Mecha Arena, início"><span class="logo-mark">M<span>╱</span></span><span>MECHA<strong>ARENA</strong></span></a>${home||lobby?'<div class="header-meta" aria-hidden="true"></div>':playerHud()}<nav aria-label="Partida">${mode==='multiplayer'&&(profiles.profile||!home)?button('Perfil','profile','class="btn subtle"'):''}${home||lobby?button('Ajuda','rules','class="btn subtle"'):`${button('Placar','standings','class="btn subtle"')}${button('Menu','menu','class="btn subtle"')}`}</nav></header>`;}
function phaseScene(){return game.phase==='draft'&&draftPickCount(game)===1?{...PHASE_SCENES.draft,description:'Você já tem um Canhão e um Propulsor. Escolha mais um equipamento.'}:PHASE_SCENES[marketPlayback?'market':game.phase]??PHASE_SCENES.arena;}
function phaseTitle(tip='',topic='esta fase'){
  const phase=phaseScene();
  return `<div class="phase-heading"><h1>${game.phase==='draft'?'Escolha um equipamento':phase.title}${help([phase.description,tip,'Canhão: ataca o adversário mais avançado. Propulsor: avança. Escudo: aumenta a vida máxima e cura. Coletor: ganha sucata.'].filter(Boolean).join(' '),topic)}</h1></div>`;
}
function phasebar(){
  if(marketPlayback)return '';
  if(['arena','result','gameover'].includes(game.phase))return '';
  const active=game.phase==='draft'?0:game.phase==='market'?1:game.phase==='assembly'?2:3;
  return `<div class="phasebar"><span class="round-label">Arena <strong>${game.round}</strong></span><ol>${['Preparação','Loja','Oficina','Arena'].map((label,i)=>`<li class="${active===i?'current':''}" ${active===i?'aria-current="step"':''}>${label}</li>`).join('')}</ol>${help('Chegue ao centro ou seja o último robô vivo para ganhar 1 ponto. Vence a partida quem alcançar 5 pontos. Empates não dão pontos.','vitória')}</div>`;
}
function mobilePanels(kind,choices,active){return `<nav class="mobile-panels" aria-label="${kind==='market'?'Painéis da loja':'Painéis da arena'}">${choices.map(([id,label])=>button(label,`mobile-${kind}`,`data-id="${id}" aria-pressed="${active===id}"`)).join('')}${kind==='arena'?`<span class="mobile-roll"><span>Você</span>${playerDice(visiblePlayers()[localId])}</span>`:''}</nav>`;}
function shortEffect(c){const n=c.upgraded?2:1;return {A:c.upgraded?`2 × ${effectAmount(1,'A')}`:effectAmount(1,'A'),K:effectAmount(n,'K'),Q:`${hpAmount('+'+n,true)} · Cura ${hpAmount(n)}`,J:scrapAmount('+'+n)}[c.type];}
function card(c,{mode='select',small=false,disabled=false,extra=''}={}) {
  if(mode==='select'&&game.phase==='market'&&isWaiting(game))disabled=true;
  const info=CARDS[c.type],chosen=selected===c.id;
  const action=mode==='draft'?'draft':mode==='buy'?'buy':'select';
  const description=cardDescription(c);
  const insufficient=mode==='buy'&&!game.market.choiceDone&&humanPlayer(game).scrap<3;
  const priceStatus=insufficient?'Saldo insuficiente':game?.market?.choiceDone?'Compra concluída':'Comprar';
  return `<button type="button" class="equipment ${small?'small':''} ${c.upgraded?'upgraded':''} ${chosen?'selected':''}" style="--card-color:${info.color}" data-action="${action}" data-id="${c.id}" ${disabled?'disabled':''} ${mode==='select'?'draggable="true"':''} aria-pressed="${chosen}" aria-label="${esc(`${info.name}${c.upgraded?', melhorado':''}. ${description}${mode==='buy'?` Preço: 3 sucatas. ${priceStatus}.`:''}`)}" title="${esc(`${info.name}: ${description}`)}"><span class="card-top"><span class="card-reference" title="Referência do baralho: ${c.type}">${c.type}</span>${c.upgraded?'<span class="upgrade-badge">Melhorado</span>':''}</span><span class="card-symbol">${cardIcon(c.type)}</span><span class="card-name">${info.name}</span><span class="card-desc">${shortEffect(c)}</span><span class="mobile-card-effect" aria-hidden="true">${shortEffect(c)}</span>${mode==='draft'||mode==='buy'||extra?`<span class="card-foot ${mode==='buy'?`market-price ${insufficient?'insufficient':''}`:''}">${extra||(mode==='draft'?'Escolher':scrapAmount(3))}</span>`:''}</button>`;
}
function moduleConstruction(p,index){
  const cost=index+1,next=index===p.unlocked,inMarket=['market','assembly'].includes(game.phase)&&p.id===localId&&!playback&&!sending&&connected()&&!game.preparation?.ready;
  const enabled=next&&inMarket&&p.scrap>=cost;
  const status=!next?`Após o módulo ${index}`:!inMarket?'Aguarde a animação':p.scrap<cost?`Faltam ${cost-p.scrap} sucatas`:'Construir';
  return `<button type="button" class="locked-content module-construction ${next?'next-module':''}" data-action="unlock" data-slot="${index}" ${enabled?'':'disabled'} aria-label="${esc(`Construir módulo ${cost} por ${cost} sucatas. ${status}.`)}" title="${esc(`Módulo ${cost} em construção. ${status}. Liberação na ordem 4 → 5 → 6.`)}"><span class="construction-symbol">${constructionIcon()}</span>${scrapAmount(cost)}</button>`;
}
function standings(){return `<div class="match-standings">${visiblePlayers().map(x=>`<div class="standing ${x.id===localId?'active':''}" style="--pilot:${x.color}"><span class="pilot-number">${x.id+1}</span><div><b>${esc(x.name)} ${x.id!==localId?opponentPreview(x):''}<span class="role-tag">${x.bot?'Bot':x.id===localId?'Você':'Jogador'}</span></b><small>${x.unlocked} módulos · ${scrapAmount(x.scrap)}</small>${chargeMeter(x)}</div><strong aria-label="${x.points} de 5 pontos">${x.points}<small>/5</small></strong></div>`).join('')}</div>`;}
function opponentPreview(player,{arena=false,contentOnly=false}={}){
  const memory=game.botMemory,p=arena?player:memory?.players?.find(x=>x.id===player.id),id=`history-${player.id}`;
  const positioned=Array.isArray(p?.modules);
  const pieces=positioned?p.modules:p?.cards??[];
  const content=p?`<span class="preview-caption">${arena?`${esc(player.name)} · Arena ${game.round}`:`Arena ${memory.round}`}${positioned?'':' · posições não registradas'}</span><span class="preview-modules">${pieces.map((c,i)=>{
    const locked=positioned&&i>=p.unlocked;
    const label=`${positioned?`Módulo ${i+1}: `:''}${c?`${CARDS[c.type].name}${c.upgraded?', melhorado':''}`:locked?'Bloqueado':'Vazio'}`;
    return `<span class="preview-module ${locked?'locked':''}" role="img" aria-label="${esc(label)}" title="${esc(label)}" ${c?`style="--card-color:${CARDS[c.type].color}"`:''}>${positioned?`<small aria-hidden="true">${i+1}</small>`:''}${c?cardIcon(c.type):`<span aria-hidden="true">${locked?'·':'—'}</span>`}${c?.upgraded?'<i aria-hidden="true">✦</i>':''}</span>`;
  }).join('')}</span>`:'<span class="preview-caption">Ainda sem arena registrada.</span>';
  if(contentOnly)return content;
  return `<span class="help-tip history-tip"><button type="button" class="help-trigger" data-action="history-tip" aria-label="Última montagem revelada de ${esc(player.name)}" aria-describedby="${id}" aria-expanded="false">?</button><span class="help-content history-preview" id="${id}" role="tooltip">${content}</span></span>`;
}
function slots(p,{editable=false,compact=false}={}){
  return `<div class="modules ${compact?'compact':''}">${p.modules.map((c,i)=>{
    const locked=i>=p.unlocked;
    if(compact)return `<div class="mini-module ${playback?.activeIds?.includes(p.id)&&game.lastRoll.events[playback.eventIndex]?.face===i+1?'module-active':''} ${locked?'locked':''}" style="${c?`--card-color:${CARDS[c.type].color}`:''}" title="${esc(locked?`Módulo ${i+1} bloqueado`:c?`${i+1}: ${CARDS[c.type].name}${c.upgraded?' melhorado':''}`:`Módulo ${i+1} vazio`)}"><small>${i+1}</small>${locked?'<b>·</b>':c?cardIcon(c.type):'<b>—</b>'}${c?`<span class="mini-reference">${c.type}</span>`:''}${c?.upgraded?'<i aria-label="Melhorado">✦</i>':''}</div>`;
    return `<div class="module ${locked?'locked':''} ${selected&&editable&&!locked?'can-equip':''}" data-slot="${i}"><div class="module-label">${i+1}</div>${locked?moduleConstruction(p,i):c?card(c,{small:true,disabled:!editable&&game.phase!=='market'}):`<button class="empty-slot" data-action="equip" data-slot="${i}" aria-label="${selected?'Equipar no':'Vazio: módulo'} ${i+1}" ${!editable||!selected?'disabled':''}><b>+</b><span>${selected&&editable?'Equipar':'Vazio'}</span></button>`}${editable&&c&&selected&&selected!==c.id?`<button class="swap-btn" data-action="equip" data-slot="${i}" aria-label="Inserir equipamento no módulo ${i+1}">Inserir</button>`:''}</div>`;
  }).join('')}</div>`;
}
function selectedTools(p){
  const c=allCards(p).find(c=>c.id===selected);if(!c)return '<div class="selection-tools is-empty" aria-hidden="true"></div>';
  const equipped=p.modules.some(x=>x?.id===c.id);
  return `<div class="selection-tools"><span><b>${esc(CARDS[c.type].name)}${c.upgraded?' melhorado':''}</b><small>${shortEffect(c)} ${help(cardDescription(c),CARDS[c.type].name)}</small></span><div>${game.phase==='assembly'&&equipped?button('Retirar','unequip',`data-id="${c.id}"`):''}${['market','assembly'].includes(game.phase)&&!c.upgraded?button(`Melhorar · ${scrapAmount(UPGRADE_COST)}`,'upgrade',`data-id="${c.id}" aria-label="Melhorar ${esc(CARDS[c.type].name)} por ${UPGRADE_COST} sucatas" title="${esc(cardDescription({...c,upgraded:true}))}" ${p.scrap<UPGRADE_COST?'disabled':''}`):''}${button(`Vender · ${scrapAmount('+1')}`,'sell',`data-id="${c.id}" aria-label="Vender ${esc(CARDS[c.type].name)} por 1 sucata"`)}</div></div>`;
}
function inventory(p){return `<div class="inventory-section"><div class="panel-title"><h2>Reserva <span class="count">${p.inventory.length}</span> ${help('Ao confirmar a montagem, você pode guardar uma carta na reserva. Equipe ou venda as demais. Vendas rendem 1 sucata.','reserva')}</h2></div><div class="inventory-cards">${p.inventory.length?p.inventory.map(c=>card(c,{small:true})).join(''):'<p class="empty-reserve">Reserva vazia.</p>'}</div></div>`;}
function renderHome(){
  if(mode==='landing')return `<main class="mode-home"><h1 class="menu-title">MECHA<span>ARENA</span></h1><nav class="mode-options" aria-label="Modos de jogo"><button class="mode-option" data-action="choose-solo">Single player</button><button class="mode-option" data-action="choose-multiplayer">Multiplayer</button><button class="mode-option" data-action="choose-laboratory">Laboratório</button></nav><div class="menu-future-options" aria-label="Comunidade e contato">${['Apoie o projeto','Contato','Discord'].map((label,i)=>`<span class="menu-future"><button type="button" class="mode-option" data-action="coming-soon" aria-describedby="coming-soon-${i}">${label}</button><span class="menu-tooltip" id="coming-soon-${i}" role="tooltip">Em breve</span></span>`).join('')}</div></main>`;
  if(localMode())return `<main class="home-layout"><section class="setup panel">${button('Voltar','home','class="btn subtle"')}<div class="entry-heading"><h1>${mode==='laboratory'?'Laboratório':'Single player'}</h1>${help(mode==='laboratory'?'Teste regras experimentais contra bots. Progresso salvo neste navegador.':'Jogue contra bots. Progresso salvo neste navegador.','este modo')}</div>${soloLoadError?`<p class="warning" role="alert">${esc(soloLoadError)}</p>`:''}${soloSaved?`<div class="resume-box"><div><b>${esc(soloSaved.players[0].name)} · Arena ${soloSaved.round}</b>${soloSaved.phase==='gameover'?'<span>Concluída</span>':''}</div>${button('Continuar','resume-solo','class="btn primary"')}</div>`:''}<form id="solo-form"><label class="field-label" for="solo-name">Nome</label><div class="name-fields solo-name"><label><input id="solo-name" data-name-index="0" maxlength="24" value="${esc(names[0])}" autocomplete="nickname" required></label></div><label class="field-label" for="bot-count">Adversários</label><select id="bot-count" name="bots">${[1,2,3].map(n=>`<option value="${n}" ${n===botCount?'selected':''}>${n} ${n===1?'bot':'bots'}</option>`).join('')}</select>${soloSaved?'<p class="profile-note">Nova partida substitui a salva.</p>':''}<button type="submit" class="btn primary start-btn">${soloSaved?'Nova partida':'Jogar'}</button></form></section></main>`;
  const profile=profiles.profile;
  if(!profile)return `<main class="home-layout"><section class="setup panel">${button('Voltar','home','class="btn subtle"')}<div class="entry-heading"><h1>Multiplayer</h1>${help('Crie uma sala ou entre por convite. Quem usa o mesmo nome acessa o mesmo perfil público.','multiplayer')}</div><form id="profile-form"><label class="field-label" for="pilot-name">Nome de usuário</label><div class="name-fields solo-name"><label><input id="pilot-name" name="username" data-name-index="0" maxlength="24" value="${esc(names[0])}" autocomplete="nickname" required></label></div><p class="profile-note">Perfil público. Sem senha.</p><button type="submit" class="btn primary start-btn">Continuar</button></form>${joinCode?`<p class="profile-note">Convite · ${esc(joinCode)}</p>`:''}</section></main>`;
  return `<main class="home-layout"><section class="setup panel">${button('Voltar','home','class="btn subtle"')}<div class="entry-heading"><h1>Multiplayer</h1>${help('Crie uma sala para amigos e bots ou entre com um código de convite.','salas')}</div>
  <div class="profile-identity"><span class="profile-initial" aria-hidden="true">${esc(Array.from(profile.name)[0])}</span><div><b>${esc(profile.name)}</b></div>${button('Trocar','change-profile','class="btn subtle" aria-label="Trocar usuário"')}</div>${profileError?`<p class="profile-note" role="status">${esc(profileError)} ${button('Tentar novamente','profile-refresh','class="btn subtle"')}</p>`:''}
  ${client.session&&sameName(client.session.name,profile.name)?`<div class="resume-box"><b>Sala ${esc(client.session.code)}</b>${button('Retomar','resume')}</div>`:''}
  <form id="setup-form"><button type="submit" name="mode" value="create" class="btn primary start-btn">Criar sala</button><div class="room-divider">ou</div><label class="field-label" for="room-code">Código da sala</label><input id="room-code" class="room-code" maxlength="6" value="${esc(joinCode)}" placeholder="ABC234" autocapitalize="characters" autocomplete="off" spellcheck="false"><button type="submit" name="mode" value="join" class="btn start-btn">Entrar</button></form></section></main>`;
}

function profileStats(profile){
  if(!profile.stats)return '<p class="profile-note">Carregando estatísticas…</p>';
  const s=profile.stats;
  return `<dl class="profile-stats"><div><dt>Partidas</dt><dd>${s.matches}</dd></div><div><dt>Vitórias</dt><dd>${s.wins}</dd></div><div><dt>Aproveitamento</dt><dd>${s.winRate}%</dd></div><div><dt>Arenas vencidas</dt><dd>${s.arenaWins}</dd></div></dl>`;
}
async function updateProfile(name){
  try{profileError='';await(name?profiles.select(name):profiles.refresh());}
  catch(error){profileError=error.status?error.message:'Não foi possível atualizar o perfil agora. Suas partidas continuam salvas.';}
  if(home)render();
}
function profileBody(profile){
  const date=timestamp=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(timestamp));
  return `<p class="profile-note">Perfil público ${help('Sem senha. O mesmo nome abre este perfil em outro aparelho.','perfil')}</p>${profileError?`<p role="status">${esc(profileError)}</p>`:''}${profileStats(profile)}<h3>Últimas partidas</h3>${profile.history?.length?`<ol class="profile-history">${profile.history.map(match=>`<li><div><strong>${match.won?'Vitória':'Derrota'}</strong><time>${date(match.playedAt)}</time></div><p>${match.players.map(p=>`${esc(p.name)}${p.bot?' (bot)':''}: ${p.points}`).join(' · ')}</p><small>${match.botCount?`Com ${match.botCount} ${match.botCount===1?'bot':'bots'} · `:''}${match.arenas} arenas · Vencedor: ${esc(match.winner)}</small></li>`).join('')}</ol>`:'<p class="profile-note">Nenhuma partida concluída.</p>'}`;
}
async function showProfile(){
  if(mode!=='multiplayer')return;
  autoRoller.stop();await updateProfile(!home?room.members[localId].name:undefined);
  if(profiles.profile)modal(esc(profiles.profile.name),profileBody(profiles.profile),button('Fechar','close','class="btn primary"'));
}

function renderDraft(){const p=humanPlayer(game);return `<main class="work-layout draft-layout"><section class="work-main">
  <div class="section-heading decision-heading">${phaseTitle('Escolha uma carta sem pagar sucata. As outras duas voltam ao baralho. Três cartas comuns iguais combinam em um equipamento melhorado, que ativa duas vezes.','escolha de equipamentos')}<span class="choice-progress">${game.draft.picks+1}<small> / ${draftPickCount(game)} ${draftPickCount(game)===1?'escolha':'escolhas'}</small></span></div>
  ${preparationProgress()}<div class="draft-cards">${game.draft.choices.map(c=>card(c,{mode:'draft'})).join('')}</div>
  ${p.inventory.length?`<div class="draft-collected"><span>${draftPickCount(game)===1?'Equipamentos iniciais':'Escolhidos'}</span>${p.inventory.map(c=>`<span class="collected-item" style="--card-color:${CARDS[c.type].color}" title="${esc(CARDS[c.type].name)}${c.upgraded?' melhorado':''}">${cardIcon(c.type)}<b>${CARDS[c.type].name}</b>${c.upgraded?'<small>✦</small>':''}</span>`).join('')}</div>`:''}
  </section></main>`;}
function renderAssembly(){const p=humanPlayer(game);return `<main class="work-layout"><section class="work-main assembly-work">
  <div class="assembly-toolbar decision-heading">${phaseTitle('Cada módulo corresponde a uma face do dado. Arraste um equipamento até ele, ou selecione a carta e clique no módulo. Ao mover entre módulos, as peças intermediárias se deslocam mantendo a ordem. Módulos vazios não ativam.','montagem')}
    ${button('Pronto ✓','confirm','class="btn primary" '+(p.inventory.length>1?'disabled':''))}
  </div>
  ${preparationProgress()}
  ${p.inventory.length>1?`<p class="assembly-warning">Equipe ou venda ${p.inventory.length-1} ${p.inventory.length===2?'carta':'cartas'}.</p>`:''}
  <div class="assembly-body">${slots(p,{editable:true})}${inventory(p)}</div>${selectedTools(p)}
  </section></main>`;}
function marketEvents(){return game.marketActivity?.round===game.round?game.marketActivity.events:[];}
function marketActionChip(event){
  const verbs={BUY:'Comprou',SELL:'Vendeu',UPGRADE:'Melhorou',UNLOCK:'Construiu',PASS:'Passou'};
  const verb=verbs[event.type],piece=event.card;
  const label=`${verb}${piece?` ${CARDS[piece.type].name}${piece.upgraded?' melhorado':''}`:''}${event.module?` módulo ${event.module}`:''}${event.scrap?` · ${event.scrap>0?'+':''}${event.scrap} sucatas`:''}`;
  return `<span class="market-action-chip action-${event.type.toLowerCase()}" role="img" aria-label="${esc(label)}" title="${esc(label)}"><span aria-hidden="true">${event.type==='PASS'?'→ ':event.type==='UPGRADE'?'✦ ':''}${verb}</span>${piece?`<span class="market-action-piece" style="--card-color:${CARDS[piece.type].color}">${cardIcon(piece.type)}${piece.upgraded?'<sup aria-hidden="true">✦</sup>':''}</span>`:event.module?`<span class="market-action-module" aria-hidden="true">${constructionIcon()}${event.module}</span>`:''}${event.scrap?scrapAmount(`${event.scrap>0?'+':''}${event.scrap}`):''}</span>`;
}
function marketActivityRows(compact=false){
  const events=marketEvents();
  return game.players.filter(p=>p.id!==localId).map(p=>{
    const all=events.filter(e=>e.playerId===p.id),own=compact?all.slice(-1):all;
    return `<div class="market-activity-row"><b class="market-actor" style="--pilot:${p.color}">${esc(p.name)}</b><div class="market-action-list">${own.length?own.map(marketActionChip).join(''):'<span class="market-no-action">—</span>'}</div></div>`;
  }).join('');
}
function marketActivityPanel(){return !showMarketActivity?'':`<section class="market-activity" aria-label="Decisões dos adversários nesta loja"><div class="market-activity-heading"><b>Adversários</b>${button('Histórico','market-log','class="btn subtle"')}</div><div class="market-activity-rows">${marketActivityRows(true)}</div></section>`;}
function showMarketLog(){modal('Decisões da loja',`<p class="market-log-note">Arena ${game.round} · Ações registradas nesta fase de compras.</p>${marketCyclePanel()}<div class="market-log">${marketActivityRows()}</div>`,button('Voltar ao jogo','close','class="btn primary"'));}
function marketCyclePanel(state=game){
  const steps=marketCycle(state),count=game.players.length,current=steps.find(s=>s.status==='current');
  if(!current)return '';
  const player=game.players[current.playerId],name=player.id===localId?'Você':player.name;
  const returning=current.pass==='return';
  return `<section class="market-cycle" aria-label="Ordem das escolhas da loja"><div class="cycle-heading"><b>${esc(name)} · ${returning?'2ª':'1ª'} escolha</b><span>${returning?'← Volta':'Ida →'} · ${current.index+1}/${steps.length}</span></div><div class="cycle-route" style="--cycle-count:${count}"><span class="cycle-lane cycle-outward">Ida →</span><span class="cycle-lane cycle-return">← Volta</span><ol class="cycle-steps">${steps.map(step=>{
    const p=game.players[step.playerId];
    return `<li class="cycle-step ${step.pass} ${step.status} ${step.column===count?'edge-right':''} ${step.column===1?'edge-left':''}" style="--pilot:${p.color};grid-column:${step.column};grid-row:${step.pass==='outward'?1:2}" ${step.status==='current'?'aria-current="step"':''} aria-label="${step.index+1}: ${esc(p.id===localId?'Você':p.name)}, ${step.pass==='outward'?'primeira':'segunda'} escolha, ${step.status==='done'?'concluída':step.status==='current'?'vez atual':'aguardando'}"><span class="cycle-seat" aria-hidden="true">${step.status==='done'?'✓':p.id+1}</span><span class="cycle-name">${p.id===localId?'Você':esc(p.name)}</span></li>`;
  }).join('')}</ol><span class="cycle-bend" aria-hidden="true">↴</span></div></section>`;
}
function renderMarketPlayback(){
  const step=marketPlayback.steps[marketPlayback.index],player=game.players[step.playerId];
  const state={...game,phase:'market',market:step};
  return `<main class="work-layout"><section class="work-main market-work market-replay"><div class="assembly-toolbar decision-heading"><div><h1>Compras dos bots</h1></div>${button('Ir para o jogo','skip-market','class="btn subtle"')}</div>${marketCyclePanel(state)}<div class="market-replay-action" role="status"><b style="color:${player.color}">${esc(player.name)}</b>${step.actions.map(marketActionChip).join('')}</div><div class="market-cards">${step.cards.map(c=>`<div class="replay-card ${c.id===step.boughtId?'replay-bought':''}">${card(c,{small:true,disabled:true})}${c.id===step.boughtId?'<span class="replay-receipt">Comprado ✓</span>':''}</div>`).join('')}</div></section></main>`;
}
function renderMarket(){
  const p=humanPlayer(game);
  return `<main class="work-layout"><section class="work-main market-work">
    <div class="assembly-toolbar decision-heading">${phaseTitle('Clique numa carta para comprar por 3 sucatas e avançar. Faça vendas, melhorias e construções antes de comprar. Você tem duas oportunidades por arena.','mercado')}${button(game.market.choiceDone?'Concluir compra →':'Passar →','end-turn',`class="btn primary" ${isWaiting(game)?'disabled':''}`)}</div>
    ${marketCyclePanel()}${mobilePanels('market',[['shop','Loja'],['robot','Meu robô']],mobileMarketPane)}
    <div class="market-body" data-mobile-pane="${mobileMarketPane}"><section class="market-shop"><div class="market-context"><span>${isWaiting(game)?`${esc(currentPlayer(game).name)} está escolhendo…`:game.market.choiceDone?'Equipamento comprado':`${scrapAmount(3)} por carta`}</span>${help(game.market.order.map(id=>id===localId?'Você':game.players[id].name).join(' → '),'ordem das compras')}</div>
    ${marketActivityPanel()}<div class="market-cards">${game.market.cards.length?game.market.cards.map(c=>card(c,{mode:'buy',small:true,disabled:isWaiting(game)||game.market.choiceDone||p.scrap<3})).join(''):'<p class="empty-reserve">Não há mais cartas nesta loja.</p>'}</div>
    ${!isWaiting(game)&&!game.market.choiceDone&&p.scrap<3?'<p class="assembly-warning">Saldo insuficiente.</p>':''}</section>
    <section class="market-hangar"><div class="owned-heading"><h2>Seu robô ${help('Selecione uma peça para vender ou melhorar por 12 sucatas. Na Compra ou na Montagem, construa um módulo clicando no próprio espaço: primeiro o 4, depois o 5 e o 6. Você reorganiza os equipamentos na montagem.','equipamentos')}</h2></div>
    <div class="hangar-body">${slots(p)}${inventory(p)}</div>${selectedTools(p)}</section></div></section></main>`;
}

function preparationProgress(){
  if(!game.preparation)return '';
  return `<div class="preparation-progress" aria-label="Preparação dos jogadores">${game.preparation.players.map(p=>`<span class="${p.ready?'ready':''}"><b>${p.id===localId?'Você':esc(game.players[p.id].name)}</b><small>${p.ready?'Pronto ✓':p.picks<3?`Escolhendo · ${p.picks}/3`:'Montando'}</small></span>`).join('')}</div>`;
}
function renderWaiting(){
  const p=humanPlayer(game),other=currentPlayer(game);
  if(game.preparation)return `<main class="work-layout"><section class="work-main"><div class="decision-heading">${phaseTitle()}</div>${preparationProgress()}<div class="bot-progress panel" role="status"><h2>Pronto ✓</h2><p>Aguardando os demais.</p></div><div class="waiting-loadout">${slots(p,{compact:true})}</div></section></main>`;
  return `<main class="work-layout"><section class="work-main"><div class="decision-heading">${phaseTitle()}</div><div class="bot-progress panel" role="status"><span class="bot-progress-mark" aria-hidden="true">⚙</span><h2>Aguardando ${esc(other?.name??'outro jogador')}</h2>${help('Você continua quando chegar sua vez. Quem desconectar pode voltar pelo mesmo navegador.','espera')}</div>${game.phase==='market'?marketActivityPanel():''}<div class="waiting-loadout">${slots(p,{compact:true})}</div></section></main>`;
}

const anchors=[[300,397],[57,220],[300,43],[543,220]];
function activeAttacks(){return playback?(game.lastRoll?.events[playback.eventIndex]?.attacks??[]):[];}
function activeResources(){return playback?.diceStage==='reveal'?(game.lastRoll?.chargeGains??[]).map(g=>({...g,type:'charge'})):playback?resourceEffects(game.lastRoll,playback.eventIndex):[];}
function gainLabel(effect){return effect.type==='J'?`+${effect.amount} ${effect.amount===1?'sucata':'sucatas'}`:effect.amount?`+${effect.amount} HP`:'HP cheio';}
function resourceBadge(p,compact=false){
  const effect=activeResources().find(e=>e.playerId===p.id);if(!effect)return '';
  if(effect.type==='charge')return `<span class="resource-gain charge-gain ${compact?'inline-gain':'token-gain'}">${chargeAmount('+'+effect.amount)}</span>`;
  if(effect.charge)return `<span class="resource-gain shield-gain ${compact?'inline-gain':'token-gain'}">${effect.amount?hpAmount('+'+effect.amount)+' · ':''}${chargeAmount('+'+effect.charge)}</span>`;
  if(effect.type==='Q'&&effect.amount===0)return `<span class="resource-gain shield-gain hp-full ${compact?'inline-gain':'token-gain'}" role="img" aria-label="HP cheio" title="HP cheio">${fullHpIcon()}</span>`;
  return `<span class="resource-gain ${effect.type==='J'?'scrap-gain':'shield-gain'} ${compact?'inline-gain':'token-gain'}">${effect.type==='J'?scrapAmount('+'+effect.amount):`${hpAmount('+'+effect.amount)}`}</span>`;
}
function combatClasses(p){const attacks=activeAttacks(),resource=activeResources().find(e=>e.playerId===p.id);return `${attacks.some(a=>a.attackerId===p.id)?'is-shooting':''} ${attacks.some(a=>a.targetId===p.id)?'is-hit':''} ${resource?.type==='J'?'is-collecting':resource?.type==='Q'?'is-shielding':''}`;}
function boardPoint(players,p){
  const laneIds=players.length===2?[0,2]:players.length===3?[0,1,3]:[0,1,2,3];
  const [x,y]=anchors[laneIds[p.id]],arrived=players.filter(q=>q.pos===4);
  const offset=p.pos===4&&arrived.length>1?(arrived.findIndex(q=>q.id===p.id)-(arrived.length-1)/2)*40:0;
  return {x:x+(300-x)*p.pos/4+offset,y:y+(220-y)*p.pos/4};
}
function attackPaths(players){
  return activeAttacks().map((attack,i)=>{
    const from=boardPoint(players,players[attack.attackerId]),to=boardPoint(players,players[attack.targetId]);
    const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length;
    const inset=Math.min(38,length/4),bend=26+(attack.shot-1)*26+((attack.execution??1)-1)*8;
    const x1=from.x+ux*inset,y1=from.y+uy*inset,x2=to.x-ux*inset,y2=to.y-uy*inset;
    const cx=(x1+x2)/2-uy*bend,cy=(y1+y2)/2+ux*bend;
    const color=players[attack.attackerId].color,marker=`shot-${i}`,path=`M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
    return `<g class="attack-route" style="--shot-color:${color};--shot-delay:${attack.execution?((attack.execution-1)*.35+(attack.shot-1)*.18):(attack.shot-1)*.6}s"><defs><marker id="${marker}" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L8 4L0 8Z" fill="${color}"/></marker></defs><path class="attack-shadow" d="${path}"/><path class="attack-line" d="${path}" pathLength="100" marker-end="url(#${marker})"/><path class="attack-pulse" d="${path}" pathLength="100"/></g>`;
  }).join('');
}
function singleDiePresentation(d,revealing){
  const [rx,ry]=DICE_POSES[d.face]??[0,0];
  return `<div class="dice-unit" role="img" aria-label="${esc(!d.face?'Dado ainda não rolado':revealing?`Dado ${d.face}, ${d.card?CARDS[d.card.type].name:'sem efeito'}`:'Dado rolando')}"><div class="dice-space"><div class="dice-toss"><div class="dice-cube ${d.face?'':'dice-unrolled'}" data-rx="${rx}" data-ry="${ry}" style="transform:rotateX(${rx}deg) rotateY(${ry}deg)">${[1,2,3,4,5,6].map(face=>`<span class="dice-face dice-face-${face}" aria-hidden="true">${Array.from({length:9},(_,i)=>`<i class="${d.face&&DICE_PIPS[face].includes(i+1)?'dice-pip':''}"></i>`).join('')}</span>`).join('')}</div></div></div><span class="dice-cloud" aria-hidden="true">${d.card?`${cardIcon(d.card.type)}${d.card.upgraded?'<sup>✦</sup>':''}`:'—'}</span></div>`;
}
function dicePresentation(){
  const rolling=playback?.diceStage==='rolling',revealing=!rolling,pulse=playback?.diceStage==='reveal';
  const all=persistentDice(game.players,game.lastRoll);
  return `<div class="dice-presentation ${revealing?'dice-revealed':''} ${pulse?'dice-pulse':''}" aria-label="${revealing?'Resultados dos dados':'Dados rolando'}"><div class="dice-tray">${game.players.map(p=>{
    const dice=all.filter(d=>d.id===p.id),charged=dice.length===2,critical=game.lastRoll?.criticalIds?.includes(p.id),empty=game.lastRoll?.emptyCriticalIds?.includes(p.id);
    return `<div class="dice-player ${charged?'charged-dice':''} ${critical&&pulse?'critical-dice':''}" style="--dice-color:${p.color}"><span class="dice-owner">${p.id===localId?'Você':esc(p.name)}</span><div class="dice-pair">${dice.map(d=>singleDiePresentation(d,revealing)).join('')}</div>${charged?`<span class="dice-caption">${rolling?'Carga':empty?'Sem efeito':critical?'Crítico':'2 dados'}</span>`:''}</div>`;
  }).join('')}</div></div>`;
}
function rollHighlight(){
  const roll=game.lastRoll,stage=playback?.diceStage;
  if(!stage||!roll?.chargedIds?.length)return '';
  const critical=stage==='reveal'&&roll.criticalIds.length;
  const ids=critical?roll.criticalIds:stage==='rolling'?roll.chargedIds:[];
  if(!ids.length)return '';
  return `<div class="roll-highlight ${critical?'critical-highlight':'charged-highlight'}" role="status"><strong>${critical?'CRÍTICO':'Rolagem carregada'}</strong><span>${ids.map(id=>id===localId?'Você':esc(game.players[id].name)).join(' · ')}</span></div>`;
}
function animateDiceElements(){
  if(playback?.diceStage!=='rolling'||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  for(const cube of app.querySelectorAll('.dice-cube:not(.dice-unrolled)')){
    const x=Number(cube.dataset.rx),y=Number(cube.dataset.ry);
    const motion=cube.animate([{transform:`rotateX(${x-540}deg) rotateY(${y-450}deg)`},{transform:`rotateX(${x}deg) rotateY(${y}deg)`}],{duration:DICE_ROLL_MS,easing:'cubic-bezier(.15,.6,.3,1)',fill:'both'});
    motion.currentTime=playback.diceTime??0;motion.playbackRate=playbackClock.speed;
    const bounce=cube.parentElement.animate([{transform:'translateY(-25px) rotate(-12deg)'},{transform:'translateY(0) rotate(7deg)',offset:.42},{transform:'translateY(-10px) rotate(-4deg)',offset:.6},{transform:'translateY(0) rotate(0)',offset:.8},{transform:'translateY(0) rotate(0)'}],{duration:DICE_ROLL_MS,fill:'both'});
    bounce.currentTime=playback.diceTime??0;bounce.playbackRate=playbackClock.speed;
  }
}
function board(players){
  const laneIds=players.length===2?[0,2]:players.length===3?[0,1,3]:[0,1,2,3];
  const track=players.map((p,i)=>{
    const [x,y]=anchors[laneIds[i]];
    return `<g style="color:${p.color}"><path d="M${x},${y} L300,220" stroke="currentColor" opacity=".3" stroke-width="26"/>${Array.from({length:4},(_,k)=>{const xx=x+(300-x)*k/4,yy=y+(220-y)*k/4;return `<circle cx="${xx}" cy="${yy}" r="17" fill="#151c20" stroke="currentColor" opacity="${p.pos>k?'.25':'.8'}"/><text x="${xx}" y="${yy+5}" fill="currentColor" text-anchor="middle" font-size="14" font-family="monospace">${k}</text>`;}).join('')}</g>`;
  }).join('');
  return `<div class="arena-board"><svg class="track" viewBox="0 0 600 440" aria-hidden="true">${track}<circle cx="300" cy="220" r="36" fill="#2b2920" stroke="#e8bf73" stroke-width="2"/><path d="M300 198L314 220L300 242L286 220Z" fill="#e8bf73"/></svg><svg class="attack-overlay" viewBox="0 0 600 440" aria-hidden="true">${attackPaths(players)}</svg>${players.map(p=>{
    const {x,y}=boardPoint(players,p),damage=activeAttacks().filter(a=>a.targetId===p.id).reduce((n,a)=>n+a.damage,0);
    return `<div class="robot-token ${p.alive?'':'destroyed'} ${playback?.activeIds?.includes(p.id)?'activating':''} ${combatClasses(p)}" style="--pilot:${p.color};left:${x/6}%;top:${y/4.4}%" title="${esc(`${p.name}: posição ${p.pos}, ${p.hp} HP`)}"><div>${robot}${p.id!==localId?`<button type="button" class="arena-inspect" data-action="arena-inspect" data-id="${p.id}" aria-label="Ver equipamentos de ${esc(p.name)}" aria-expanded="false"></button>`:''}</div><span>${p.id===localId?'Você':esc(p.name)}</span><b>${hpAmount(p.hp)}</b>${damage?`<em class="hit-value">${hpAmount('−'+damage)}</em>`:''}${resourceBadge(p)}</div>`;
  }).join('')}</div>`;
}
function combatReadout(){
  const event=playback?game.lastRoll.events[playback.eventIndex]:null;
  const attacks=playback?(event?.attacks??[]):(game.lastRoll?.events.flatMap(e=>e.attacks??[])??[]);
  const resources=activeResources();
  if(resources.length)return `<div class="resource-readout" role="status">${[...resources].sort((a,b)=>(a.playerId!==localId)-(b.playerId!==localId)).map(e=>`<span><b>${e.playerId===localId?'Você':esc(game.players[e.playerId].name)}</b>${resourceBadge(game.players[e.playerId],true)}</span>`).join('')}</div>`;
  if(!attacks.length){
    const text=playback?(event?.lines.join(' ')??'Rolando os dados…'):game.lastRoll?'Rolagem concluída.':'';
    return text?`<p class="arena-feedback" role="status">${resourceText(text)}</p>`:'';
  }
  const pairs=new Map();
  for(const a of attacks){const key=`${a.attackerId}-${a.targetId}`,pair=pairs.get(key)??{...a,damage:0,hits:0};pair.damage+=a.damage;pair.hits++;pairs.set(key,pair);}
  const priority=a=>a.targetId===localId?0:a.attackerId===localId?1:2;
  return `<div class="combat-readout" role="status" aria-label="${playback?'Ataques em resolução':'Ataques da última rolagem'}">${[...pairs.values()].sort((a,b)=>priority(a)-priority(b)).map(a=>`<div class="attack-receipt ${a.targetId===localId?'incoming':a.attackerId===localId?'outgoing':'other-attack'}"><span style="--pilot:${game.players[a.attackerId].color}">${a.attackerId===localId?'Você':esc(game.players[a.attackerId].name)}</span><span class="attack-direction" aria-label="atacou">→</span><span style="--pilot:${game.players[a.targetId].color}">${a.targetId===localId?'Você':esc(game.players[a.targetId].name)}</span><b>−${a.damage} HP${a.hits>1?`<small>${a.hits} disparos</small>`:''}</b></div>`).join('')}</div>`;
}

function die(n,rolling=false){const patterns={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};return `<span class="die ${rolling?'rolling':''}" aria-label="${n?`Dado ${n}`:'Dado ainda não rolado'}">${Array.from({length:9},(_,i)=>`<i class="${patterns[n]?.includes(i+1)?'pip':''}"></i>`).join('')}</span>`;}
function journal(){return button('Histórico','journal','class="btn subtle journal-button" '+(!game.lastRoll?'disabled':''));}
function speedLabel(){return `${String(playbackClock.speed).replace('.',',')}×`;}
function speedControl(){return `<div class="speed-control"><label for="playback-speed">Velocidade</label><span class="speed-min" aria-hidden="true">0,5×</span><input id="playback-speed" type="range" min="${MIN_SPEED}" max="${MAX_SPEED}" step="0.5" value="${playbackClock.speed}" aria-valuetext="${speedLabel()}" style="--speed-fill:${(playbackClock.speed-MIN_SPEED)/(MAX_SPEED-MIN_SPEED)*100}%"><span class="speed-max" aria-hidden="true">4×</span><output for="playback-speed" id="speed-value">${speedLabel()}</output></div>`;}
function showJournal(){
  autoRoller.stop();
  const events=game.lastRoll?.events??[],shown=playback?events.slice(0,playback.eventIndex+1):events;
  modal('Detalhes da rolagem',`<div class="journal-entries">${(game.lastRoll?.chargeGains??[]).map(g=>`<p>${esc(game.players[g.playerId].name)}: ${chargeAmount('+'+g.amount)} pelos dados.</p>`).join('')}${(game.lastRoll?.criticalIds??[]).map(id=>`<p><b>CRÍTICO</b> · ${esc(game.players[id].name)}</p>`).join('')}${shown.map(event=>`<div class="event"><span class="event-marker" style="--card-color:${event.type?CARDS[event.type].color:'#8d9b9d'}">${event.type?cardIcon(event.type):'—'}</span><div><b>${event.face?`Face ${event.face} · ${CARDS[event.type].name}`:'Módulos vazios'}${event.simultaneous?'<small>SIMULTÂNEO</small>':''}</b>${event.lines.map(line=>`<p>${resourceText(line)}</p>`).join('')}</div></div>`).join('')||'<p>Rolando os dados…</p>'}</div>`,`${!playback?button('Rever animação','replay'):''}${button('Fechar','close','class="btn primary"')}`);
}

function arenaPlayer(p){return `<article class="arena-player ${!p.alive?'eliminated':''} ${combatClasses(p)}" style="--pilot:${p.color}"><div class="arena-player-top"><h2>Seu robô</h2><div class="your-die"><span>${p.diceResults?.length===2?'Dados':'Dado'}</span><span class="player-dice">${playerDice(p)}</span></div></div>${slots(p,{compact:true})}<div class="position-status"><span>${p.alive?'Avanço':'Eliminado'}</span><strong>${p.pos}<small> / 4</small></strong></div><div class="position-track" aria-hidden="true">${Array.from({length:4},(_,i)=>`<i class="${p.pos>i?'reached':''}"></i>`).join('')}</div></article>`;}
function resultBanner(){
  const r=game.result,win=r.winner!==null?game.players[r.winner]:null,done=game.phase==='gameover';
  const title=done?(win.id===localId?'Você venceu a partida!':`${esc(win.name)} venceu a partida`):win?(win.id===localId?'Você ganhou a arena!':`${esc(win.name)} ganhou a arena`):'Arena empatada';
  return `<section class="result-banner ${done?'champion':''}" style="--pilot:${win?.color??'#e8bf73'}"><div><h2>${title}</h2><p>${win?'+1 ponto.':esc(r.title)+'.'} <span class="round-reward">${scrapAmount('+3')}</span></p></div>${isHost()?button(done?'Jogar novamente →':'Próxima arena →',done?'rematch':'next','class="btn primary"'):`<p>Aguardando ${esc(room.members[room.hostId].name)} continuar.</p>`}</section>`;
}
function opponent(p){
  return `<details class="opponent ${p.alive?'':'eliminated'} ${combatClasses(p)}" style="--pilot:${p.color}" data-details="opponent" data-player="${p.id}" ${openOpponents.has(p.id)?'open':''}><summary><span class="opponent-name"><b>${esc(p.name)}</b><small>${p.alive?`${p.hp}/${p.maxHp} HP · ${p.pos}/4 casas`:'Eliminado'}</small>${chargeMeter(p)}</span><span class="player-dice">${playerDice(p)}</span><strong aria-label="${p.points} de 5 pontos">${p.points}<small>/5</small></strong></summary><div class="opponent-equipment">${slots(p,{compact:true})}<p>${scrapAmount(p.scrap)} · ${p.bot?'Bot':'Jogador'}</p></div></details>`;
}
function renderArena(){
  const players=visiblePlayers(),p=players[localId];
  const ended=Boolean(game.result&&!playback),event=playback?game.lastRoll.events[playback.eventIndex]:null;
  const importantEvent=event?.attacks?.some(a=>a.targetId===localId)?'Você recebeu dano':event?.attacks?.some(a=>a.attackerId===localId)?'Seu ataque':event?.type?CARDS[event.type].name:event?'Sem ativações':'Rolando dados';
  const status=playback?`${importantEvent}${event?.face?` · Face ${event.face}`:''}`:ended?'Resultado da arena':game.lastRoll?`Última rolagem · ${game.lastRoll.number}`:'Arena pronta';
  return `<main class="arena-layout solo-arena" data-mobile-pane="${mobileArenaPane}">${mobilePanels('arena',[['battle','Arena'],['robots','Robôs']],mobileArenaPane)}<div class="arena-main"><div class="arena-toolbar"><div class="arena-title"><div class="phase-heading"><h1>Arena ${game.round} ${help('Chegue ao centro ou seja o último robô vivo para ganhar 1 ponto. Vence quem alcançar 5 pontos.','vitória')}</h1></div><div class="arena-controls">${!isHost()?`<span class="host-roll-note">${esc(room.members[room.hostId].name)} conduz as rolagens</span>`:''}${button(playback?'Resolvendo…':'Rolar dados ⚄','roll','class="btn primary roll-button" '+(playback||autoRoller.running||ended||!isHost()?'disabled':''))}${button(autoRoller.running?'Pausar':'Rolar até o fim','auto-roll','class="btn auto-roll-button" aria-pressed="'+autoRoller.running+'" '+((playback&&!autoRoller.running)||ended||!isHost()?'disabled':''))}</div></div></div>
    <div class="board-stage ${ended?'arena-ended':''}">${board(players)}${rollHighlight()}${ended?`<div class="arena-result-overlay">${resultBanner()}</div>`:''}</div>
    <section class="arena-feed" aria-label="Eventos da arena"><div class="feed-heading"><span>${status}</span>${journal()}</div><div class="feed-body">${combatReadout()||'<p class="arena-feedback">Aguardando rolagem.</p>'}</div></section>
    </div><aside class="arena-cockpit">${dicePresentation()}${arenaPlayer(p)}<section class="opponents-panel"><div class="opponents-heading"><h2>Adversários</h2><span>Pontos / 5</span>${help('Abra um adversário para consultar seus equipamentos e sucata. Robôs eliminados voltam na próxima arena.','adversários')}</div><div class="opponents">${players.filter(p=>p.id!==localId).map(opponent).join('')}</div></section>${speedControl()}</aside></main>`;
}

function render(){
  if(speedDragging||pieceDragging){renderPending=true;return;}
  if(playback?.diceStage==='rolling'){
    const animation=app.querySelector('.dice-cube')?.getAnimations()[0];
    if(animation)playback.diceTime=Number(animation.currentTime)||0;
  }
  hideArenaPreview();
  const speedFocused=document.activeElement?.id==='playback-speed';
  const scrollPositions=['.assembly-body','.market-shop','.hangar-body','.opponents-panel','.inventory-cards','.feed-body'].map(selector=>{const el=app.querySelector(selector);return {selector,top:el?.scrollTop??0,left:el?.scrollLeft??0};});
  const focused=document.activeElement?.closest?.('[data-action]');
  const focusKey=focused?{action:focused.dataset.action,id:focused.dataset.id,slot:focused.dataset.slot,count:focused.dataset.count}:null;
  helpIndex=0;
  app.innerHTML=`<div class="app-shell ${home&&mode==='landing'?'is-mode-menu':''} ${home||lobby?'':`is-playing scene-${phaseScene().scene}`} multiplayer-shell" style="--tempo:${1/playbackClock.speed}">${home&&mode==='landing'?'':header()}${roomBar()}${connectionMessage?`<div class="warning" role="status">${esc(connectionMessage)}</div>`:''}${saveError?`<div class="warning" role="alert">${esc(saveError)}</div>`:''}${message?`<div class="message" role="status">${resourceText(message)}</div>`:''}${home?renderHome():lobby?renderLobby():`${phasebar()}${game.notice&&!isWaiting(game)?`<div class="notice">${resourceText(game.notice)}</div>`:''}${marketPlayback?renderMarketPlayback():game.phase==='market'?renderMarket():isWaiting(game)?renderWaiting():game.phase==='draft'?renderDraft():game.phase==='assembly'?renderAssembly():renderArena()}`}</div>`;
  if(sending||(!connected()&&!home))for(const el of app.querySelectorAll('button[data-action],button[type="submit"]'))if(!['close','home','rules','menu','standings','invite','copy-invite','resume'].includes(el.dataset.action))el.disabled=true;
  animateDiceElements();
  for(const pos of scrollPositions){const el=app.querySelector(pos.selector);if(el){el.scrollTop=pos.top;el.scrollLeft=pos.left;}}
  if(focusKey){const next=[...app.querySelectorAll('[data-action]')].find(el=>!el.disabled&&el.dataset.action===focusKey.action&&el.dataset.id===focusKey.id&&el.dataset.slot===focusKey.slot&&el.dataset.count===focusKey.count);next?.focus({preventScroll:true});}
  if(speedFocused)document.querySelector('#playback-speed')?.focus({preventScroll:true});
}
async function dispatch(action){
  if(home||lobby||playback||marketPlayback||sending||!connected()||(isWaiting(game)&&!(canImprove()&&['UNLOCK','UPGRADE'].includes(action.type))))return;
  if(['ROLL','NEXT_ARENA','REMATCH'].includes(action.type)&&!isHost())return;
  if(localMode()){
    try{
      const previous=game;game=soloAction(game,action);persistSolo();message='';
      if(selected&&!allCards(humanPlayer(game)).some(c=>c.id===selected))selected=null;
      if(previous.phase!==game.phase){selected=null;mobileMarketPane='shop';}
      if(action.type==='ROLL'){mobileArenaPane='battle';animateRoll();}
      else {const steps=unseenMarketSteps(previous,game);if(steps.length)startMarketPlayback(steps);else render();}
    }catch(error){autoRoller.stop();message=error.message;render();}
    return;
  }
  await networkAction(()=>client.command(action));
}

function persistSolo(){
  soloSaved=game;
  try{saveSolo(localStorage,game);saveError='';}
  catch{saveError='Não foi possível salvar neste navegador. Mantenha esta página aberta para continuar a partida.';}
}
function enterSolo(state){
  client.pause();mode=isLaboratory(state)?'laboratory':'solo';room=null;localId=0;game=state;home=false;lobby=false;
  selected=null;message='';connectionMessage='';soloLoadError='';persistSolo();render();
}

function animateRoll(){
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  playback={snapshot:game.lastRoll.before,eventIndex:-1,activeIds:[],diceStage:motion?'reveal':'rolling',diceTime:0};render();
  let index=0;
  function step(){
    const event=game.lastRoll.events[index++];
    if(!event){playback=null;timer=null;if(game.result)mobileArenaPane='battle';if(queuedView){const next=queuedView;queuedView=null;receiveRoom(next);if(playback)return;}autoRoller.afterPlayback();render();announce(game.result?game.result.title:'Rolagem concluída.');return;}
    playback={snapshot:event.snapshot,eventIndex:index-1,activeIds:event.activeIds};render();announce(event.lines.join(' '));
    timer=playbackClock.schedule(step,motion?100:(event.attacks?.length?(event.attacks.some(a=>a.execution>1)?3000:1900):['J','Q'].includes(event.type)?1550:900));
  }
  if(motion){announce(game.lastRoll.criticalIds?.length?'CRÍTICO':'Dados definidos.');timer=playbackClock.schedule(step,game.lastRoll.criticalIds?.length?1200:250);return;}
  timer=playbackClock.schedule(()=>{
    playback={...playback,diceStage:'reveal'};render();
    announce(game.lastRoll.criticalIds?.length?'CRÍTICO. '+game.lastRoll.criticalIds.map(id=>game.players[id].name).join(', '):'Dados definidos. Módulos sorteados.');
    timer=playbackClock.schedule(step,game.lastRoll.criticalIds?.length?1400:DICE_REVEAL_MS);
  },DICE_ROLL_MS);
}
function modal(title,body,actions){dialogView='';dialog.innerHTML=`<div class="dialog-header"><h2>${title}</h2><button class="close-btn" data-action="close" aria-label="Fechar">×</button></div>${body}<div class="dialog-actions">${actions}</div>`;dialog.showModal();}
async function improve(action){
  if(sending||!canImprove())return;
  const pending=dispatch(action);dialog.close();showImprovements();
  await pending;
  if(dialog.open&&dialogView==='improvements'){dialog.close();showImprovements();}
}
function showImprovements(){
  if(!['market','assembly'].includes(game.phase))return;
  const p=humanPlayer(game),waiting=!!playback||sending||!connected()||!canImprove(),cards=allCards(p);
  modal('Melhorias',`<p class="improvements-balance">Disponível: ${scrapAmount(p.scrap)}</p>${waiting?'<p class="market-log-note">Aguarde a conexão ou a ação em andamento. Montagens confirmadas ficam bloqueadas.</p>':''}${message?`<p role="alert">${esc(message)}</p>`:''}<section class="improvement-section"><h3>Módulos</h3><p class="market-log-note">Liberação na ordem 4 → 5 → 6. A montagem continua na Oficina.</p>${p.unlocked<6?button(`Construir módulo ${p.unlocked+1} · ${scrapAmount(p.unlocked+1)}`,'improve-slot',`${waiting||p.scrap<p.unlocked+1?'disabled':''}`):'<p>Todos os módulos liberados.</p>'}</section><section class="improvement-section"><h3>Equipamentos</h3><div class="improvement-cards">${cards.map(c=>`<div class="improvement-card"><span class="improvement-piece" style="--card-color:${CARDS[c.type].color}">${cardIcon(c.type)}<span><b>${CARDS[c.type].name}</b><small>${resourceText(cardDescription({...c,upgraded:true}))}</small></span></span>${c.upgraded?'<span class="market-no-action">✦ Melhorado</span>':button(`Melhorar · ${scrapAmount(UPGRADE_COST)}`,'improve-card',`data-id="${c.id}" ${waiting||p.scrap<UPGRADE_COST?'disabled':''}`)}</div>`).join('')||'<p class="market-log-note">Você ainda não tem equipamentos.</p>'}</div></section>`,button('Voltar ao jogo','close','class="btn primary"'));
  dialogView='improvements';
}
function showGameMenu(){if(localMode()){modal('Partida local',`<p>Arena ${game.round} · ${esc(game.players[0].name)}</p><p>${saveError?'O salvamento está indisponível. Mantenha esta página aberta.':'Progresso salvo neste navegador.'}</p><div class="game-menu">${button('Como jogar','rules')}${button('Voltar ao início','home')}</div>`,button('Voltar ao jogo','close','class="btn primary"'));return;}modal('Partida',`<p class="menu-status">Sala ${esc(room.code)} · Arena ${game.round}<br>${esc(room.members[room.hostId].name)} conduz as rolagens.</p><p>A partida fica salva na sala. Volte pelo mesmo navegador para retomar seu robô.</p><div class="game-menu">${button('Convidar','invite')}${button('Como jogar','rules')}${['market','assembly'].includes(game.phase)?button('Melhorias','improvements'):''}${button(`Decisões na loja: ${showMarketActivity?'visíveis':'ocultas'}`,'toggle-market-activity',`aria-pressed="${showMarketActivity}"`)}${marketEvents().length?button('Decisões dos adversários','market-log'):''}${button('Voltar ao início','home')}</div>`,button('Voltar ao jogo','close','class="btn primary"'));}
function showInvite(){modal('Convide seus amigos',`<p>Código da sala: <b>${esc(room.code)}</b></p><label class="field-label" for="invite-link">Link da sala</label><input id="invite-link" class="room-link" readonly value="${esc(inviteUrl())}">`,button('Copiar link','copy-invite','class="btn primary"'));}
async function copyInvite(){try{await navigator.clipboard.writeText(inviteUrl());message='Link copiado.';}catch{document.querySelector('#invite-link')?.select();message='Selecione e copie o link da sala.';}announce(message);if(!dialog.open)render();}

function laboratoryRules(){return mode!=='laboratory'?'':`<h3>Laboratório · Carga e Crítico</h3><p>Você e os bots começam com zero carga. Cada dado 4 ou 5 gera 1 carga; o 6 gera 2, mesmo em módulo vazio ou bloqueado. O limite é 6 e o excedente é descartado. A carga permanece entre arenas e lojas.</p><p>Começar a rolagem com 6 cargas consome todas para jogar dois dados. Os novos resultados já geram carga para a próxima rolagem. Dois números iguais ativam três execuções do equipamento (duas dos dados e uma adicional); a carga natural dos dados e os bônus de vida máxima não são multiplicados.</p><p>Cada execução de Canhão escolhe seu alvo; os dois tiros do upgrade mantêm esse alvo enquanto possível. Um crítico melhorado permite três execuções de dois tiros, até seis tiros. O grupo é simultâneo e completa antes de verificar eliminações e vitória.</p><p>Cada ponto de cura que excede o dano vira 1 carga. A restauração de vida entre arenas não gera carga. Duplas em casas vazias ou bloqueadas não ativam efeitos.</p>`;}
function showRules(){modal('Como jogar',`<div class="rules-body">${laboratoryRules()}<p>Monte seu robô, dispute arenas e seja o primeiro a alcançar <b>5 pontos</b>. Você controla apenas o seu robô. No single player, os bots jogam automaticamente e você conduz as rolagens e a passagem entre arenas. No multiplayer, cada pessoa joga no próprio dispositivo e o criador da sala conduz o combate.</p><h3>Preparação</h3><p>Todos começam com ${scrapAmount(0)}. ${mode==='laboratory'?'O baralho tem nove cartas de cada tipo. Receba um Canhão e um Propulsor e escolha mais um equipamento entre três opções.':'Escolha três equipamentos, um por vez.'} Equipe-os nos módulos 1, 2 e 3. Três cartas comuns iguais viram uma melhorada, que ativa duas vezes.</p><h3>Compra e montagem</h3><p>Cartas custam ${scrapAmount(3)} e podem ser vendidas por ${scrapAmount(1)}. Desbloqueie os módulos 4, 5 e 6 nessa ordem, pagando o número do módulo. Guarde até uma carta na reserva. Na Compra ou na Montagem, selecione uma carta comum para melhorá-la por ${scrapAmount(12)}, sem precisar de uma tripla.</p><p>Na compra, cada jogador tem duas escolhas. Clicar numa carta já compra e conclui essa escolha. O vencedor anterior faz as suas duas no meio da sequência de ida e volta. Vender, melhorar e desbloquear não gastam uma escolha. Depois de empate, a referência anterior permanece.</p><h3>Na arena</h3><p>Uma rolagem conjunta ativa os equipamentos dos módulos sorteados. A ordem é <b>face 1 → 6</b>, e, na mesma face, <b>A → K → Q → J</b>. Mesma face e mesma carta resolvem simultaneamente.</p><div class="rules-cards">${Object.entries(CARDS).map(([rank,c])=>`<p><b style="color:${c.color}">${rank} · ${c.name}</b><br>${resourceText(c.description)}<br><small>Melhorado: ${resourceText(cardDescription({type:rank,upgraded:true}))}</small></p>`).join('')}</div><p>O Canhão melhorado completa os dois disparos seguidos, mesmo recebendo dano simultâneo. Empates de alvo são sorteados.</p><h3>Vitória e empate</h3><p>Ganhe 1 ponto chegando ao centro em quatro avanços ou sendo o último sobrevivente. Chegada simultânea e destruição mútua não dão pontos. Se nenhum sobrevivente possui Canhão ou Propulsor, a arena termina sem pontos.</p><p>Todos recebem ${scrapAmount(3)} ao final. Na próxima arena, posições e HP são restaurados; equipamentos, módulos, sucata e pontos permanecem.</p></div>`,button('Entendi','close','class="btn primary"'));}
function handleClick(event){
  const historyTrigger=event.target.closest('[data-action="history-tip"]');
  document.querySelectorAll('.history-tip.history-open').forEach(tip=>{if(tip!==historyTrigger?.closest('.history-tip')){tip.classList.remove('history-open');tip.querySelector('button').setAttribute('aria-expanded','false');}});
  const el=event.target.closest('[data-action]');if(!el||el.disabled)return;
  const a=el.dataset.action,id=el.dataset.id;event.preventDefault();
  if(a==='arena-inspect'){const same=arenaPreview?.dataset.player===id&&arenaPreview.dataset.pinned==='true';hideArenaPreview();if(!same)showArenaPreview(el,true);return;}
  hideArenaPreview();
  if(a==='skip-market'&&marketPlayback){finishMarketPlayback();return;}
  if(a==='coming-soon'){el.focus();return;}
  if(a==='close'){dialog.close();return;}
  if(a==='profile'){void showProfile();return;}
  if(a==='profile-refresh'){void updateProfile();return;}
  if(a==='change-profile'&&home&&!sending){names[0]=profiles.profile?.name??'';profiles.clear();profileError='';render();return;}
  if(a==='improvements'){autoRoller.stop();dialog.close();showImprovements();return;}
  if(a==='improve-card'||a==='improve-slot'){void improve(a==='improve-card'?{type:'UPGRADE',id}:{type:'UNLOCK'});return;}
  if(a==='market-log'){dialog.close();showMarketLog();return;}
  if(a==='toggle-market-activity'){showMarketActivity=!showMarketActivity;try{localStorage.setItem('mecha-arena.market-activity',showMarketActivity?'shown':'hidden');}catch{}dialog.close();render();showGameMenu();return;}
  if(a==='history-tip'){const tip=el.closest('.history-tip');el.setAttribute('aria-expanded',String(tip.classList.toggle('history-open')));positionHelp(event);return;}
  if(a==='menu'||a==='standings'){autoRoller.stop();render();if(a==='menu')showGameMenu();else modal('Placar · primeiro a 5 pontos',standings(),button('Voltar ao jogo','close','class="btn primary"'));return;}
  if(a==='rules'){dialog.close();autoRoller.stop();render();showRules();return;}
  if(a==='journal'){showJournal();render();return;}
  if(a==='mobile-market'){if(['shop','robot'].includes(id))mobileMarketPane=id;render();return;}
  if(a==='mobile-arena'){if(['battle','robots'].includes(id)){mobileArenaPane=id;autoRoller.stop();}render();return;}
  if(a==='auto-roll'){
    if(autoRoller.running){autoRoller.stop();render();announce('Rolagens automáticas pausadas.');}
    else if(!home&&!playback&&game?.phase==='arena'&&isHost()&&!sending&&connected())autoRoller.start();
    return;
  }
  if(a==='invite'){showInvite();return;}
  if(a==='copy-invite'){void copyInvite();return;}
  if(a==='choose-solo'||a==='choose-laboratory'){mode=a==='choose-laboratory'?'laboratory':'solo';connectionMessage='';saveError='';soloSaved=null;try{soloSaved=readSolo(localStorage,mode==='laboratory');soloLoadError='';}catch{soloLoadError='Não foi possível recuperar a partida salva. Você pode iniciar uma nova partida.';}if(!names[0]&&soloSaved)names[0]=soloSaved.players[0].name;render();return;}
  if(a==='choose-multiplayer'){mode='multiplayer';connectionMessage='';saveError='';render();if(profiles.profile)void updateProfile();return;}
  if(a==='resume-solo'&&soloSaved){enterSolo(soloSaved);return;}
  if(a==='home'){clearTimeout(marketTimer);marketPlayback=null;queuedView=null;dialog.close();autoRoller.stop();playbackClock.cancel();playback=null;queuedView=null;client.pause();mode='landing';home=true;lobby=false;selected=null;message='';connectionMessage='';saveError='';joinCode='';history.replaceState(null,'',location.pathname);render();return;}
  if(a==='resume'){void networkAction(()=>client.resume());return;}
  if(a==='start-room'){void networkAction(()=>client.command({type:'START'}));return;}
  if(a==='add-bot'&&lobby&&isHost()){void networkAction(()=>client.command({type:'ADD_BOT'}));return;}
  if(a==='remove-bot'&&lobby&&isHost()){void networkAction(()=>client.command({type:'REMOVE_BOT',id}));return;}
  if(a==='leave-room'){void networkAction(async()=>{await client.command({type:'LEAVE'});room=null;game=null;lobby=false;home=true;});return;}
  if(playback||marketPlayback||lobby)return;

  if(a==='unlock'&&canImprove()){void dispatch({type:'UNLOCK',slot:Number(el.dataset.slot)});return;}
  if(home||sending||isWaiting(game))return;
  if(a==='replay'&&game.lastRoll){dialog.close();autoRoller.stop();animateRoll();return;}
  if(a==='select'){selected=selected===id?null:id;render();return;}
  if(a==='equip'){if(selected)dispatch({type:'EQUIP',id:selected,slot:Number(el.dataset.slot),reorder:true});return;}
  if(a==='unlock'){dispatch({type:'UNLOCK',slot:Number(el.dataset.slot)});return;}
  const actions={draft:'DRAFT_PICK',buy:'BUY',sell:'SELL',unequip:'UNEQUIP',upgrade:'UPGRADE','end-turn':'END_TURN',confirm:'CONFIRM_ASSEMBLY',roll:'ROLL',next:'NEXT_ARENA',rematch:'REMATCH'};
  if(actions[a])dispatch({type:actions[a],id});
}
document.addEventListener('click',handleClick);
document.addEventListener('submit',e=>{
  if(e.target.id==='solo-form'){e.preventDefault();try{enterSolo(startSolo(names[0],botCount,Date.now(),mode==='laboratory'));}catch(error){message=error.message;render();}return;}
  if(e.target.id==='profile-form'){e.preventDefault();const name=names[0].trim();if(!name)return;void networkAction(async()=>{await profiles.select(name);profileError='';});return;}
  if(e.target.id==='setup-form'){e.preventDefault();const name=profiles.profile?.name;if(!name)return;const joining=e.submitter?.value==='join';if(joining&&!/^[A-HJ-NP-Z2-9]{6}$/.test(joinCode)){message='Informe o código de 6 caracteres da sala.';render();return;}void networkAction(()=>joining?client.join(joinCode,name):client.create(name));}
});
document.addEventListener('change',e=>{if(e.target.id==='bot-count')botCount=Number(e.target.value);});
document.addEventListener('input',e=>{if(e.target.id==='room-code'){joinCode=e.target.value.toUpperCase().replace(/\s/g,'');e.target.value=joinCode;}});
document.addEventListener('input',e=>{if(e.target.matches('[data-name-index]'))names[Number(e.target.dataset.nameIndex)]=e.target.value;});
document.addEventListener('input',e=>{
  if(e.target.id!=='playback-speed')return;
  playbackClock.setSpeed(e.target.value);
  for(const el of app.querySelectorAll('.dice-cube,.dice-toss'))for(const animation of el.getAnimations())animation.updatePlaybackRate(playbackClock.speed);
  e.target.setAttribute('aria-valuetext',speedLabel());
  e.target.style.setProperty('--speed-fill',`${(playbackClock.speed-MIN_SPEED)/(MAX_SPEED-MIN_SPEED)*100}%`);
  document.querySelector('#speed-value').textContent=speedLabel();
  app.querySelector('.app-shell').style.setProperty('--tempo',1/playbackClock.speed);
  try{localStorage.setItem(SPEED_KEY,String(playbackClock.speed));}catch{}
});
document.addEventListener('pointerdown',e=>{if(e.target.id==='playback-speed')speedDragging=true;});
function finishSpeedDrag(){speedDragging=false;if(renderPending){renderPending=false;render();}}
document.addEventListener('pointerup',finishSpeedDrag);
document.addEventListener('pointercancel',finishSpeedDrag);
window.addEventListener('blur',finishSpeedDrag);
function positionHelp(event){
  const wrapper=event.target.closest?.('.help-tip');if(!wrapper)return;
  const trigger=wrapper.querySelector('.help-trigger'),tip=wrapper.querySelector('.help-content');
  const rect=trigger.getBoundingClientRect(),width=tip.offsetWidth,height=tip.offsetHeight;
  tip.style.left=`${Math.max(12,Math.min(rect.left,window.innerWidth-width-12))}px`;
  tip.style.top=`${rect.bottom+height+20<window.innerHeight?rect.bottom+9:Math.max(12,rect.top-height-9)}px`;
}
document.addEventListener('pointerover',positionHelp);
document.addEventListener('focusin',positionHelp);
let draggedCardId=null;
function clearCardDrag(){draggedCardId=null;app.querySelectorAll('.drag-source,.drop-ready,.drop-target').forEach(el=>el.classList.remove('drag-source','drop-ready','drop-target'));}
document.addEventListener('dragstart',e=>{
  const el=e.target.closest('[draggable="true"][data-id]');
  if(!el||home||marketPlayback||game?.phase!=='assembly'||sending||isWaiting(game)||!allCards(humanPlayer(game)).some(c=>c.id===el.dataset.id)){e.preventDefault();return;}
  pieceDragging=true;draggedCardId=el.dataset.id;e.dataTransfer.setData('text/plain',draggedCardId);e.dataTransfer.effectAllowed='move';
  el.classList.add('drag-source');app.querySelectorAll('.assembly-body .module:not(.locked)').forEach(slot=>slot.classList.add('drop-ready'));
});
document.addEventListener('dragover',e=>{
  const slot=e.target.closest('.assembly-body .module:not(.locked)');
  if(draggedCardId&&slot&&!home&&game?.phase==='assembly'&&!isWaiting(game)){
    e.preventDefault();e.dataTransfer.dropEffect='move';app.querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'));slot.classList.add('drop-target');
  }
});
document.addEventListener('drop',e=>{
  const slot=e.target.closest('.assembly-body .module:not(.locked)'),id=draggedCardId;
  if(id&&slot&&!home&&game?.phase==='assembly'&&!isWaiting(game)){e.preventDefault();clearCardDrag();finishPieceDrag();dispatch({type:'EQUIP',id,slot:Number(slot.dataset.slot),reorder:true});}
  else {clearCardDrag();finishPieceDrag();}
});
function finishPieceDrag(){
  pieceDragging=false;
  if(queuedView&&!playback){const next=queuedView;queuedView=null;renderPending=false;receiveRoom(next);}
  else if(renderPending){renderPending=false;render();}
}
document.addEventListener('dragend',()=>{clearCardDrag();finishPieceDrag();});
window.addEventListener('blur',()=>{clearCardDrag();finishPieceDrag();});

document.addEventListener('toggle',e=>{if(!e.target.isConnected)return;if(e.target.dataset.details==='opponent'){const id=Number(e.target.dataset.player);if(e.target.open)openOpponents.add(id);else openOpponents.delete(id);}},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){hideArenaPreview();document.querySelectorAll('.history-tip.history-open').forEach(tip=>{tip.classList.remove('history-open');tip.querySelector('button').setAttribute('aria-expanded','false');});document.activeElement?.closest?.('.help-tip')?.querySelector('.help-trigger')?.blur();if(selected){selected=null;render();}}});
let arenaPreview=null;
function hideArenaPreview(){
  document.querySelectorAll('.arena-inspect[aria-expanded="true"]').forEach(el=>{el.setAttribute('aria-expanded','false');el.removeAttribute('aria-describedby');});
  arenaPreview?.remove();arenaPreview=null;
}
function showArenaPreview(trigger,pinned=false){
  if(home||!['arena','result','gameover'].includes(game?.phase)||dialog.open)return;
  const player=visiblePlayers().find(p=>p.id===Number(trigger.dataset.id));if(!player||player.id===localId)return;
  hideArenaPreview();
  arenaPreview=document.createElement('div');arenaPreview.id='arena-equipment-preview';arenaPreview.className='history-preview arena-equipment-preview';arenaPreview.setAttribute('role','tooltip');arenaPreview.dataset.player=String(player.id);arenaPreview.dataset.pinned=String(pinned);
  arenaPreview.innerHTML=opponentPreview(player,{arena:true,contentOnly:true});document.body.append(arenaPreview);
  trigger.setAttribute('aria-describedby',arenaPreview.id);trigger.setAttribute('aria-expanded','true');
  const rect=trigger.getBoundingClientRect(),width=arenaPreview.offsetWidth,height=arenaPreview.offsetHeight;
  arenaPreview.style.left=Math.max(12,Math.min(rect.left+rect.width/2-width/2,window.innerWidth-width-12))+'px';
  arenaPreview.style.top=(rect.top-height>16?rect.top-height-8:Math.min(window.innerHeight-height-12,rect.bottom+8))+'px';
}
document.addEventListener('pointerover',event=>{const el=event.target.closest('.arena-inspect');if(el&&event.pointerType!=='touch'&&arenaPreview?.dataset.pinned!=='true')showArenaPreview(el);});
document.addEventListener('pointerout',event=>{if(event.target.closest('.arena-inspect')&&!event.relatedTarget?.closest?.('.arena-inspect')&&arenaPreview?.dataset.pinned!=='true')hideArenaPreview();});
document.addEventListener('focusin',event=>{const el=event.target.closest('.arena-inspect');if(el)showArenaPreview(el);});
document.addEventListener('focusout',event=>{if(event.target.closest('.arena-inspect')&&arenaPreview?.dataset.pinned!=='true')hideArenaPreview();});
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.arena-inspect'))hideArenaPreview();});
window.addEventListener('resize',hideArenaPreview);
document.addEventListener('scroll',hideArenaPreview,true);
names[0]=profiles.profile?.name??client.session?.name??'';
load();render();
if(joinCode&&client.session&&(!profiles.profile||sameName(profiles.profile.name,client.session.name))&&joinCode===client.session.code)void networkAction(()=>client.resume());
else if(mode==='multiplayer'&&profiles.profile)void updateProfile();
