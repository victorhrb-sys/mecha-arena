import {serialize,deserialize,isLaboratory,enableLaboratory,migrateLaboratory} from './engine.js';
import {newSoloGame,actAsHuman,advanceBots} from './bots.js';

export const SOLO_SAVE_KEY='mecha-arena.solo.v1';
export const LAB_SAVE_KEY='mecha-arena.laboratory.v1';
export function readSolo(storage,laboratory=false){
  const text=storage.getItem(laboratory?LAB_SAVE_KEY:SOLO_SAVE_KEY);
  if(!text)return null;
  const state=deserialize(text);
  if(isLaboratory(state)!==laboratory)throw new Error('Partida de outro modo.');
  if(state.preparation||state.players[0].bot||!state.players.slice(1).every(p=>p.bot))throw new Error('Partida local inválida.');
  return laboratory?migrateLaboratory(state):state;
}
export function saveSolo(storage,state){storage.setItem(isLaboratory(state)?LAB_SAVE_KEY:SOLO_SAVE_KEY,serialize(state));}
export function startSolo(name,count,seed=Date.now(),laboratory=false){
  name=String(name).normalize('NFKC').trim().replace(/\s+/gu,' ');
  if(!name||name.length>24)throw new Error('Escolha um nome de até 24 caracteres.');
  const game=newSoloGame(name,count,seed);
  return advanceBots(laboratory?enableLaboratory(game):game);
}
export function soloAction(state,action){
  if(action.type==='REMATCH'){
    if(state.phase!=='gameover')throw new Error('A partida ainda está em andamento.');
    return startSolo(state.players[0].name,state.players.length-1,Date.now(),isLaboratory(state));
  }
  let next=actAsHuman(state,action);
  if(action.type==='BUY')next=actAsHuman(next,{type:'END_TURN'});
  return advanceBots(next);
}
