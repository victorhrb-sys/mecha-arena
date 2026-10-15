export const MIN_SPEED = .5;
export const MAX_SPEED = 4;
export function normalizeSpeed(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(MIN_SPEED, Math.min(MAX_SPEED, Math.round(number * 2) / 2)) : 1;
}

// Track remaining animation time at its original pace. A speed change rescales
// only what remains, without replaying the callback or changing the game state.
export function createPlaybackClock({speed = 1, now = () => performance.now(), schedule = setTimeout, cancel = clearTimeout} = {}) {
  let rate = normalizeSpeed(speed), task = null, timeout = null, serial = 0, ticket = 0;
  function arm() {
    const expected = task, currentTicket = ++ticket;
    timeout = schedule(() => {
      if (task !== expected || ticket !== currentTicket) return;
      task = null; timeout = null; expected.callback();
    }, expected.remaining / rate);
  }
  function clear(id) {
    if (id !== undefined && task?.id !== id) return;
    if (timeout !== null) cancel(timeout);
    timeout = null; task = null; ticket++;
  }
  return {
    get speed() {return rate;},
    setSpeed(value) {
      const updated = normalizeSpeed(value);
      if (updated === rate) return;
      const time = now();
      if (task) {
        task.remaining = Math.max(0, task.remaining - (time - task.started) * rate);
        task.started = time;
        if (timeout !== null) cancel(timeout);
      }
      rate = updated;
      if (task) arm();
    },
    schedule(callback, duration) {
      clear();
      task = {id: ++serial, callback, remaining: Math.max(0, duration), started: now()};
      const id = task.id; arm(); return id;
    },
    cancel: clear
  };
}

// Read the saved snapshots, so replay never grants resources or invents healing.
export function resourceEffects(roll, eventIndex) {
  const event = roll?.events[eventIndex];
  if (!event || !['J', 'Q'].includes(event.type)) return [];
  const before = eventIndex === 0 ? roll.before : roll.events[eventIndex - 1].snapshot;
  const field = event.type === 'J' ? 'scrap' : 'hp';
  return event.activeIds.flatMap(playerId => {
    const previous = before?.find(p => p.id === playerId), next = event.snapshot?.find(p => p.id === playerId);
    if (!previous || !next) return [];
    const charge=Math.max(0,(next.charge??0)-(previous.charge??0));
    return [{playerId, type: event.type, amount: Math.max(0, next[field] - previous[field]),...(charge?{charge}:{})}];
  });
}

// Only queue another roll after the current animation finishes. This preference
// is deliberately temporary: loading a save always returns control to the player.
export function createAutoRoller({getPhase, roll, schedule = setTimeout, cancel = clearTimeout}) {
  let running = false, pending = null;
  function stop() {
    running = false;
    if (pending !== null) cancel(pending);
    pending = null;
  }
  function next() {
    pending = null;
    if (!running || getPhase() !== 'arena') {stop(); return;}
    try {roll();} catch (error) {stop(); throw error;}
  }
  return {
    get running() {return running;},
    start() {
      if (running || getPhase() !== 'arena') return;
      running = true; next();
    },
    stop,
    afterPlayback() {
      if (!running) return;
      if (getPhase() !== 'arena') {stop(); return;}
      if (pending === null) pending = schedule(next, 650);
    }
  };
}
