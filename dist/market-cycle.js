export function marketCycle(state){
  if(state.phase!=='market'||!state.market)return [];
  const count=state.players.length;
  return state.market.order.map((playerId,index)=>({
    playerId,index,pass:index<count?'outward':'return',
    column:index<count?index+1:2*count-index,
    status:index<state.market.turn?'done':index===state.market.turn?'current':'waiting'
  }));
}
