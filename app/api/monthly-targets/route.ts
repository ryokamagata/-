import { NextRequest, NextResponse } from 'next/server'
import { getMonthlyTargets, setMonthlyTargets } from '@/lib/db'

export async function GET(req: NextRequest) {
  const year = parseInt(req.nextUrl.searchParams.get('year') ?? '')
  if (isNaN(year)) return NextResponse.json({ error: 'year required' }, { status: 400 })

  const targets = getMonthlyTargets(year)
  return NextResponse.json({ year, targets })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { year, targets } = body as { year: number; targets: Record<number, number> }

  if (!year || !targets || typeof targets !== 'object') {
    return NextResponse.json({ error: 'year and targets required' }, { status: 400 })
  }

  setMonthlyTargets(year, targets)
  return NextResponse.json({ ok: true })
}
