// Googleシートから取得した CSV を実際にパースして結果を検証するスクリプト
// Usage: npx tsx verify-pl-import.ts
import { parsePLSheet } from './lib/plParser'
import * as fs from 'fs'

const csv = fs.readFileSync('/tmp/pl_sheet_default.csv', 'utf-8')
console.log(`CSV size: ${csv.length} bytes, lines: ${csv.split('\n').length}`)
console.log('--- 最初の8行 ---')
const lines = csv.split(/\r?\n/)
for (let i = 0; i < Math.min(8, lines.length); i++) {
  const fields = lines[i].split(',')
  console.log(`L${i} (${fields.length}列): ${lines[i].slice(0, 200)}`)
}
console.log('---')

const result = parsePLSheet(csv, 2025)
console.log(`rows: ${result.rows.length}`)
console.log(`monthsDetected:`, result.monthsDetected)
console.log(`unmatched (${result.unmatched.length}件):`, result.unmatched.slice(0, 30))
console.log(`skipped: ${result.skipped}`)
console.log()
console.log('--- 取込データ先頭10件 ---')
for (const r of result.rows.slice(0, 10)) {
  console.log(`  ${r.year}-${String(r.month).padStart(2, '0')} ${r.accountCode.padEnd(20)} ${r.store ?? '(全社)'} ${r.amount.toLocaleString()}`)
}

// 売上高（revenue）行を月ごとに表示
console.log()
console.log('--- 全社売上(revenue) 月別 ---')
for (const r of result.rows.filter(x => x.accountCode === 'revenue' && x.store === null)) {
  console.log(`  ${r.year}-${String(r.month).padStart(2, '0')}: ${r.amount.toLocaleString()}`)
}

// 給与(cogs_salon_salary)月別
console.log()
console.log('--- 正社員給与(cogs_salon_salary) 月別 ---')
for (const r of result.rows.filter(x => x.accountCode === 'cogs_salon_salary' && x.store === null)) {
  console.log(`  ${r.year}-${String(r.month).padStart(2, '0')}: ${r.amount.toLocaleString()}`)
}
