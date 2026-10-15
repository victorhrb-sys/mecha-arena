// Record completed public shop actions, never hidden assembly or draft choices.
export function recordMarketAction(before, after, action) {
  if (before.phase !== 'market') return after;
  const playerId = action.playerId ?? before.market.order[before.market.turn];
  const player = before.players[playerId], next = after.players[playerId];
  const passing = action.type === 'END_TURN' && !before.market.choiceDone;
  if (!['BUY', 'SELL', 'UPGRADE', 'UNLOCK'].includes(action.type) && !passing) return after;
  const card = (action.type === 'BUY' ? before.market.cards : [...player.modules.filter(Boolean), ...player.inventory]).find(c => c.id === action.id);
  const previous = before.marketActivity?.round === before.round ? before.marketActivity.events : [];
  const event = {playerId, type: passing ? 'PASS' : action.type, scrap: next.scrap - player.scrap};
  if (card) event.card = {type: card.type, upgraded: action.type === 'UPGRADE' || card.upgraded};
  if (action.type === 'UNLOCK') event.module = next.unlocked;
  return {...after, marketActivity: {round: before.round, events: [...previous, event].slice(-200)}};
}
