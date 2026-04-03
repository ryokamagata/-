'use client'

import { useState } from 'react'
import type { AnnualReviewInput } from '@/lib/reviewRules'

type AnnualColumn = {
  category: string
  icon: string
  title: string
  body: string
  metric: string
  priority: 'high' | 'medium' | 'low'
}

export default function AnnualReviewPanel({
  projection,
  annualSummaries,
  staffSummary,
  totalMonthly,
}: AnnualReviewInput) {
  const [open, setOpen] = useState(true)
  const columns = generateAnnualColumns({ projection, annualSummaries, staffSummary, totalMonthly })

  if (columns.length === 0) return null

  const highCount = columns.filter(c => c.priority === 'high').length

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden border border-gray-700/50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-white">
            年間改善コラム
          </span>
          {projection && (
            <span className="text-xs text-gray-500">
              {projection.currentYear}年の数字から自動分析
            </span>
          )}
          {highCount > 0 && (
            <span className="text-[10px] bg-red-900/60 text-red-300 px-1.5 py-0.5 rounded font-medium">
              要注目 {highCount}件
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-3 sm:px-4 pb-4 space-y-3">
          {columns.map((col, idx) => (
            <AnnualColumnCard key={idx} item={col} />
          ))}
        </div>
      )}
    </div>
  )
}

function AnnualColumnCard({ item }: { item: AnnualColumn }) {
  const bgColor = item.priority === 'high'
    ? 'bg-red-950/30 border-red-800/40'
    : item.priority === 'medium'
    ? 'bg-yellow-950/20 border-yellow-800/30'
    : 'bg-blue-950/20 border-blue-800/30'

  const tagColor = item.priority === 'high'
    ? 'bg-red-900/50 text-red-300'
    : item.priority === 'medium'
    ? 'bg-yellow-900/50 text-yellow-300'
    : 'bg-blue-900/50 text-blue-300'

  const priorityLabel = item.priority === 'high'
    ? '要対応'
    : item.priority === 'medium'
    ? '改善余地'
    : '好調'

  return (
    <div className={`rounded-xl p-4 border ${bgColor}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{item.icon}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tagColor}`}>
          {item.category}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tagColor}`}>
          {priorityLabel}
        </span>
      </div>
      <p className="text-sm font-bold text-white mb-1.5 leading-snug">{item.title}</p>
      <div className="bg-gray-900/60 rounded-lg px-3 py-1.5 mb-2">
        <p className="text-[11px] text-cyan-400 font-medium">{item.metric}</p>
      </div>
      <p className="text-xs text-gray-300 leading-relaxed">{item.body}</p>
    </div>
  )
}

function generateAnnualColumns(input: AnnualReviewInput): AnnualColumn[] {
  const cols: AnnualColumn[] = []
  const { projection, annualSummaries, staffSummary, totalMonthly } = input

  if (!projection) return cols

  // ── 1. 年間目標との差分分析 ─────────────────────────────────────
  if (projection.annualTarget && projection.annualTarget > 0) {
    const gap = projection.projectedTotal - projection.annualTarget
    const remainingMonths = 12 - projection.ytdMonths
    const currentMonthlyAvg = projection.ytdMonths > 0
      ? Math.round(projection.ytdTotal / projection.ytdMonths) : 0

    if (gap < 0) {
      const shortfall = Math.abs(gap)
      const monthlyNeeded = remainingMonths > 0 ? Math.round(shortfall / remainingMonths) : 0
      const upliftPct = currentMonthlyAvg > 0
        ? Math.round((monthlyNeeded / currentMonthlyAvg) * 100) : 0

      // 全シナリオで未達か判定
      const allFail = projection.optimisticTotal < projection.annualTarget
      const conservativeFail = projection.conservativeTotal < projection.annualTarget

      if (allFail) {
        cols.push({
          category: '年間目標',
          icon: '\u{1F6A8}',
          title: `全シナリオで年間目標未達 — 構造的な対策が必要`,
          body: `高め見込み${fmtOku(projection.optimisticTotal)}でも目標${fmtOku(projection.annualTarget)}に届かない。目標の現実性を再検証するか、出店計画・大型施策で構造的にトップラインを引き上げる判断が必要。`,
          metric: `目標 ${fmtOku(projection.annualTarget)} / 高め ${fmtOku(projection.optimisticTotal)} / 不足 ${fmtOku(shortfall)}`,
          priority: 'high',
        })
      } else {
        cols.push({
          category: '年間目標',
          icon: '\u{1F3AF}',
          title: `年間目標まで${fmtOku(shortfall)}不足 — 残り${remainingMonths}ヶ月で巻き返し`,
          body: `月平均+${fmtMan(monthlyNeeded)}（現月平均比+${upliftPct}%）の上乗せが必要。【月次】高単価メニューの構成比を5%引き上げ。【四半期】低調店舗のエリアマーケティング強化。【繁忙期】7-8月/12月に集中キャンペーンで回収。`,
          metric: `月平均 ${fmtMan(currentMonthlyAvg)} → 必要 +${fmtMan(monthlyNeeded)}/月 / 残り${remainingMonths}ヶ月`,
          priority: conservativeFail ? 'high' : 'medium',
        })
      }
    } else {
      cols.push({
        category: '年間目標',
        icon: '\u{2705}',
        title: `年間目標達成ペース — 着地${fmtOku(projection.projectedTotal)}`,
        body: `目標${fmtOku(projection.annualTarget)}を上回る見込み。余力を来期の基盤づくり（新規チャネル開拓・スタッフ育成）に投資するチャンス。`,
        metric: `着地 ${fmtOku(projection.projectedTotal)} / 目標 ${fmtOku(projection.annualTarget)} / 超過 +${fmtOku(gap)}`,
        priority: 'low',
      })
    }
  }

  // ── 2. 前年比較 ────────────────────────────────────────────────
  if (projection.yoyProjectedGrowth !== null) {
    const growth = projection.yoyProjectedGrowth

    if (growth < -3) {
      // 前年割れ月を特定
      const prevYearSummary = annualSummaries.find(s => s.year === projection.currentYear - 1)
      const weakMonths: string[] = []
      if (prevYearSummary) {
        for (const d of projection.monthDetails) {
          const prevMonth = prevYearSummary.monthDetails.find(m => m.month === d.month)
          if (prevMonth && !d.isProjected && d.sales < prevMonth.sales) {
            const dropPct = Math.round(((d.sales - prevMonth.sales) / prevMonth.sales) * 100)
            weakMonths.push(`${d.month}月(${dropPct}%)`)
          }
        }
      }

      cols.push({
        category: '前年比較',
        icon: '\u{1F4C9}',
        title: `前年比${growth.toFixed(1)}% — 年間で前年割れ見込み`,
        body: weakMonths.length > 0
          ? `前年割れ月: ${weakMonths.join('、')}。各月の要因分析を（客数減 or 客単価減）。特定月の落ち込みが大きい場合は、競合動向・スタッフ異動を洗い出し、今年の同時期に対策を先手で打つ。`
          : `前年${fmtOku(projection.prevYearTotal)}を下回るペース。客数減か客単価減か要因分析が必要。`,
        metric: `前年 ${fmtOku(projection.prevYearTotal)} → 着地 ${fmtOku(projection.projectedTotal)} / ${growth.toFixed(1)}%`,
        priority: 'high',
      })
    } else if (growth > 5) {
      cols.push({
        category: '前年比較',
        icon: '\u{1F4C8}',
        title: `前年比+${growth.toFixed(1)}% — 成長トレンド`,
        body: `前年${fmtOku(projection.prevYearTotal)}から着実に成長中。この成長率を維持するため、好調月の施策を他月にも横展開。スタッフ育成・新規チャネル開拓で来年以降も持続可能な成長基盤を構築。`,
        metric: `前年 ${fmtOku(projection.prevYearTotal)} → 着地 ${fmtOku(projection.projectedTotal)}`,
        priority: 'low',
      })
    }
  }

  // ── 3. 季節変動分析 ────────────────────────────────────────────
  const actualDetails = projection.monthDetails.filter(d => !d.isProjected)
  if (actualDetails.length >= 3) {
    const avgSales = actualDetails.reduce((s, d) => s + d.sales, 0) / actualDetails.length
    const weakMonths = actualDetails.filter(d => d.sales < avgSales * 0.8)
    const strongMonths = actualDetails.filter(d => d.sales > avgSales * 1.2)

    if (weakMonths.length > 0 && strongMonths.length > 0) {
      cols.push({
        category: '季節変動',
        icon: '\u{1F4CA}',
        title: '売上の季節変動が大きい — 閑散期対策で波を均す',
        body: `低調月に先手でキャンペーン（梅雨時期のヘアケア訴求、閑散期の紹介割引など）を仕込む。繁忙月は席数最大化と単価UPに集中。年間の波を均す戦略で安定成長を。`,
        metric: `好調月: ${strongMonths.map(m => `${m.month}月(${fmtMan(m.sales)})`).join(', ')} / 低調月: ${weakMonths.map(m => `${m.month}月(${fmtMan(m.sales)})`).join(', ')}`,
        priority: 'medium',
      })
    }

    // 直近3ヶ月連続下落
    const last3 = actualDetails.slice(-3)
    if (last3.length >= 3) {
      const isDeclining = last3.every((d, i) => i === 0 || d.sales < last3[i - 1].sales)
      if (isDeclining) {
        const dropTotal = last3[0].sales - last3[last3.length - 1].sales
        cols.push({
          category: 'トレンド',
          icon: '\u{26A0}\u{FE0F}',
          title: '3ヶ月連続で売上減少中 — 構造的要因の可能性',
          body: `単なる季節要因ではない可能性。スタッフ離職・競合出店・エリアの人口動態をチェック。構造的であればメニュー改定・ターゲット層の見直し・SNSマーケの刷新が必要。`,
          metric: `${last3.map(d => `${d.month}月:${fmtMan(d.sales)}`).join(' → ')}（${fmtMan(dropTotal)}減）`,
          priority: 'high',
        })
      }
    }
  }

  // ── 4. 客単価 × 客数の年間トレンド ─────────────────────────────
  if (totalMonthly.length >= 4) {
    const recent = totalMonthly.slice(-4)
    const avgSpends = recent
      .filter(m => m.customers > 0)
      .map(m => ({ month: m.month.slice(5), spend: Math.round(m.sales / m.customers), cust: m.customers }))

    if (avgSpends.length >= 3) {
      const first = avgSpends[0]
      const last = avgSpends[avgSpends.length - 1]
      const spendDiff = last.spend - first.spend
      const custDiff = last.cust - first.cust

      if (spendDiff < -300 && custDiff < 0) {
        cols.push({
          category: '客単価×客数',
          icon: '\u{1F6A8}',
          title: '客単価・客数ともに下落トレンド',
          body: `売上のダブルパンチ状態。客単価はセットメニュー導入で底上げ、客数はホットペッパーの掲載プランUPまたは新規チャネル（Instagram広告・Google Map対策）の開拓を同時並行で。`,
          metric: `客単価: ${fmtYen(first.spend)}→${fmtYen(last.spend)} / 客数: ${first.cust}→${last.cust}人`,
          priority: 'high',
        })
      } else if (spendDiff < -300) {
        cols.push({
          category: '客単価',
          icon: '\u{1F4B0}',
          title: `客単価が${fmtYen(Math.abs(spendDiff))}低下 — 単価UP施策が急務`,
          body: `客数は維持も1人あたり売上が減少。メニュー構成を見直し、カット単品比率が上がっていないか確認。スタッフのアップセルトーク研修を実施し、セット率を週次追跡。`,
          metric: `${first.month}月 ${fmtYen(first.spend)} → ${last.month}月 ${fmtYen(last.spend)}`,
          priority: 'medium',
        })
      } else if (custDiff < -100 && spendDiff >= 0) {
        cols.push({
          category: '客数',
          icon: '\u{1F4C9}',
          title: '客数が減少トレンド（単価は維持）',
          body: `離脱顧客の分析を。60日以上未来店の休眠客リストを抽出し、復帰クーポンを配信。並行して新規流入チャネルの拡大を（MEO対策・インスタリール強化）。`,
          metric: `${first.month}月 ${first.cust}人 → ${last.month}月 ${last.cust}人 / 単価は維持`,
          priority: 'medium',
        })
      }
    }
  }

  // ── 5. スタッフ成長の二極化 ────────────────────────────────────
  if (staffSummary.length >= 4) {
    const withGrowth = staffSummary.filter(s => s.growthRate !== null)
    const growing = withGrowth.filter(s => s.growthRate! > 10)
    const declining = withGrowth.filter(s => s.growthRate! < -10)

    if (growing.length >= 1 && declining.length >= 1) {
      const topGrowers = growing.sort((a, b) => (b.growthRate ?? 0) - (a.growthRate ?? 0)).slice(0, 3)
      const topDecliners = declining.sort((a, b) => (a.growthRate ?? 0) - (b.growthRate ?? 0)).slice(0, 3)

      cols.push({
        category: 'スタッフ',
        icon: '\u{1F4CA}',
        title: `スタッフ成長の二極化 — 上昇${growing.length}名 / 下降${declining.length}名`,
        body: `上昇スタッフの成功要因（指名率・リピート率・メニュー単価）を分析し、下降スタッフへの横展開を。月次1on1で個人目標設定と技術フィードバックの仕組みを構築。`,
        metric: `上昇: ${topGrowers.map(s => `${s.staff}(+${s.growthRate?.toFixed(0)}%)`).join(', ')} / 下降: ${topDecliners.map(s => `${s.staff}(${s.growthRate?.toFixed(0)}%)`).join(', ')}`,
        priority: 'high',
      })
    } else if (declining.length >= 2) {
      cols.push({
        category: 'スタッフ',
        icon: '\u{26A0}\u{FE0F}',
        title: `${declining.length}名が前月比-10%超 — 個別テコ入れ`,
        body: `個別面談で課題をヒアリング（モチベーション・技術・顧客離れ）。アシスタントとのペア営業、先輩スタイリストのカウンセリング同席で立て直し支援。`,
        metric: declining.slice(0, 3).map(s => `${s.staff}(${s.growthRate?.toFixed(0)}%)`).join(' / '),
        priority: 'high',
      })
    } else if (growing.length >= 3) {
      cols.push({
        category: 'スタッフ',
        icon: '\u{1F4AA}',
        title: `${growing.length}名が+10%超の成長 — チーム全体が好調`,
        body: `好調メンバーの取り組みを全体で共有し、組織的な成長ノウハウとして定着させる。`,
        metric: growing.slice(0, 3).map(s => `${s.staff}(+${s.growthRate?.toFixed(0)}%)`).join(' / '),
        priority: 'low',
      })
    }
  }

  // ── 6. 堅実/高め予測とリスクシナリオ ───────────────────────────
  if (projection.annualTarget && projection.annualTarget > 0) {
    const conservativeGap = projection.conservativeTotal - projection.annualTarget
    const optimisticGap = projection.optimisticTotal - projection.annualTarget

    if (conservativeGap < 0 && optimisticGap >= 0) {
      cols.push({
        category: 'リスク',
        icon: '\u{26A1}',
        title: '目標達成には攻めの経営が必要',
        body: `守りの運営では未達確定。【攻め施策】新メニュー投入・繁忙期キャンペーン強化・新規チャネル開拓のいずれかで月次+5%の上乗せを目指す。`,
        metric: `堅実ライン ${fmtOku(projection.conservativeTotal)}(未達) / 高め ${fmtOku(projection.optimisticTotal)}(達成) / 目標 ${fmtOku(projection.annualTarget)}`,
        priority: 'medium',
      })
    }
  }

  // 優先度順
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  cols.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return cols
}

function fmtOku(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}億`
  if (v >= 10_000) return `${Math.round(v / 10_000).toLocaleString()}万`
  return `¥${v.toLocaleString()}`
}

function fmtMan(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}億`
  if (v >= 10_000) return `${Math.round(v / 10_000).toLocaleString()}万`
  return `¥${v.toLocaleString()}`
}

function fmtYen(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}億`
  if (v >= 10_000) return `¥${Math.round(v / 10_000).toLocaleString()}万`
  return `¥${v.toLocaleString()}`
}
