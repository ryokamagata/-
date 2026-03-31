import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export const revalidate = 0

export async function GET() {
  const db = getDB()

  // Check for duplicates in store_daily_sales
  const duplicates = db.prepare(`
    SELECT date, bm_code, store, COUNT(*) as cnt, SUM(sales) as total_sales
    FROM store_daily_sales
    WHERE date LIKE '2026-03%'
    GROUP BY date, bm_code
    HAVING cnt > 1
    ORDER BY cnt DESC
    LIMIT 20
  `).all()

  // Total row count for March 2026
  const totalRows = db.prepare(`
    SELECT COUNT(*) as cnt FROM store_daily_sales WHERE date LIKE '2026-03%'
  `).get() as { cnt: number }

  // Unique date+bm_code combos
  const uniqueCombos = db.prepare(`
    SELECT COUNT(DISTINCT date || '-' || bm_code) as cnt FROM store_daily_sales WHERE date LIKE '2026-03%'
  `).get() as { cnt: number }

  // Check UNIQUE constraint
  const tableInfo = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='store_daily_sales'`).get() as { sql: string } | undefined

  // Sample data for one day
  const sampleDay = db.prepare(`
    SELECT date, store, bm_code, sales, customers FROM store_daily_sales
    WHERE date = '2026-03-01' ORDER BY store
  `).all()

  return NextResponse.json({
    totalRows: totalRows.cnt,
    uniqueCombos: uniqueCombos.cnt,
    duplicates,
    tableSql: tableInfo?.sql,
    sampleDay,
  })
}
