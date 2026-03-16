import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import type { BMRow } from './types'

const DB_PATH =
  process.env.DB_PATH ??
  (process.env.NODE_ENV === 'production'
    ? '/app/data/aitokyo.db'
    : path.join(process.cwd(), 'data', 'aitokyo.db'))

let db: Database.Database | null = null

export function getDB(): Database.Database {
  if (db) return db

  // ディレクトリが存在しない場合は作成
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  runMigrations(db)
  return db
}

function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales_records (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      date        TEXT NOT NULL,
      store       TEXT NOT NULL,
      staff       TEXT NOT NULL DEFAULT '',
      amount      INTEGER NOT NULL,
      customers   INTEGER NOT NULL DEFAULT 0,
      menu        TEXT NOT NULL DEFAULT '',
      imported_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales_records(date);
    CREATE INDEX IF NOT EXISTS idx_sales_store ON sales_records(store);

    CREATE TABLE IF NOT EXISTS monthly_targets (
      year    INTEGER NOT NULL,
      month   INTEGER NOT NULL,
      target  INTEGER NOT NULL,
      PRIMARY KEY (year, month)
    );

    CREATE TABLE IF NOT EXISTS import_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      filename     TEXT NOT NULL,
      file_hash    TEXT NOT NULL UNIQUE,
      row_count    INTEGER NOT NULL,
      imported_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
}

export function getSalesForMonth(year: number, month: number) {
  const db = getDB()
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return db
    .prepare(
      `SELECT date, store, staff, SUM(amount) as amount, SUM(customers) as customers
       FROM sales_records
       WHERE date LIKE ?
       GROUP BY date, store, staff
       ORDER BY date ASC`
    )
    .all(`${prefix}-%`) as { date: string; store: string; staff: string; amount: number; customers: number }[]
}

export function getTarget(year: number, month: number): number | null {
  const db = getDB()
  const row = db
    .prepare('SELECT target FROM monthly_targets WHERE year=? AND month=?')
    .get(year, month) as { target: number } | undefined
  return row?.target ?? null
}

export function setTarget(year: number, month: number, target: number) {
  const db = getDB()
  db.prepare(
    `INSERT INTO monthly_targets(year, month, target) VALUES(?, ?, ?)
     ON CONFLICT(year, month) DO UPDATE SET target=excluded.target`
  ).run(year, month, target)
}

export function importCSVRows(rows: BMRow[], fileHash: string, filename: string): number {
  const db = getDB()

  // 重複チェック
  const existing = db.prepare('SELECT id FROM import_log WHERE file_hash=?').get(fileHash)
  if (existing) return 0

  const insert = db.prepare(
    `INSERT INTO sales_records(date, store, staff, amount, customers, menu)
     VALUES(@date, @store, @staff, @amount, @customers, @menu)`
  )

  const insertMany = db.transaction((rows: BMRow[]) => {
    for (const row of rows) insert.run(row)
    return rows.length
  })

  const count = insertMany(rows)
  db.prepare('INSERT INTO import_log(filename, file_hash, row_count) VALUES(?,?,?)').run(
    filename,
    fileHash,
    count
  )
  return count
}
