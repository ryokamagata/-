'use client'

import { useState } from 'react'
import type { DashboardData, StaffDetailItem } from '@/lib/types'

type ColumnItem = {
  category: string
  title: string
  body: string
  metric: string
  priority: 'high' | 'medium' | 'low'
}

export default function ColumnPanel({ data }: { data: DashboardData }) {
  const [expanded, setExpanded] = useState(true)
  const columns = generateColumns(data)

  if (columns.length === 0) return null

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-sm font-medium text-gray-200">
            数字から読む改善コラム
          </span>
          <span className="text-xs text-gray-500">
            ({data.month}月{data.today}日時点)
          </span>
          <span className="text-xs bg-purple-900/50 text-purple-400 px-1.5 py-0.5 rounded">
            {columns.length}件
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3 sm:px-4 pb-4 space-y-3">
          {columns.map((col, idx) => (
            <ColumnCard key={idx} item={col} />
          ))}
        </div>
      )}
    </div>
  )
}

function ColumnCard({ item }: { item: ColumnItem }) {
  const borderColor = item.priority === 'high'
    ? 'border-l-red-500'
    : item.priority === 'medium'
    ? 'border-l-yellow-500'
    : 'border-l-blue-500'

  return (
    <div className={`bg-gray-900/50 rounded-lg p-3 border-l-2 ${borderColor}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] bg-purple-900/40 text-purple-300 px-1.5 py-0.5 rounded">
          {item.category}
        </span>
        <span className="text-[10px] text-gray-500">{item.metric}</span>
      </div>
      <p className="text-sm font-medium text-gray-200 mb-1">{item.title}</p>
      <p className="text-xs text-gray-400 leading-relaxed">{item.body}</p>
    </div>
  )
}

function generateColumns(data: DashboardData): ColumnItem[] {
  const cols: ColumnItem[] = []
  const fd = data.forecastDetail
  const target = data.monthlyTarget
  const remaining = data.daysInMonth - data.today
  const staffDetail = data.staffDetail ?? []

  // ── 1. 売上ペースと目標の関係性分析 ─────────────────────────────────
  if (target && target > 0 && fd) {
    const achieveRate = (fd.standard / target) * 100
    const dailyAvg = fd.rationale.dailyAvg

    if (achieveRate >= 100) {
      cols.push({
        category: '売上',
        title: `目標達成ペース: 着地${fmtMan(fd.standard)}（達成率${achieveRate.toFixed(0)}%）`,
        body: `日平均${fmtMan(dailyAvg)}のペースで目標を上回る見込み。このタイミングで客単価UP施策（トリートメント追加提案）に注力し、超過達成を狙う。上振れ分は来月の貯金になる。`,
        metric: `日平均${fmtMan(dailyAvg)} / 残り${remaining}日`,
        priority: 'low',
      })
    } else if (achieveRate >= 90) {
      const gap = target - fd.standard
      cols.push({
        category: '売上',
        title: `あと${fmtMan(gap)}で目標達成 — 射程圏内`,
        body: `残り${remaining}日で日平均${fmtMan(Math.round((target - data.totalSales) / Math.max(remaining, 1)))}を確保すれば達成。週末の予約枠最大化とLINEクーポン配信で空き枠を埋める。全スタッフにオプション1品追加を徹底。`,
        metric: `達成率${achieveRate.toFixed(0)}% / 不足${fmtMan(gap)}`,
        priority: 'medium',
      })
    }
  }

  // ── 2. スタッフパフォーマンス分析 ───────────────────────────────────
  if (staffDetail.length >= 3) {
    const upCount = staffDetail.filter(s => s.trend === 'up').length
    const downCount = staffDetail.filter(s => s.trend === 'down').length
    const avgPredicted = staffDetail.reduce((s, d) => s + d.predictedSales, 0) / staffDetail.length

    // 上位3名と下位3名の格差
    const top3 = staffDetail.slice(0, 3)
    const bottom3 = staffDetail.slice(-3)
    const top3Avg = top3.reduce((s, d) => s + d.predictedSales, 0) / 3
    const bottom3Avg = bottom3.reduce((s, d) => s + d.predictedSales, 0) / 3

    if (top3Avg > 0 && bottom3Avg > 0 && top3Avg / bottom3Avg > 3) {
      cols.push({
        category: 'スタッフ',
        title: `上位・下位の格差${(top3Avg / bottom3Avg).toFixed(1)}倍 — ノウハウ共有が急務`,
        body: `上位3名平均${fmtMan(Math.round(top3Avg))} vs 下位3名平均${fmtMan(Math.round(bottom3Avg))}。トップの施術フロー・カウンセリング手法を動画化し、週次の朝礼で共有。下位スタッフにはペア施術での学習機会を。月次1on1で個人目標設定を。`,
        metric: `TOP3平均${fmtMan(Math.round(top3Avg))} / BOTTOM3平均${fmtMan(Math.round(bottom3Avg))}`,
        priority: 'high',
      })
    }

    if (downCount >= 3) {
      const declining = staffDetail.filter(s => s.trend === 'down')
      const names = declining.slice(0, 3).map(s => s.staff).join('、')
      cols.push({
        category: 'スタッフ',
        title: `${downCount}名が前月比マイナス — 個別テコ入れ必要`,
        body: `${names}${downCount > 3 ? `他${downCount - 3}名` : ''}が前月比ダウン。個別面談で原因をヒアリング（客離れ・モチベーション・技術）。アシスタントとのペア営業、先輩のカウンセリング同席で支援体制を。`,
        metric: `下降${downCount}名 / 上昇${upCount}名`,
        priority: 'high',
      })
    }

    if (upCount >= staffDetail.length * 0.6) {
      cols.push({
        category: 'スタッフ',
        title: `${upCount}名が上昇トレンド — チーム全体が好調`,
        body: `${staffDetail.length}名中${upCount}名が前月比プラス。この好調を活かしてチーム全体での次回予約確保率を高め、来月以降の安定成長につなげる。好調なスタッフの取り組みを全体共有。`,
        metric: `上昇${upCount}名 / ${staffDetail.length}名中`,
        priority: 'low',
      })
    }
  }

  // ── 3. 客単価 × 客数の掛け合わせコラム ─────────────────────────────
  if (data.avgSpend > 0 && data.totalCustomers > 0) {
    const daysPassed = Math.max(data.today, 1)
    const projCust = Math.round((data.totalCustomers / daysPassed) * data.daysInMonth)

    if (data.avgSpend >= 10000) {
      cols.push({
        category: '客単価',
        title: `客単価${fmtYen(data.avgSpend)} — 高水準を維持`,
        body: `客単価は良好。次のステップとして${projCust < 500 ? '客数の底上げ（ホットペッパー掲載順位の見直し、Instagram広告の活用）が優先。席の稼働率を確認し、空き枠を可視化する' : '顧客LTV向上（次回予約率・来店サイクル短縮）に注力。ビューティーメリットのプッシュ通知で定期来店を促進'}。`,
        metric: `客単価${fmtYen(data.avgSpend)} / 客数着地${projCust}人`,
        priority: 'low',
      })
    } else if (data.avgSpend < 7000) {
      cols.push({
        category: '客単価',
        title: `客単価${fmtYen(data.avgSpend)} — 単価UP余地あり`,
        body: `カット単品の比率が高い可能性。カラー+トリートメントのセットメニュー導入、スタッフのアップセルトーク研修を実施。会計時のトリートメント追加提案を仕組み化し、セット率を週次で追跡。`,
        metric: `客単価${fmtYen(data.avgSpend)} / 目安¥8,000以上`,
        priority: 'medium',
      })
    }
  }

  // ── 4. 集客チャネル分析 ─────────────────────────────────────────────
  const nomRate = parseFloat(data.nominationRate)
  const newRate = parseFloat(data.newCustomerRate)
  const appRate = parseFloat(data.appMemberRate)

  if (!isNaN(newRate) && !isNaN(nomRate)) {
    if (newRate < 10) {
      cols.push({
        category: '集客',
        title: `新規率${newRate.toFixed(1)}% — 新規流入テコ入れが必要`,
        body: `ホットペッパーのアクセス数・予約転換率を確認。写真更新を週1回以上に。Instagramリール投稿をスタッフ交代制で毎日実施し、プロフィールリンクからの予約導線を確保。口コミ投稿キャンペーンの実施も有効。`,
        metric: `新規率${newRate.toFixed(1)}% / 新規${data.newCustomers}人`,
        priority: 'medium',
      })
    }

    if (nomRate > 80) {
      cols.push({
        category: '集客',
        title: `指名率${nomRate.toFixed(1)}% — リピート基盤は盤石`,
        body: `高い指名率は強み。この基盤を活かし、指名客への次回予約確保率を高める。来店サイクルを30日以内に短縮できれば、同じ客数でも売上は大幅UP。ビューティーメリットのリマインド配信を活用。`,
        metric: `指名率${nomRate.toFixed(1)}% / フリー${data.freeRate}%`,
        priority: 'low',
      })
    }
  }

  // ── 5. アプリ会員・リピート施策 ─────────────────────────────────────
  if (!isNaN(appRate) && appRate < 40) {
    const unregistered = data.totalUsers - data.appMembers
    cols.push({
      category: 'リピート',
      title: `アプリ未登録${unregistered.toLocaleString()}人 — プッシュ施策の土台強化`,
      body: `会員率${appRate.toFixed(1)}%ではクーポン配信・プッシュ通知の効果が限定的。会計時「アプリ登録で次回500円OFF」を全店統一ルールに。レジ横QRコードPOP設置。月間登録数を店舗KPIに追加。`,
      metric: `アプリ会員率${appRate.toFixed(1)}% / 未登録${unregistered.toLocaleString()}人`,
      priority: 'medium',
    })
  }

  if (data.newReturn3mRate !== '—') {
    const returnRate = parseFloat(data.newReturn3mRate)
    if (!isNaN(returnRate) && returnRate < 30) {
      cols.push({
        category: 'リピート',
        title: `新規リターン率${returnRate}% — 新規の7割が離脱`,
        body: `集客コスト回収のためリターン率改善が最優先。翌日サンクスLINE（施術写真+ケアアドバイス）→1週間後フォローDM→3週間後クーポン配信のフローをBMステップ配信で自動化。初回来店時の指名誘導も重要。`,
        metric: `リターン率${returnRate}% / 目安40%以上`,
        priority: 'high',
      })
    }
  }

  // ── 6. 店舗間格差分析 ──────────────────────────────────────────────
  if (data.storeBreakdown.length >= 3) {
    const sorted = [...data.storeBreakdown].sort((a, b) => b.sales - a.sales)
    const top = sorted[0]
    const bottom = sorted[sorted.length - 1]
    const avg = data.storeBreakdown.reduce((s, v) => s + v.sales, 0) / data.storeBreakdown.length

    if (top.sales > bottom.sales * 3 && bottom.sales > 0) {
      cols.push({
        category: '店舗',
        title: `${top.store} vs ${bottom.store}で${(top.sales / bottom.sales).toFixed(1)}倍の格差`,
        body: `${bottom.store}(${fmtMan(bottom.sales)})が全店平均${fmtMan(Math.round(avg))}を大幅に下回る。稼働率（予約枠の埋まり率）を確認。空き枠が多ければ集客施策（エリアクーポン）、埋まっていれば単価UP（メニュー見直し）を優先。`,
        metric: `TOP:${fmtMan(top.sales)} / LOW:${fmtMan(bottom.sales)}`,
        priority: 'high',
      })
    }
  }

  // ── 7. 日別トレンドからの改善提案 ──────────────────────────────────
  if (data.dailyData.length >= 6) {
    const half = Math.floor(data.dailyData.length / 2)
    const firstHalf = data.dailyData.slice(0, half)
    const secondHalf = data.dailyData.slice(half)
    const firstAvg = firstHalf.reduce((s, d) => s + d.sales, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((s, d) => s + d.sales, 0) / secondHalf.length

    if (secondAvg > firstAvg * 1.15) {
      const upPct = Math.round(((secondAvg - firstAvg) / firstAvg) * 100)
      cols.push({
        category: 'トレンド',
        title: `後半加速: 日売上が前半比+${upPct}%`,
        body: `後半にかけて売上ペースが上昇中。この勢いを月末まで維持するため、残り${remaining}日の予約状況を確認し、空き枠へのプッシュ配信を強化。スタッフのモチベーション維持も重要。`,
        metric: `前半平均${fmtMan(Math.round(firstAvg))}/日 → 後半${fmtMan(Math.round(secondAvg))}/日`,
        priority: 'low',
      })
    }
  }

  // 優先度順
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  cols.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return cols
}

function fmtYen(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}億`
  if (v >= 10_000) return `¥${Math.round(v / 10_000).toLocaleString()}万`
  return `¥${v.toLocaleString()}`
}

function fmtMan(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}億`
  if (v >= 10_000) return `${Math.round(v / 10_000).toLocaleString()}万`
  return `¥${v.toLocaleString()}`
}
