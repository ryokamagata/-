import { NextRequest, NextResponse } from 'next/server'
import { getTarget, setTarget } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))

  if (!year || !month) {
    return NextResponse.json({ error: 'year と month が必要です' }, { status: 400 })
  }

  const target = getTarget(year, month)
  return NextResponse.json({ target })
}

export async function POST(req: NextRequest) {
  let body: { year?: number; month?: number; target?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '無効なJSONです' }, { status: 400 })
  }

  const { year, month, target } = body
  if (!year || !month || target === undefined || target < 0) {
    return NextResponse.json({ error: 'year, month, target（0以上）が必要です' }, { status: 400 })
  }

  setTarget(year, month, Math.round(target))
  return NextResponse.json({ ok: true })
}
