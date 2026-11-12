import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

let database: DatabaseSync | undefined;

function open() {
 if (database) return database;
 const filename = resolve(process.env.STATION_DB_PATH || './data/station.sqlite');
 mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
 const db = new DatabaseSync(filename);
 try {
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
  db.exec('BEGIN IMMEDIATE');
  db.exec('CREATE TABLE IF NOT EXISTS station_migrations (name TEXT PRIMARY KEY)');
  const folder = join(process.cwd(), 'drizzle');
  for (const name of readdirSync(folder).filter(n => n.endsWith('.sql')).sort()) {
   if (db.prepare('SELECT 1 FROM station_migrations WHERE name=?').get(name)) continue;
   db.exec(readFileSync(join(folder, name), 'utf8'));
   db.prepare('INSERT INTO station_migrations(name) VALUES (?)').run(name);
  }
  db.exec('COMMIT');
  database = db;
  return db;
 } catch (error) { db.close(); throw error; }
}

export function calendarDb() {
 return {
  prepare(sql: string) {
   const statement = open().prepare(sql);
   function query(args: SQLInputValue[]) {
    return {
     all: async () => ({ results: statement.all(...args) }),
     first: async (): Promise<any> => statement.get(...args) ?? null,
     run: async () => ({ meta: { changes: Number(statement.run(...args).changes) } }),
    };
   }
   return { ...query([]), bind: (...args: SQLInputValue[]) => query(args) };
  }
 };
}
