import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {D1RoomStore} from './store.mjs';

// The local server executes the same SQL/CAS path as the hosted D1 service.
export function localStore(filename) {
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  const journal = JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
  const applied = db.prepare('PRAGMA user_version').get().user_version;
  for (const entry of journal.entries.filter(entry => entry.idx >= applied)) {
    const sql = readFileSync(new URL(`../drizzle/${entry.tag}.sql`, import.meta.url), 'utf8');
    db.exec(`BEGIN; ${sql}; PRAGMA user_version = ${entry.idx + 1}; COMMIT;`);
  }
  const adapter = {prepare(sql) {return {bind(...params) {
    const statement = db.prepare(sql);
    const execute=()=>({meta:statement.run(...params)});
    return {first: async () => statement.get(...params),all:async()=>({results:statement.all(...params)}),run:async()=>execute(),execute};
  }};},async batch(statements){
    db.exec('BEGIN IMMEDIATE');
    try{const results=statements.map(statement=>statement.execute());db.exec('COMMIT');return results;}
    catch(error){db.exec('ROLLBACK');throw error;}
  }};
  return {store: new D1RoomStore(adapter), close: () => db.close()};
}
