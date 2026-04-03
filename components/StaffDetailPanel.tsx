'use client'

import { useState } from 'react'
import type { StaffDetailItem } from '@/lib/types'

type Props = {
  staffDetail: StaffDetailItem[]
  today: number
  daysInMonth: number
  month: number
}

export default function StaffDetailPanel({ staffDetail, today, daysInMonth, month }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [showAll, setShowAll] = useState(false)

  if (staffDetail.length === 0) return null

  const display = showAll ? staffDetail : staffDetail.slice(0, 10)

  // 全体の平均売上
  const avgSales = staffDetail.reduce((s, d) => s + d.currentSales, 0) / staffDetail.length
  const avgPredicted = staffDetail.reduce((s, d) => s + d.predictedSales, 0) / staffDetail.length

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-sm font-medium text-gray-200">
            メンバー別パフォーマンス
          </span>
          <span className="text-xs text-gray-500">
            ({month}月{today}日時点 / {staffDetail.length}名)
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
        <div className="px-3 sm:px-4 pb-4 space-y-2">
          {/* サマリー */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-gray-900/50 rounded-lg p-2 sm:p-3">
              <p className="text-[10px] text-gray-400">平均売上（現時点）</p>
              <p className="text-sm font-bold text-white">{fmtYen(Math.round(avgSales))}</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-2 sm:p-3">
              <p className="text-[10px] text-gray-400">平均着地予測</p>
              <p className="text-sm font-bold text-cyan-400">{fmtYen(Math.round(avgPredicted))}</p>
            </div>
          </div>

          {/* スタッフカード */}
          {display.map((s) => (
            <StaffCard
              key={s.staff}
              item={s}
              avgSales={avgSales}
              avgPredicted={avgPredicted}
              today={today}
              daysInMonth={daysInMonth}
            />
          ))}

          {!showAll && staffDetail.length > 10 && (
            <button
              onClick={() => setShowAll(true)}
              className="text-blue-400 text-xs text-center w-full pt-2 hover:text-blue-300"
            >
              全{staffDetail.length}名を表示
            </button>
          )}
          {showAll && staffDetail.length > 10 && (
            <button
              onClick={() => setShowAll(false)}
              className="text-gray-500 text-xs text-center w-full pt-2 hover:text-gray-400"
            >
              折りたたむ
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function StaffCard({
  item,
  avgSales,
  avgPredicted,
  today,
  daysInMonth,
}: {
  item: StaffDetailItem
  avgSales: number
  avgPredicted: number
  today: number
  daysInMonth: number
}) {
  const s = item
  const isAboveAvg = s.predictedSales >= avgPredicted
  const improvement = getStaffImprovement(s, avgSales, avgPredicted, today, daysInMonth)

  return (
    <div className={`rounded-lg p-3 border ${
      s.trend === 'up'
        ? 'bg-emerald-950/20 border-emerald-800/30'
        : s.trend === 'down'
        ? 'bg-red-950/20 border-red-800/30'
        : 'bg-gray-900/40 border-gray-700/30'
    }`}>
      {/* ヘッダー: 名前 + ランク + 店舗 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
            s.rank <= 3 ? 'bg-yellow-600/30 text-yellow-400' : 'bg-gray-700 text-gray-400'
          }`}>
            {s.rank}
          </span>
          <span className="text-sm font-medium text-white truncate">{s.staff}</span>
          {s.store && (
            <span className="text-[10px] text-gray-500 truncate hidden sm:inline">{s.store}</span>
          )}
        </div>
        <TrendBadge trend={s.trend} growthRate={s.growthRate} />
      </div>

      {/* 数値グリッド */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-2">
        <div className="text-center">
          <p className="text-[10px] text-gray-500">今月売上</p>
          <p className="text-xs sm:text-sm font-bold text-white">{fmtMan(s.currentSales)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-gray-500">着地予測</p>
          <p className={`text-xs sm:text-sm font-bold ${isAboveAvg ? 'text-cyan-400' : 'text-orange-400'}`}>
            {fmtMan(s.predictedSales)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-gray-500">前月実績</p>
          <p className="text-xs sm:text-sm font-bold text-gray-300">
            {s.prevMonthSales > 0 ? fmtMan(s.prevMonthSales) : '-'}
          </p>
        </div>
      </div>

      {/* ミニ棒グラフ: 3ヶ月トレンド */}
      {(s.prev2MonthSales > 0 || s.prevMonthSales > 0) && (
        <MiniTrendBar
          prev2={s.prev2MonthSales}
          prev={s.prevMonthSales}
          current={s.predictedSales}
        />
      )}

      {/* 改善ポイント */}
      {improvement && (
        <div className="mt-2 bg-gray-800/60 rounded px-2 py-1.5">
          <p className="text-[11px] text-gray-300 leading-relaxed">
            <span className="text-gray-500 mr-1">&rarr;</span>
            {improvement}
          </p>
        </div>
      )}
    </div>
  )
}

function TrendBadge({ trend, growthRate }: { trend: 'up' | 'down' | 'stable'; growthRate: number | null }) {
  if (growthRate === null) return null

  const color = trend === 'up'
    ? 'text-emerald-400 bg-emerald-900/40'
    : trend === 'down'
    ? 'text-red-400 bg-red-900/40'
    : 'text-gray-400 bg-gray-700/40'

  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${color}`}>
      {trend === 'up' ? '+' : ''}{growthRate.toFixed(1)}%
    </span>
  )
}

function MiniTrendBar({ prev2, prev, current }: { prev2: number; prev: number; current: number }) {
  const maxVal = Math.max(prev2, prev, current, 1)
  const values = [
    { label: '2M前', value: prev2 },
    { label: '前月', value: prev },
    { label: '予測', value: current },
  ].filter(v => v.value > 0)

  return (
    <div className="flex items-end gap-1 h-6 mt-1">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className={`w-full rounded-sm ${
              i === values.length - 1 ? 'bg-cyan-500/60' : 'bg-gray-600/60'
            }`}
            style={{ height: `${Math.max((v.value / maxVal) * 20, 2)}px` }}
          />
          <span className="text-[8px] text-gray-600">{v.label}</span>
        </div>
      ))}
    </div>
  )
}

function getStaffImprovement(
  s: StaffDetailItem,
  avgSales: number,
  avgPredicted: number,
  today: number,
  daysInMonth: number,
): string | null {
  const remaining = daysInMonth - today

  // 3ヶ月連続下降
  if (s.prev2MonthSales > 0 && s.prevMonthSales > 0 &&
      s.prevMonthSales < s.prev2MonthSales && s.predictedSales < s.prevMonthSales) {
    return `3ヶ月連続で売上減少中。カウンセリング内容の見直しとオプション提案率の改善が必要。店長との1on1で課題をヒアリング`
  }

  // 前月比大幅ダウン
  if (s.growthRate !== null && s.growthRate < -20) {
    const diff = s.prevMonthSales - s.predictedSales
    return `前月比${Math.abs(s.growthRate).toFixed(0)}%ダウン（${fmtMan(diff)}減）。指名客の離脱がないか確認。フォローDMの送信状況をチェック`
  }

  // 平均以下で低迷
  if (s.predictedSales < avgPredicted * 0.6 && s.prevMonthSales > 0) {
    return `着地予測が全体平均の${Math.round((s.predictedSales / avgPredicted) * 100)}%。フリー客の指名転換・次回予約確保を重点的に`
  }

  // 成長中 → さらに伸ばすアドバイス
  if (s.growthRate !== null && s.growthRate > 20) {
    return `前月比+${s.growthRate.toFixed(0)}%の好調。この勢いでオプションメニュー提案を強化し、客単価UPを狙う`
  }

  // 着地予測が前月超え見込み
  if (s.prevMonthSales > 0 && s.predictedSales > s.prevMonthSales * 1.1) {
    return `前月超えペース。残り${remaining}日のペースを維持し、次回予約の確保で来月も安定させる`
  }

  // 着地予測が前月割れ見込み
  if (s.prevMonthSales > 0 && s.predictedSales < s.prevMonthSales * 0.9) {
    const dailyNeeded = remaining > 0
      ? Math.round((s.prevMonthSales - s.currentSales) / remaining)
      : 0
    if (dailyNeeded > 0) {
      return `前月実績には日平均${fmtMan(dailyNeeded)}が必要。空き枠へのLINEプッシュと既存客フォローで稼働率UP`
    }
  }

  return null
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
