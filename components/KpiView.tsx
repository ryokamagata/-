'use client'

import { useCallback, useEffect, useState } from 'react'

type MonthlyProgress = {
  month: number
  actual: number | null
  target: number | null
  autoValue: number | null
  manualValue: number | null
  inputStatus: 'not_entered' | 'no_data' | 'has_value'
  status: 'achieved' | 'on_track' | 'behind' | 'no_data' | 'no_data_entered'
}

type KpiResult = {
  key: string; label: string; unit: string; source: 'auto' | 'manual'
  target: number | null; currentValue: number | null; score: number | null; maxScore: number
  monthlyValues: Record<number, number | null>
  monthlyProgress: MonthlyProgress[]
  monthlyTargets: { month: number; value: number | null }[]
}

type ExecData = {
  id: string; name: string; role: string; description: string
  kpis: KpiResult[]; totalScore: number; maxScore: number; rank: string; reward: string
}

type KpiData = {
  year: number; currentQuarter: number; currentMonth: number; quarterLabel: string
  isQFinal: boolean
  executives: ExecData[]
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  achieved: { bg: 'bg-green-500/20', text: 'text-green-400', label: '達成' },
  on_track: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: '順調' },
  behind: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: '要改善' },
  no_data: { bg: 'bg-gray-700/30', text: 'text-gray-500', label: '未入力' },
  no_data_entered: { bg: 'bg-gray-600/30', text: 'text-gray-400', label: 'データなし' },
}

export default function KpiView() {
  const [data, setData] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedExec, setSelectedExec] = useState<string | null>(null)
  const [editingKpi, setEditingKpi] = useState<{ key: string; month: number; type: 'value' | 'target' } | null>(null)
  const [editValue, setEditValue] = useState('')

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/kpi')
    const d = await res.json()
    setData(d)
    setLoading(false)
    if (!selectedExec && d.executives.length > 0) setSelectedExec(d.executives[0].id)
  }, [selectedExec])

  useEffect(() => { fetchData() }, [fetchData])

  const saveKpi = async (key: string, month: number, value: number, type: 'value' | 'target' = 'value') => {
    if (!data) return
    await fetch('/api/kpi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: data.year, month, key, value, type: type === 'target' ? 'target' : undefined }),
    })
    setEditingKpi(null)
    fetchData()
  }

  const saveNoData = async (key: string, month: number) => {
    if (!data) return
    await fetch('/api/kpi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: data.year, month, key, type: 'no_data' }),
    })
    setEditingKpi(null)
    fetchData()
  }

  if (loading) return <div className="text-gray-400 text-sm text-center py-8">KPIデータ読み込み中...</div>
  if (!data) return <div className="text-red-400 text-sm text-center py-8">データ取得に失敗しました</div>

  const exec = data.executives.find(e => e.id === selectedExec)

  // Q全体の月別入力状況
  const qMonths = exec?.kpis[0]?.monthlyProgress.map(m => m.month) ?? []
  const qMonthIndex = qMonths.indexOf(data.currentMonth)
  const qProgressLabel = qMonthIndex >= 0 ? `${qMonthIndex + 1}ヶ月目 / 3ヶ月中` : ''

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="bg-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-gray-300">責任者別KPI評価</h3>
            <p className="text-[10px] text-gray-500">{data.year}年 {data.quarterLabel} — {qProgressLabel}</p>
          </div>
        </div>

        {/* 責任者カード一覧 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {data.executives.map(e => (
            <button
              key={e.id}
              onClick={() => setSelectedExec(e.id)}
              className={`p-3 rounded-lg border transition-colors text-left ${
                selectedExec === e.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700 bg-gray-700/30 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-white">{e.name}</span>
                {data.isQFinal ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 border border-gray-600 font-bold">
                    {e.rank}
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400">未定</span>
                )}
              </div>
              <div className="text-[10px] text-gray-500">{e.role}</div>
              {data.isQFinal ? (
                <div className="text-xs font-bold text-cyan-400 mt-1">{e.totalScore}/{e.maxScore}点</div>
              ) : (
                <div className="text-[10px] text-gray-500 mt-1">Q末に評価確定</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 選択した責任者の詳細 */}
      {exec && (
        <>
          {/* プロフィール・総合スコア */}
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">{exec.name} {exec.role}</h3>
                  {data.isQFinal ? (
                    <span className="text-sm font-bold px-2 py-0.5 rounded bg-gray-700 text-gray-200 border border-gray-600">
                      {exec.rank}評価
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-700/50 text-gray-400 border border-gray-600">Q末に確定</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">{exec.description}</p>
              </div>
              {data.isQFinal && (
                <div className="text-right">
                  <div className="text-2xl font-bold text-cyan-400">{exec.totalScore}<span className="text-sm text-gray-500">/{exec.maxScore}</span></div>
                  <div className="text-xs text-gray-500">{exec.reward}</div>
                </div>
              )}
            </div>

            {data.isQFinal && (
              <div className="mt-3 h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    exec.totalScore >= 81 ? 'bg-yellow-500' :
                    exec.totalScore >= 71 ? 'bg-green-500' :
                    exec.totalScore >= 61 ? 'bg-blue-500' :
                    exec.totalScore >= 51 ? 'bg-gray-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${(exec.totalScore / exec.maxScore) * 100}%` }}
                />
              </div>
            )}

            {/* 月別達成サマリー（ミニ進捗） */}
            <div className={`${data.isQFinal ? 'mt-3' : 'mt-2'} grid grid-cols-3 gap-2`}>
              {qMonths.map(mo => {
                const monthStatuses = exec.kpis.map(k => {
                  const mp = k.monthlyProgress.find(m => m.month === mo)
                  return mp?.status ?? 'no_data'
                })
                const achieved = monthStatuses.filter(s => s === 'achieved').length
                const total = exec.kpis.length
                const isCurrent = mo === data.currentMonth
                return (
                  <div key={mo} className={`rounded-lg p-2 text-center ${isCurrent ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-gray-700/30'}`}>
                    <div className={`text-xs font-bold ${isCurrent ? 'text-blue-400' : 'text-gray-400'}`}>{mo}月</div>
                    <div className="flex justify-center gap-1 mt-1">
                      {monthStatuses.map((s, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full ${
                          s === 'achieved' ? 'bg-green-400' :
                          s === 'on_track' ? 'bg-blue-400' :
                          s === 'behind' ? 'bg-orange-400' :
                          s === 'no_data_entered' ? 'bg-gray-500' : 'bg-gray-600'
                        }`} />
                      ))}
                    </div>
                    <div className="text-[9px] text-gray-500 mt-0.5">
                      {achieved > 0 ? `${achieved}/${total}達成` : monthStatuses.every(s => s === 'no_data') ? '未入力' : '入力中'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* KPI詳細カード */}
          {exec.kpis.map(kpi => (
            <div key={kpi.key} className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-300">{kpi.label}</h4>
                  <p className="text-[10px] text-gray-500">
                    {kpi.source === 'auto' ? 'BM自動取得（手動上書き可）' : '手動入力'}
                    {kpi.target !== null && ` / Q目標: ${kpi.target.toLocaleString()}${kpi.unit}`}
                  </p>
                </div>
                {data.isQFinal && (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">
                        {kpi.currentValue !== null ? `${kpi.currentValue.toLocaleString()}${kpi.unit}` : '—'}
                      </div>
                      <div className="text-[10px] text-gray-500">Q累計/平均</div>
                    </div>
                    <div className={`text-center min-w-[48px] py-1 px-2 rounded-lg ${
                      kpi.score !== null && kpi.score >= 25 ? 'bg-green-500/20 text-green-400' :
                      kpi.score !== null && kpi.score >= 15 ? 'bg-yellow-500/20 text-yellow-400' :
                      kpi.score !== null ? 'bg-red-500/20 text-red-400' :
                      'bg-gray-700 text-gray-500'
                    }`}>
                      <div className="text-sm font-bold">{kpi.score ?? '—'}</div>
                      <div className="text-[9px]">/{kpi.maxScore}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* 月別進捗テーブル */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700">
                      <th className="text-left py-1.5 px-1">月</th>
                      <th className="text-right py-1.5 px-1">目標</th>
                      <th className="text-right py-1.5 px-1">実績</th>
                      <th className="text-right py-1.5 px-1">達成率</th>
                      <th className="text-center py-1.5 px-1">状態</th>
                      <th className="text-right py-1.5 px-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpi.monthlyProgress.map(mp => {
                      const achieveRate = mp.actual !== null && mp.target !== null && mp.target > 0
                        ? Math.round(mp.actual / mp.target * 100)
                        : null
                      const style = STATUS_STYLES[mp.status] ?? STATUS_STYLES['no_data']
                      const isCurrent = mp.month === data.currentMonth

                      return (
                        <tr key={mp.month} className={`border-b border-gray-700/30 ${isCurrent ? 'bg-blue-500/5' : ''}`}>
                          <td className="py-1.5 px-1">
                            <span className={`font-medium ${isCurrent ? 'text-blue-400' : 'text-gray-400'}`}>
                              {mp.month}月
                            </span>
                            {isCurrent && <span className="text-[8px] text-blue-400 ml-1">今月</span>}
                          </td>
                          <td className="py-1.5 px-1 text-right">
                            {editingKpi?.key === kpi.key && editingKpi?.month === mp.month && editingKpi?.type === 'target' ? (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault()
                                  const v = parseFloat(editValue)
                                  if (!isNaN(v)) saveKpi(kpi.key, mp.month, v, 'target')
                                }}
                                className="flex items-center gap-1 justify-end"
                              >
                                <input
                                  type="number"
                                  step="any"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  className="w-16 bg-gray-700 text-white text-xs px-2 py-1 rounded"
                                  autoFocus
                                />
                                <button type="submit" className="text-green-400 text-[10px]">保存</button>
                                <button type="button" onClick={() => setEditingKpi(null)} className="text-gray-500 text-[10px]">取消</button>
                              </form>
                            ) : (
                              <span
                                className="text-gray-500 cursor-pointer hover:text-gray-300"
                                onClick={() => {
                                  setEditingKpi({ key: kpi.key, month: mp.month, type: 'target' })
                                  setEditValue(mp.target?.toString() ?? '')
                                }}
                                title="クリックで目標を変更"
                              >
                                {mp.target !== null ? `${mp.target.toLocaleString()}${kpi.unit}` : '—'}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-1 text-right">
                            {editingKpi?.key === kpi.key && editingKpi?.month === mp.month && editingKpi?.type === 'value' ? (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault()
                                  const v = parseFloat(editValue)
                                  if (!isNaN(v)) saveKpi(kpi.key, mp.month, v)
                                }}
                                className="flex items-center gap-1 justify-end"
                              >
                                <input
                                  type="number"
                                  step="any"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  className="w-16 bg-gray-700 text-white text-xs px-2 py-1 rounded"
                                  autoFocus
                                />
                                <button type="submit" className="text-green-400 text-[10px]">保存</button>
                                <button
                                  type="button"
                                  onClick={() => saveNoData(kpi.key, mp.month)}
                                  className="text-gray-400 text-[10px] hover:text-gray-200"
                                  title="データなしとして記録"
                                >
                                  なし
                                </button>
                                <button type="button" onClick={() => setEditingKpi(null)} className="text-gray-500 text-[10px]">取消</button>
                              </form>
                            ) : (
                              <span className={
                                mp.inputStatus === 'no_data' ? 'text-gray-500 italic' :
                                mp.actual !== null ? 'text-white font-medium' : 'text-gray-600'
                              }>
                                {mp.inputStatus === 'no_data'
                                  ? 'データなし'
                                  : mp.actual !== null
                                    ? `${mp.actual.toLocaleString()}${kpi.unit}`
                                    : '—'}
                                {mp.autoValue !== null && mp.manualValue !== null && mp.inputStatus === 'has_value' && (
                                  <span className="text-[8px] text-purple-400 ml-0.5">(手動)</span>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-1 text-right">
                            {achieveRate !== null ? (
                              <div className="flex items-center justify-end gap-1">
                                <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      achieveRate >= 100 ? 'bg-green-400' :
                                      achieveRate >= 80 ? 'bg-blue-400' : 'bg-orange-400'
                                    }`}
                                    style={{ width: `${Math.min(achieveRate, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] font-medium ${
                                  achieveRate >= 100 ? 'text-green-400' :
                                  achieveRate >= 80 ? 'text-blue-400' : 'text-orange-400'
                                }`}>{achieveRate}%</span>
                              </div>
                            ) : <span className="text-gray-600 text-[10px]">—</span>}
                          </td>
                          <td className="py-1.5 px-1 text-center">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
                              {style.label}
                            </span>
                          </td>
                          <td className="py-1.5 px-1 text-right">
                            {!(editingKpi?.key === kpi.key && editingKpi?.month === mp.month) && (
                              <button
                                onClick={() => {
                                  setEditingKpi({ key: kpi.key, month: mp.month, type: 'value' })
                                  setEditValue(mp.actual?.toString() ?? mp.autoValue?.toString() ?? '')
                                }}
                                className="text-[10px] text-blue-400 hover:text-blue-300"
                              >
                                編集
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* 評価ランク表 */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h4 className="text-xs font-medium text-gray-400 mb-2">Q最終評価ランク・報酬変動</h4>
            <p className="text-[10px] text-gray-500 mb-2">
              {data.isQFinal
                ? 'Q最終月です。全データが揃い次第、評価が確定します。'
                : `Q末（${qMonths[qMonths.length - 1]}月）に全データが揃った時点で評価が確定します。`}
            </p>
            <div className="grid grid-cols-5 gap-1 text-center text-xs">
              {[
                { min: 81, max: 90, rank: 'S', reward: '+15万', color: 'bg-yellow-500/20 text-yellow-400' },
                { min: 71, max: 80, rank: 'A', reward: '+10万', color: 'bg-green-500/20 text-green-400' },
                { min: 61, max: 70, rank: 'B', reward: '+5万', color: 'bg-blue-500/20 text-blue-400' },
                { min: 51, max: 60, rank: 'C', reward: '±0', color: 'bg-gray-500/20 text-gray-400' },
                { min: 0, max: 50, rank: 'D', reward: '-5万', color: 'bg-red-500/20 text-red-400' },
              ].map(r => (
                <div
                  key={r.rank}
                  className={`py-2 rounded-lg ${r.color} ${data.isQFinal && exec.rank === r.rank ? 'ring-2 ring-white/30' : ''}`}
                >
                  <div className="font-bold text-sm">{r.rank}</div>
                  <div className="text-[9px] opacity-70">{r.min}-{r.max}点</div>
                  <div className="text-[9px] font-medium mt-0.5">{r.reward}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
