// Notion議事録からの人件費抽出ロジック単体検証
// Usage: npx tsx verify-personnel-extract.ts
import { extractPersonnelCandidates, parseJapaneseMoney } from './lib/personnelExtract'

console.log('=== parseJapaneseMoney ===')
const moneyTests: [string, number | null][] = [
  ['418万円', 4_180_000],
  ['418万', 4_180_000],
  ['1.5億', 150_000_000],
  ['1億2000万', 120_000_000],
  ['4,180,000円', 4_180_000],
  ['22', null],         // 桁少なすぎ
  ['ABC', null],
]
for (const [input, expected] of moneyTests) {
  const got = parseJapaneseMoney(input)
  const ok = got === expected
  console.log(`  ${ok ? '✓' : '✗'} parseJapaneseMoney("${input}") = ${got} (expected ${expected})`)
}

console.log()
console.log('=== extractPersonnelCandidates ===')
const sampleMinutes = `
HD役員会議事録 2026/4/26

【人件費の見直しについて】
4月から新卒アシスタント19名が正式入社。月給は22万円×19人 = 418万円増加。
法定福利費（社会保険料）は別途、約63万円の追加見込み。

【その他】
家賃は1,120万円のまま据え置き。
広告宣伝費は前月比+800万アップで、特に採用広告に集中投下。
通勤手当は新卒分で745万円→約820万円程度に増加見込み。
`

const cands = extractPersonnelCandidates(sampleMinutes)
console.log(`  候補数: ${cands.length}`)
for (const c of cands) {
  console.log(`  ─────────────`)
  console.log(`  金額: ¥${c.amount.toLocaleString()}`)
  console.log(`  式: "${c.expression}"`)
  console.log(`  推定科目: ${c.suggestedAccountCode ?? '(未推定)'}`)
  console.log(`  信頼度: ${c.confidence}`)
  console.log(`  根拠: ${c.reason}`)
  console.log(`  抜粋: ${c.snippet}`)
}

console.log()
console.log('=== 期待される動作 ===')
console.log('  ✓ "22万円×19人 = 418万円" → 4,180,000 (cogs_salon_salary, high)')
console.log('  ✓ "63万円" 周辺に「法定福利費」「社会保険」 → 630,000 (cogs_social, high)')
console.log('  ✓ "+800万アップ" は差分表現でスキップされるはず')
console.log('  ✓ "1,120万円" 周辺は「家賃」のみで人件費キーワードなし → スキップされるはず')
console.log('  ✓ "820万円" 周辺に「通勤手当」 → 8,200,000 (cogs_commute, high)')
