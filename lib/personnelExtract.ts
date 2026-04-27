// 議事録テキストから人件費系の金額表現を抽出するユーティリティ
//
// 想定入力: Notion ページ本文を結合したプレーンテキスト
// 出力: 候補配列（金額・原文スニペット・推定科目・信頼度）
//
// 設計方針:
//   - 自動でDBへ書き込まない。あくまで「候補提示」までが責務。
//   - 金額表現は「418万円」「418万」「4,180,000円」「22万 × 19人」などを正規化。
//   - 「+800万」「800万アップ」など差分表現は base が不明なので候補にしない。
//   - 周辺語（給与・人件費・正社員・アシスタント・新卒・法定福利・社保）の有無で
//     科目（cogs_salon_salary / cogs_social）を推定。

export type PersonnelCandidate = {
  amount: number
  expression: string
  snippet: string
  suggestedAccountCode: string | null
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

const PERSONNEL_KEYWORDS = ['給与', '給料', '月給', '年俸', '基本給', '人件費', '正社員', 'アシスタント', '新卒', 'スタイリスト', '美容師', '従業員']
const SOCIAL_KEYWORDS = ['法定福利', '社会保険', '社保', '健康保険', '厚生年金']
const COMMUTE_KEYWORDS = ['通勤手当', '交通費']

export function parseJapaneseMoney(s: string): number | null {
  const cleaned = s.replace(/[¥,\s]/g, '')
  const m1 = cleaned.match(/^(\d+(?:\.\d+)?)万円?$/)
  if (m1) return Math.round(parseFloat(m1[1]) * 10000)
  const m2 = cleaned.match(/^(\d+(?:\.\d+)?)億(\d+(?:\.\d+)?)?万?円?$/)
  if (m2) {
    const oku = parseFloat(m2[1]) * 100_000_000
    const man = m2[2] ? parseFloat(m2[2]) * 10000 : 0
    return Math.round(oku + man)
  }
  const m3 = cleaned.match(/^(\d+)円?$/)
  if (m3) {
    const v = parseInt(m3[1], 10)
    if (v < 1000) return null
    return v
  }
  return null
}

function extractMultiplication(text: string): { amount: number; expression: string }[] {
  const out: { amount: number; expression: string }[] = []
  const re = /(\d+(?:\.\d+)?)\s*万円?\s*[×xX*✕]\s*(\d+)\s*人?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const per = parseFloat(m[1]) * 10000
    const count = parseInt(m[2], 10)
    if (per > 0 && count > 0 && count < 1000) {
      out.push({ amount: Math.round(per * count), expression: m[0].trim() })
    }
  }
  return out
}

function extractSingleAmounts(text: string): { amount: number; expression: string; index: number; isDelta: boolean }[] {
  const out: { amount: number; expression: string; index: number; isDelta: boolean }[] = []
  const re = /(\d{1,4}(?:,\d{3})*(?:\.\d+)?)\s*(億|万|千万)\s*(\d+(?:\.\d+)?\s*万)?\s*円?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const expr = m[0].trim()
    const v = parseJapaneseMoney(expr)
    if (v === null || v < 100_000) continue
    const before = text.slice(Math.max(0, m.index - 2), m.index)
    const after = text.slice(m.index + expr.length, m.index + expr.length + 4)
    const isDelta = /[+\-＋−]$/.test(before) || /(アップ|増|減|UP|up|削減|プラス|マイナス)/.test(after)
    out.push({ amount: v, expression: expr, index: m.index, isDelta })
  }
  return out
}

/** 同じ文（「。」または改行で区切られた範囲）に絞ってキーワード判定 */
function sentenceAround(text: string, index: number, exprLength: number): string {
  // 前方は最後の「。」または改行、後方は次の「。」または改行までを取る
  const before = text.slice(Math.max(0, index - 200), index)
  const beforeStart = Math.max(
    before.lastIndexOf('。'),
    before.lastIndexOf('\n'),
    before.lastIndexOf('】'),
  )
  const after = text.slice(index + exprLength, Math.min(text.length, index + exprLength + 200))
  const afterEndCands = [after.indexOf('。'), after.indexOf('\n'), after.indexOf('【')].filter(i => i >= 0)
  const afterEnd = afterEndCands.length > 0 ? Math.min(...afterEndCands) : after.length

  const left = beforeStart >= 0 ? before.slice(beforeStart + 1) : before
  const right = after.slice(0, afterEnd)
  return (left + text.slice(index, index + exprLength) + right).trim()
}

function classifyContext(sentence: string): { code: string | null; reason: string; confidence: 'high' | 'medium' | 'low' } {
  // 家賃・地代の話なら早期リジェクト
  if (/家賃|地代|賃借|店舗.*賃|オフィス.*賃|物件/.test(sentence)) {
    return { code: null, reason: '家賃・賃借文脈なので人件費ではない', confidence: 'low' }
  }
  if (SOCIAL_KEYWORDS.some(k => sentence.includes(k))) {
    return { code: 'cogs_social', reason: '法定福利費・社会保険関連の語が同じ文に出現', confidence: 'high' }
  }
  if (COMMUTE_KEYWORDS.some(k => sentence.includes(k))) {
    return { code: 'cogs_commute', reason: '通勤手当・交通費関連の語が同じ文に出現', confidence: 'high' }
  }
  const personnelHit = PERSONNEL_KEYWORDS.find(k => sentence.includes(k))
  if (personnelHit) {
    const conf: 'high' | 'medium' = ['給与', '給料', '月給', '年俸', '基本給', '正社員', 'アシスタント', '新卒'].includes(personnelHit) ? 'high' : 'medium'
    return { code: 'cogs_salon_salary', reason: `人件費関連語「${personnelHit}」が同じ文に出現`, confidence: conf }
  }
  return { code: null, reason: '人件費関連語なし', confidence: 'low' }
}

export function extractPersonnelCandidates(text: string): PersonnelCandidate[] {
  if (!text) return []
  const candidates: PersonnelCandidate[] = []

  // 多重出現対応のため、見つかった全位置を保持しておく
  const usedRanges: { from: number; to: number }[] = []

  for (const m of extractMultiplication(text)) {
    const idx = text.indexOf(m.expression)
    if (idx < 0) continue
    const sentence = sentenceAround(text, idx, m.expression.length)
    const ctx = classifyContext(sentence)
    if (ctx.code === null) continue
    candidates.push({
      amount: m.amount,
      expression: m.expression,
      snippet: sentence,
      suggestedAccountCode: ctx.code,
      confidence: ctx.confidence === 'low' ? 'medium' : 'high',
      reason: `${ctx.reason}／掛け算で月額算出: ${m.expression}`,
    })
    usedRanges.push({ from: idx, to: idx + m.expression.length })
  }

  for (const m of extractSingleAmounts(text)) {
    // 既に掛け算式の一部として処理済みならスキップ
    if (usedRanges.some(r => m.index >= r.from && m.index < r.to)) continue
    const sentence = sentenceAround(text, m.index, m.expression.length)
    const ctx = classifyContext(sentence)
    if (ctx.code === null) continue
    // 差分表現（+800万 / 800万増 等）は信頼度を一段下げる（残しはする）
    const conf: 'high' | 'medium' | 'low' = m.isDelta
      ? (ctx.confidence === 'high' ? 'medium' : 'low')
      : ctx.confidence
    const reason = m.isDelta ? `${ctx.reason}（※差分/増減表現の可能性あり）` : ctx.reason
    candidates.push({
      amount: m.amount,
      expression: m.expression,
      snippet: sentence,
      suggestedAccountCode: ctx.code,
      confidence: conf,
      reason,
    })
  }

  return candidates
}
