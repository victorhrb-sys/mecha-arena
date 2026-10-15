// Replay completed public bot choices once, including updates skipped by polling.
// A fresh connection shows the current game immediately.
export function unseenMarketSteps(previous,next){
  if(!previous||!next||previous.phase==='gameover'||next.round<previous.round)return [];
  if(next.marketReplay?.round!==next.round)return [];
  const seen=new Set(previous.round===next.round&&previous.marketReplay?.round===next.round?previous.marketReplay.steps.map(s=>s.turn):[]);
  return next.marketReplay.steps.filter(s=>!seen.has(s.turn));
}
