import {profileKey} from './profiles.mjs';
// A compare-and-swap persists the game, roster and receipt. Final results share
// the same transaction and are keyed by match/profile to prevent double credit.
export class D1RoomStore {
  constructor(db) {this.db = db.withSession ? db.withSession('first-primary') : db;}
  async get(code) {
    const row = await this.db.prepare('SELECT data FROM rooms WHERE code = ?').bind(code).first();
    return row ? JSON.parse(row.data) : null;
  }
  async insert(room) {
    const result = await this.db.prepare('INSERT OR IGNORE INTO rooms (code, revision, data) VALUES (?, ?, ?)')
      .bind(room.code, room.revision, JSON.stringify(room)).run();
    return result.meta.changes === 1;
  }
  async update(room, previous) {
    const data=JSON.stringify(room);
    const update=this.db.prepare('UPDATE rooms SET revision = ?, data = ? WHERE code = ? AND revision = ?')
      .bind(room.revision, data, room.code, previous);
    if(room.game?.phase!=='gameover')return (await update.run()).meta.changes===1;
    const players=room.game.players,matchId=room.matchId??`legacy:${room.code}`;
    const bots=players.map(p=>Boolean(room.members?.[p.id]?.bot));
    const profiles=await Promise.all(players.map((p,i)=>bots[i]?null:this.ensureProfile(p.name,room.updatedAt)));
    const named=players.map((p,i)=>({name:profiles[i]?.name??p.name,points:p.points,bot:bots[i]}));
    const summary=JSON.stringify({players:named,winner:named[room.game.result.winner].name,
      arenas:room.game.round,botCount:bots.filter(Boolean).length});
    const statements=[update,...players.flatMap((p,i)=>bots[i]?[]:[this.db.prepare(`INSERT OR IGNORE INTO profile_results
      (profile_id,match_id,played_at,won,arena_wins,data)
      SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM rooms WHERE code=? AND revision=? AND data=?)`)
      .bind(profiles[i].id,matchId,room.updatedAt,Number(p.id===room.game.result.winner),p.points,summary,room.code,room.revision,data)])];
    const results=await this.db.batch(statements);
    return results[0].meta.changes===1;
  }
  async ensureProfile(name,createdAt) {
    const key=profileKey(name);
    await this.db.prepare('INSERT INTO profiles (id,username_key,name,created_at) VALUES (?,?,?,?) ON CONFLICT(username_key) DO NOTHING')
      .bind(crypto.randomUUID(),key,name,createdAt).run();
    return this.findProfile(key);
  }
  async findProfile(key) {
    return this.db.prepare('SELECT id,name,created_at FROM profiles WHERE username_key=?').bind(key).first();
  }
  async profileSummary(id) {
    const stats=await this.db.prepare(`SELECT COUNT(*) AS matches, COALESCE(SUM(won),0) AS wins,
      COALESCE(SUM(arena_wins),0) AS arenaWins FROM profile_results WHERE profile_id=?`).bind(id).first();
    const rows=await this.db.prepare('SELECT match_id,played_at,won,arena_wins,data FROM profile_results WHERE profile_id=? ORDER BY played_at DESC,match_id DESC LIMIT 10').bind(id).all();
    return {stats,history:rows.results.map(row=>({matchId:row.match_id,playedAt:row.played_at,won:Boolean(row.won),arenaWins:row.arena_wins,...JSON.parse(row.data)}))};
  }
}
