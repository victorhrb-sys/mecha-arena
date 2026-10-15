export const DICE_ROLL_MS=1100;
export const DICE_REVEAL_MS=650;
export const DICE_POSES={1:[0,0],2:[0,-90],3:[-90,0],4:[90,0],5:[0,90],6:[0,180]};
export const DICE_PIPS={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};

// Only results already committed by the engine are presented here.
export function diceForRoll(players,roll){
  return (roll?.before??[]).filter(p=>p.alive).flatMap(before=>{
    const player=players.find(p=>p.id===before.id);
    if(!player)return [];
    const faces=roll.diceResults?.[before.id]??[roll.dice[before.id]];
    return faces.filter(face=>DICE_POSES[face]).map(face=>({id:player.id,name:player.name,color:player.color,face,card:player.modules[face-1]??null}));
  });
}

export function persistentDice(players,roll){
  const rolled=diceForRoll(players,roll);
  return players.flatMap(p=>{const dice=rolled.filter(d=>d.id===p.id);return dice.length?dice:[{id:p.id,name:p.name,color:p.color,face:null,card:null,eliminated:!p.alive}];});
}
