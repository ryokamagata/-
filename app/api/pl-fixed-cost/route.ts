import { NextResponse } from 'next/server'
import { getCostAccounts, getFixedCosts, upsertFixedCost } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * 固定費の月次手入力 API。
 * 新卒入社など PL に時系列で反映したい固定費を、画面から有効開始月とともに登録する。
 *
 * GET: 現時点（クエリ year/month、省略時は当月）で有効な全社固定費の一覧 + 科目マスタ
 * POST body: {
 *   accountCode: string,         // 例: 'cogs_salon_salary'
 *   amount: number,              // 月額（円）
 *   validFrom: 'YYYY-MM',        // 有効開始月
 *   validTo?: 'YYYY-MM' | null,  // 有効終了月（任意、null で無期限）
 *   note?: string,
 * }
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const year = parseInt(url.searchParams.get('year') ?? String(now.getFullYear()), 10)
  const month = parseInt(url.searchParams.get('month') ?? String(now.getMonth() + 1), 10)

  const accounts = getCostAccounts()
    .filter(a => a.category === 'cogs' || a.category === 'sga')
  const fixedCosts = getFixedCosts(year, month).filter(f => f.store === null)

  return NextResponse.json({
    year, month,
    accounts: accounts.map(a => ({
      code: a.code, name: a.name, category: a.category, subcategory: a.subcategory ?? null,
    })),
    fixedCosts,
  })
}

export async function POST(req: Request) {
  let body: {
    accountCode?: string
    amount?: number
    validFrom?: string
    validTo?: string | null
    note?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json body' }, { status: 400 })
  }

  const accountCode = body.accountCode
  const amount = body.amount
  const validFrom = body.validFrom
  const validTo = body.validTo ?? null
  const note = body.note ?? null

  if (!accountCode || typeof accountCode !== 'string') {
    return NextResponse.json({ ok: false, error: 'accountCode is required' }, { status: 400 })
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return NextResponse.json({ ok: false, error: 'amount must be a number' }, { status: 400 })
  }
  if (!validFrom || !/^\d{4}-\d{1,2}$/.test(validFrom)) {
    return NextResponse.json({ ok: false, error: 'validFrom must be YYYY-MM' }, { status: 400 })
  }
  if (validTo !== null && !/^\d{4}-\d{1,2}$/.test(validTo)) {
    return NextResponse.json({ ok: false, error: 'validTo must be YYYY-MM or null' }, { status: 400 })
  }

  const accounts = getCostAccounts()
  if (!accounts.find(a => a.code === accountCode)) {
    return NextResponse.json({ ok: false, error: `unknown accountCode: ${accountCode}` }, { status: 400 })
  }

  upsertFixedCost(accountCode, null, normalizeYM(validFrom), validTo ? normalizeYM(validTo) : null, Math.round(amount), note)
  return NextResponse.json({ ok: true })
}

/** "2026-4" / "2026-04" を "2026-04" に揃える */
function normalizeYM(s: string): string {
  const [y, m] = s.split('-').map(Number)
  return `${y}-${String(m).padStart(2, '0')}`
}
