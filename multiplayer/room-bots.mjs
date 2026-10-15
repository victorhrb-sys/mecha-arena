import {act,currentPlayer,prepareTogether,validateState} from '../dist/engine.js';
import {chooseAction,createPersona,rememberArena} from '../dist/bots.js';
import {recordMarketAction} from '../dist/market-activity.js';

export function initializeRoomBots(state,members) {
  for(const player of state.players)if(members[player.id].bot)player.bot=createPersona(state.rng,player.id);
  return state;
}

// A policy can see only its own robot, its current offer and publicly revealed
// information. The server never gives it another player's draft or hidden build.
export function roomBotDecisionView(state,id) {
  const player=state.players[id],seat=state.preparation?.seats[id];
  const phase=seat?(seat.picks<3?'draft':'assembly'):state.phase;
  return structuredClone({phase,player:{id:player.id,modules:player.modules,inventory:player.inventory,
    unlocked:player.unlocked,scrap:player.scrap,points:player.points,bot:player.bot},
    choices:phase==='draft'?seat.choices:state.market?.cards??[],choiceDone:state.market?.choiceDone??false,
    round:state.round,scoreboard:state.players.map(p=>({id:p.id,points:p.points,scrap:p.scrap,unlocked:p.unlocked})),
    lastArena:state.botMemory??null});
}

export function advanceRoomBots(input,members) {
  let state=prepareTogether(input),opportunity=null;
  for(let step=0;step<200;step++) {
    const id=state.preparation
      ?state.preparation.seats.findIndex((seat,id)=>members[id].bot&&!seat.ready)
      :state.phase==='market'&&members[currentPlayer(state).id].bot?currentPlayer(state).id:-1;
    if(id<0)return rememberArena(validateState(state));
    if(state.phase==='market'&&!opportunity)opportunity={
      turn:state.market.turn,playerId:id,order:[...state.market.order],
      cards:structuredClone(state.market.cards),actions:[],boughtId:null
    };
    const action=chooseAction(roomBotDecisionView(state,id));
    const before=state;
    state=recordMarketAction(state,act(state,action,id),action);
    if(opportunity&&['BUY','SELL','UPGRADE','UNLOCK','END_TURN'].includes(action.type)&&!(action.type==='END_TURN'&&before.market.choiceDone)){
      opportunity.actions.push(structuredClone(state.marketActivity.events.at(-1)));
      if(action.type==='BUY')opportunity.boughtId=action.id;
    }
    // Buying consumes the opportunity, just as it does for human room members.
    if(action.type==='BUY')state=act(state,{type:'END_TURN'},id);
    if(opportunity&&(state.phase!=='market'||state.market.turn!==opportunity.turn)){
      // Public presentation only. Decisions remain atomic and never depend on
      // a viewer's timer; retain this round so polling cannot miss a bot step.
      const previous=state.marketReplay?.round===state.round?state.marketReplay.steps:[];
      state.marketReplay={round:state.round,steps:[...previous,opportunity].slice(-8)};
      opportunity=null;
    }
    state=rememberArena(validateState(prepareTogether(state)));
  }
  throw new Error('Não foi possível concluir a vez dos bots. Tente novamente.');
}
