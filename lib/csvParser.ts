import Encoding from 'encoding-japanese'
import Papa from 'papaparse'
import type { BMRow } from './types'

// BM のバージョン差異に対応する列名エイリアス
const COLUMN_ALIASES: Record<string, string[]> = {
  date:      ['日付', '来店日', '売上日付', '日時', '来店日時'],
  store:     ['店舗名', '店舗', '店', '店名'],
  staff:     ['スタッフ名', 'スタッフ', '担当者', '担当スタッフ', '担当', 'リーダー名'],
  amount:    ['売上金額', '売上', '合計金額', '合計売上', '技術売上', '売上合計', '施術料金'],
  customers: ['客数', '来客数', '人数', '来店人数'],
  menu:      ['メニュー', 'メニュー名', 'サービス', '施術内容', '技術名'],
}

export function parseCSVBuffer(buffer: ArrayBuffer): BMRow[] {
  // Step 1: Shift-JIS → UTF-16 変換
  const uint8 = new Uint8Array(buffer)
  const detected = Encoding.detect(uint8)
  const unicodeArray = Encoding.convert(uint8, { to: 'UNICODE', from: detected || 'SJIS' })
  const text = Encoding.codeToString(unicodeArray)

  // Step 2: CSV 解析
  const { data, errors } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  })

  if (errors.length > 0 && data.length === 0) {
    throw new Error(`CSV解析エラー: ${errors[0].message}`)
  }

  if (data.length === 0) {
    throw new Error('CSVにデータが見つかりません')
  }

  // Step 3: 列名解決
  const headers = Object.keys(data[0] ?? {})
  const colMap = resolveColumns(headers)

  // Step 4: 行を正規化
  const rows: BMRow[] = []
  for (const row of data) {
    const normalized = normalizeRow(row, colMap)
    if (normalized) rows.push(normalized)
  }

  return rows
}

function resolveColumns(headers: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {}
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    result[field] = aliases.find((a) => headers.includes(a)) ?? null
  }
  return result
}

function normalizeRow(
  row: Record<string, string>,
  colMap: Record<string, string | null>
): BMRow | null {
  const dateRaw = colMap.date ? (row[colMap.date] ?? '') : ''
  const date = normalizeDateString(dateRaw)
  if (!date) return null

  const amountRaw = colMap.amount ? (row[colMap.amount] ?? '0') : '0'
  const amount = parseJPNumber(amountRaw)
  if (isNaN(amount) || amount < 0) return null

  return {
    date,
    store: colMap.store ? (row[colMap.store] ?? '').trim() || 'その他' : 'その他',
    staff: colMap.staff ? (row[colMap.staff] ?? '').trim() || '不明' : '不明',
    amount,
    customers: colMap.customers ? parseJPNumber(row[colMap.customers] ?? '0') || 0 : 0,
    menu: colMap.menu ? (row[colMap.menu] ?? '').trim() : '',
  }
}

function normalizeDateString(raw: string): string | null {
  if (!raw) return null

  // YYYY/MM/DD または YYYY-MM-DD
  const isoMatch = raw.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`
  }

  // 和暦: 令和7年3月15日 → 2025-03-15
  const wareki = raw.match(/(?:令和|R)(\d+)年(\d{1,2})月(\d{1,2})日?/)
  if (wareki) {
    const year = 2018 + parseInt(wareki[1])
    return `${year}-${wareki[2].padStart(2, '0')}-${wareki[3].padStart(2, '0')}`
  }

  // MM/DD（年なし）→ 当月と仮定
  const shortMatch = raw.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (shortMatch) {
    const now = new Date()
    return `${now.getFullYear()}-${shortMatch[1].padStart(2, '0')}-${shortMatch[2].padStart(2, '0')}`
  }

  return null
}

function parseJPNumber(s: string): number {
  // ¥, 円, カンマ, スペースを除去
  const cleaned = s.replace(/[¥,\s円]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}
