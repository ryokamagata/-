'use client'

import { useEffect, useState } from 'react'

type DecompositionRow = {
  month: string
  sales: number
  customers: number
  unitPrice: number
  priceEffect: number | null
  volumeEffect: number | null
}

type DowRow = {
  dow: number
  label: string
  days: number
  avgSales: number
  avgCustomers: number
  avgUnitPrice: number
}

type TargetSuggestion = {
  month: number
  suggested: number
  existing: number | null
  rationale: string[]
  basis: {
    prevYear: number | null
    yoyRate: number | null
    seasonal: number | null
    ceiling: number
  }
}

type AnalysisData = {
  priceVolumeDecomposition: DecompositionRow[]
  storeDecomposition: Record<string, DecompositionRow[]>
  dowSummary: DowRow[]
  dowByStore: Record<string, DowRow[]>
  targetSuggestions: TargetSuggestion[]
  suggestedAnnualTotal: number
  existingAnnualTarget: number | null
  realisticCeiling: number
  totalSeats: number
}

type SubTab = 'decomposition' | 'dow' | 'target'

function formatMan(n: number): string {
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(2)}億`
  return `${Math.round(n / 10_000).toLocaleString()}万`
}

function formatYen(n: number): string {
  return `¥${n.toLocaleString()}`
}

function shortenStoreName(name: string): string {
  return name
    .replace(/^AI\s*TOKYO\s*/i, '')
    .replace(/^AITOKYO\s*\+?\s*/i, '')
    .replace(/^ams by AI\s*TOKYO\s*/i, 'ams ')
    .replace("men's ", '')
    .replace(' men', '')
    .trim()
}

export default function AnalysisView() {
  const [data, setData] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState<SubTab>('decomposition')
  const [selectedStore, setSelectedStore] = useState<string>('all')

  useEffect(() => {
    fetch('/api/analysis')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-gray-400 text-sm text-center py-8">分析データ読み込み中...</div>
  if (!data) return <div className="text-red-400 text-sm text-center py-8">データ取得に失敗しました</div>

  return (
    <div className="space-y-4">
      {/* サブタブ */}
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
        {([
          ['decomposition', '客単価×客数'],
          ['dow', '曜日別パターン'],
          ['target', '目標サジェスト'],
        ] as [SubTab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`flex-1 text-xs sm:text-sm py-2 px-2 sm:px-4 rounded-md transition-colors font-medium ${
              subTab === key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === 'decomposition' && (
        <DecompositionPanel data={data} selectedStore={selectedStore} onStoreChange={setSelectedStore} />
      )}
      {subTab === 'dow' && (
        <DowPanel data={data} selectedStore={selectedStore} onStoreChange={setSelectedStore} />
      )}
      {subTab === 'target' && (
        <TargetSuggestPanel data={data} />
      )}
    </div>
  )
}

// ─── 客単価×客数 分解パネル ──────────────────────────────────────────

function DecompositionPanel({
  data, selectedStore, onStoreChange,
}: {
  data: AnalysisData
  selectedStore: string
  onStoreChange: (s: string) => void
}) {
  const rows = selectedStore === 'all'
    ? data.priceVolumeDecomposition
    : data.storeDecomposition[selectedStore] ?? []

  const stores = Object.keys(data.storeDecomposition)

  return (
    <div className="space-y-3">
      {/* 店舗セレクタ */}
      <div className="bg-gray-800 rounded-xl p-4">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onStoreChange('all')}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
              selectedStore === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            全店舗合計
          </button>
          {stores.map(store => (
            <button
              key={store}
              onClick={() => onStoreChange(store)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                selectedStore === store ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {shortenStoreName(store)}
            </button>
          ))}
        </div>
      </div>

      {/* 分解テーブル */}
      <div className="bg-gray-800 rounded-xl p-3 sm:p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">
          売上変動の分解分析（客単価要因 vs 客数要因）
        </h3>
        {rows.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">データがありません</p>
        ) : (
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-700">
                  <th className="text-left py-2 px-1">月</th>
                  <th className="text-right py-2 px-1">売上</th>
                  <th className="text-right py-2 px-1">客数</th>
                  <th className="text-right py-2 px-1">客単価</th>
                  <th className="text-right py-2 px-1">単価効果</th>
                  <th className="text-right py-2 px-1">客数効果</th>
                  <th className="py-2 px-1 w-24">内訳</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const total = (r.priceEffect !== null && r.volumeEffect !== null)
                    ? Math.abs(r.priceEffect) + Math.abs(r.volumeEffect)
                    : 0
                  const pricePct = total > 0 && r.priceEffect !== null
                    ? (r.priceEffect / total) * 100
                    : 0
                  const volumePct = total > 0 && r.volumeEffect !== null
                    ? (r.volumeEffect / total) * 100
                    : 0

                  return (
                    <tr key={r.month} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="py-1.5 px-1 text-gray-300 font-medium">
                        {r.month.replace(/^\d{4}-/, '').replace(/^0/, '')}月
                      </td>
                      <td className="py-1.5 px-1 text-right text-white font-bold">{formatMan(r.sales)}</td>
                      <td className="py-1.5 px-1 text-right text-gray-400">{r.customers.toLocaleString()}人</td>
                      <td className="py-1.5 px-1 text-right text-gray-300">{formatYen(r.unitPrice)}</td>
                      <td className="py-1.5 px-1 text-right">
                        {r.priceEffect !== null ? (
                          <span className={r.priceEffect >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {r.priceEffect >= 0 ? '+' : ''}{formatMan(r.priceEffect)}
                          </span>
                        ) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="py-1.5 px-1 text-right">
                        {r.volumeEffect !== null ? (
                          <span className={r.volumeEffect >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {r.volumeEffect >= 0 ? '+' : ''}{formatMan(r.volumeEffect)}
                          </span>
                        ) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="py-1.5 px-1">
                        {total > 0 ? (
                          <div className="flex h-3 rounded-full overflow-hidden bg-gray-700">
                            <div
                              className={`${r.priceEffect! >= 0 ? 'bg-purple-500' : 'bg-purple-800'}`}
                              style={{ width: `${Math.abs(pricePct)}%` }}
                              title={`単価 ${pricePct >= 0 ? '+' : ''}${pricePct.toFixed(0)}%`}
                            />
                            <div
                              className={`${r.volumeEffect! >= 0 ? 'bg-cyan-500' : 'bg-cyan-800'}`}
                              style={{ width: `${Math.abs(volumePct)}%` }}
                              title={`客数 ${volumePct >= 0 ? '+' : ''}${volumePct.toFixed(0)}%`}
                            />
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="flex gap-4 mt-2 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-purple-500 inline-block" /> 客単価要因</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-cyan-500 inline-block" /> 客数要因</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 曜日別パターン ──────────────────────────────────────────────────

function DowPanel({
  data, selectedStore, onStoreChange,
}: {
  data: AnalysisData
  selectedStore: string
  onStoreChange: (s: string) => void
}) {
  const rows = selectedStore === 'all'
    ? data.dowSummary
    : data.dowByStore[selectedStore] ?? []

  const stores = Object.keys(data.dowByStore)
  const maxSales = rows.length > 0 ? Math.max(...rows.map(r => r.avgSales)) : 0
  const DOW_COLORS = ['text-red-400', 'text-gray-300', 'text-gray-300', 'text-gray-300', 'text-gray-300', 'text-gray-300', 'text-blue-400']

  return (
    <div className="space-y-3">
      {/* 店舗セレクタ */}
      <div className="bg-gray-800 rounded-xl p-4">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onStoreChange('all')}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
              selectedStore === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            全店舗合計
          </button>
          {stores.map(store => (
            <button
              key={store}
              onClick={() => onStoreChange(store)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                selectedStore === store ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {shortenStoreName(store)}
            </button>
          ))}
        </div>
      </div>

      {/* 曜日別テーブル */}
      <div className="bg-gray-800 rounded-xl p-3 sm:p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-1">曜日別 平均売上・客数（直近3ヶ月）</h3>
        <p className="text-[10px] text-gray-500 mb-3">1日あたりの平均値</p>
        {rows.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">データがありません</p>
        ) : (
          <>
            {/* バーチャート */}
            <div className="grid grid-cols-7 gap-1 mb-4">
              {rows.map(r => {
                const pct = maxSales > 0 ? (r.avgSales / maxSales) * 100 : 0
                return (
                  <div key={r.dow} className="flex flex-col items-center">
                    <div className="w-full h-24 flex items-end justify-center">
                      <div
                        className={`w-full max-w-[32px] rounded-t ${
                          r.dow === 0 ? 'bg-red-500/70' : r.dow === 6 ? 'bg-blue-500/70' : 'bg-gray-500/70'
                        }`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold mt-1 ${DOW_COLORS[r.dow]}`}>{r.label}</span>
                    <span className="text-[10px] text-gray-400">{formatMan(r.avgSales)}</span>
                  </div>
                )
              })}
            </div>

            {/* 詳細テーブル */}
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-700">
                  <th className="text-left py-2 px-1">曜日</th>
                  <th className="text-right py-2 px-1">平均売上</th>
                  <th className="text-right py-2 px-1">平均客数</th>
                  <th className="text-right py-2 px-1">客単価</th>
                  <th className="text-right py-2 px-1">サンプル日数</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.dow} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className={`py-1.5 px-1 font-bold ${DOW_COLORS[r.dow]}`}>{r.label}</td>
                    <td className="py-1.5 px-1 text-right text-white font-bold">{formatMan(r.avgSales)}</td>
                    <td className="py-1.5 px-1 text-right text-gray-400">{Math.round(r.avgCustomers)}人</td>
                    <td className="py-1.5 px-1 text-right text-gray-300">{formatYen(r.avgUnitPrice)}</td>
                    <td className="py-1.5 px-1 text-right text-gray-500">{r.days}日</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 曜日間の差分サマリー */}
            {rows.length >= 2 && (() => {
              const sorted = [...rows].sort((a, b) => b.avgSales - a.avgSales)
              const best = sorted[0]
              const worst = sorted[sorted.length - 1]
              const gap = best.avgSales - worst.avgSales
              return (
                <div className="mt-3 bg-gray-700/30 rounded-lg p-3 text-xs">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-gray-400">最高:</span>
                    <span className={`font-bold ${DOW_COLORS[best.dow]}`}>{best.label}曜</span>
                    <span className="text-white font-bold">{formatMan(best.avgSales)}</span>
                    <span className="text-gray-600">|</span>
                    <span className="text-gray-400">最低:</span>
                    <span className={`font-bold ${DOW_COLORS[worst.dow]}`}>{worst.label}曜</span>
                    <span className="text-white font-bold">{formatMan(worst.avgSales)}</span>
                    <span className="text-gray-600">|</span>
                    <span className="text-gray-400">差:</span>
                    <span className="text-yellow-400 font-bold">{formatMan(gap)}</span>
                  </div>
                </div>
              )
            })()}
          </>
        )}
      </div>
    </div>
  )
}

// ─── 目標サジェスト ──────────────────────────────────────────────────

function TargetSuggestPanel({ data }: { data: AnalysisData }) {
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)

  const applyAll = async () => {
    setApplying(true)
    try {
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
      const year = now.getFullYear()
      const targets: Record<number, number> = {}
      for (const s of data.targetSuggestions) {
        targets[s.month] = s.suggested
      }
      await fetch('/api/monthly-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, targets }),
      })
      setApplied(true)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* サマリー */}
      <div className="bg-gray-800 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-gray-300">目標自動サジェスト</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">
              席数{data.totalSeats}席 / 稼働上限 {formatMan(data.realisticCeiling)}/月 / 前年実績+成長率+季節変動で算出
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] text-gray-500">提案年間合計</div>
              <div className="text-lg font-bold text-cyan-400">{formatMan(data.suggestedAnnualTotal)}</div>
            </div>
            {data.existingAnnualTarget && (
              <div className="text-right">
                <div className="text-[10px] text-gray-500">現在の目標</div>
                <div className="text-lg font-bold text-gray-300">{formatMan(data.existingAnnualTarget)}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 月別サジェスト */}
      <div className="bg-gray-800 rounded-xl p-3 sm:p-4">
        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700">
                <th className="text-left py-2 px-1">月</th>
                <th className="text-right py-2 px-1">提案目標</th>
                <th className="text-right py-2 px-1">現在目標</th>
                <th className="text-right py-2 px-1">前年実績</th>
                <th className="text-right py-2 px-1 hidden sm:table-cell">季節変動</th>
                <th className="text-left py-2 px-1">根拠</th>
              </tr>
            </thead>
            <tbody>
              {data.targetSuggestions.map(s => {
                const diff = s.existing ? s.suggested - s.existing : null
                return (
                  <tr key={s.month} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-1.5 px-1 text-gray-300 font-bold">{s.month}月</td>
                    <td className="py-1.5 px-1 text-right text-cyan-400 font-bold">{formatMan(s.suggested)}</td>
                    <td className="py-1.5 px-1 text-right">
                      {s.existing ? (
                        <div>
                          <span className="text-gray-300">{formatMan(s.existing)}</span>
                          {diff !== null && (
                            <span className={`ml-1 text-[10px] ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {diff >= 0 ? '+' : ''}{formatMan(diff)}
                            </span>
                          )}
                        </div>
                      ) : <span className="text-gray-600">未設定</span>}
                    </td>
                    <td className="py-1.5 px-1 text-right text-gray-400">
                      {s.basis.prevYear ? formatMan(s.basis.prevYear) : '—'}
                    </td>
                    <td className="py-1.5 px-1 text-right hidden sm:table-cell">
                      {s.basis.seasonal !== null ? (
                        <span className={s.basis.seasonal >= 1 ? 'text-green-400' : 'text-orange-400'}>
                          {(s.basis.seasonal * 100).toFixed(0)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-1.5 px-1">
                      <div className="flex flex-col gap-0.5">
                        {s.rationale.map((r, i) => (
                          <span key={i} className="text-[10px] text-gray-500">{r}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* 一括適用ボタン */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={applyAll}
            disabled={applying || applied}
            className={`text-xs px-4 py-2 rounded-lg font-medium transition-colors ${
              applied
                ? 'bg-green-700 text-green-200 cursor-default'
                : applying
                ? 'bg-gray-600 text-gray-400 cursor-wait'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white'
            }`}
          >
            {applied ? '適用済み' : applying ? '適用中...' : '提案をすべて目標に適用'}
          </button>
        </div>
      </div>

      {/* 計算根拠の説明 */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h4 className="text-xs font-medium text-gray-400 mb-2">計算ロジック</h4>
        <div className="text-[10px] text-gray-500 space-y-1">
          <p>1. ベース = 前年同月売上 × (1 + YoY平均成長率{data.targetSuggestions[0]?.basis.yoyRate != null ? ` ${data.targetSuggestions[0].basis.yoyRate}%` : ''})</p>
          <p>2. 季節変動指数で補正（前年の月別売上÷平均から算出）</p>
          <p>3. 席数上限チェック（{data.totalSeats}席 × 120万/席 × 稼働85% = {formatMan(data.realisticCeiling)}）</p>
          <p>4. 攻めの目標として+8%上乗せ</p>
        </div>
      </div>
    </div>
  )
}
