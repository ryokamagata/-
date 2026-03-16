import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { parseCSVBuffer } from '@/lib/csvParser'
import { importCSVRows } from '@/lib/db'

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'リクエストの解析に失敗しました' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 })
  }

  if (!file.name.endsWith('.csv')) {
    return NextResponse.json({ error: 'CSVファイルをアップロードしてください' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const fileHash = createHash('sha256').update(Buffer.from(buffer)).digest('hex')

  let rows
  try {
    rows = parseCSVBuffer(buffer)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'CSV解析エラー'
    return NextResponse.json({ error: message }, { status: 422 })
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'CSVに有効なデータが見つかりません。列名を確認してください。' },
      { status: 422 }
    )
  }

  const imported = importCSVRows(rows, fileHash, file.name)

  return NextResponse.json({
    imported,
    total: rows.length,
    duplicate: imported === 0,
  })
}
