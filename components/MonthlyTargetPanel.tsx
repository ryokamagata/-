'use client'

import { useCallback, useEffect, useState } from 'react'

type MonthDetail = {
  month: number
  sales: number
  customers: number
  isProjected: boolean
}

type Props = {
  currentYear: number
  monthDetails: MonthDetail[]
  projectedTotal: number
  onRefresh: () => void
}

export default function MonthlyTargetPanel({ currentYear, monthDetails, projectedTotal, onRefresh }: Props) {
  const [open, setOpen] = useState(true)
  const [targets, setTargets] = useState<Record<number, string>>({})
  const [savedTargets, setSavedTargets] = useState<Record<number, number>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchTargets = useCallback(async () => {
    const res = await fetch(`/api/monthly-targets?year=${currentYear}`)
    const data = await res.json()
    if (data.targets) {
      setSavedTargets(data.targets)
      const strs: Record<number, string> = {}
      for (const [m, v] of Object.entries(data.targets)) {
        strs[Number(m)] = (v as number).toLocaleString()
      }
      setTargets(strs)
    }
  }, [currentYear])

  useEffect(() => {
    fetchTargets()
  }, [fetchTargets])

  const handleSave = async () => {
    setSaving(true)
    try {
      const parsed: Record<number, number> = {}
      for (const [m, v] of Object.entries(targets)) {
        const num = parseInt(v.replace(/[,¥\s]/g, ''))
        if (!isNaN(num) && num > 0) parsed[Number(m)] = num
      }
      await fetch('/api/monthly-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: currentYear, targets: parsed }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      fetchTargets()
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  // 計算
  const annualTarget = Object.values(savedTargets).reduce((s, v) => s + v, 0)
  const totalActual = monthDetails.filter(d => !d.isProjected).reduce((s, d) => s + d.sales, 0)
  const annualAchievement = annualTarget > 0 ? (projectedTotal / annualTarget * 100) : null
  const annualDiff = annualTarget > 0 ? projectedTotal - annualTarget : null

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-sm font-medium text-gray-200">
            月別売上目標
          </span>
          <span className="text-xs text-gray-500">({currentYear}年)</span>
          {annualTarget > 0 && (
            <span className="text-xs bg-yellow-900/50 text-yellow-400 px-1.5 py-0.5 rounded">
              年間目標 {formatOkuMan(annualTarget)}
            </span>
          )}
          {annualDiff !== null && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              annualDiff >= 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
            }`}>
              予測 {annualDiff >= 0 ? '+' : ''}{formatOkuMan(annualDiff)}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-3 sm:px-4 pb-4 space-y-4">
          {/* 年間サマリーカード */}
          {annualTarget > 0 && (
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-2 sm:p-3 text-center">
                <p className="text-[10px] text-yellow-400 mb-0.5">年間目標</p>
                <p className="text-xs sm:text-sm font-bold text-yellow-400">{formatOkuMan(annualTarget)}</p>
              </div>
              <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-2 sm:p-3 text-center">
                <p className="text-[10px] text-blue-300 mb-0.5">着地予測</p>
                <p className="text-xs sm:text-sm font-bold text-white">{formatOkuMan(projectedTotal)}</p>
              </div>
              <div className={`border rounded-lg p-2 sm:p-3 text-center ${
                annualAchievement !== null && annualAchievement >= 100
                  ? 'bg-green-900/20 border-green-700/30' : 'bg-red-900/20 border-red-700/30'
              }`}>
                <p className="text-[10px] text-gray-400 mb-0.5">達成見込</p>
                <p className={`text-xs sm:text-sm font-bold ${
                  annualAchievement !== null && annualAchievement >= 100 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {annualAchievement !== null ? `${annualAchievement.toFixed(1)}%` : '—'}
                </p>
              </div>
            </div>
          )}

          {/* 月別テーブル */}
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-700">
                  <th className="text-left py-2 px-1 sm:px-2">月</th>
                  <th className="text-right py-2 px-1 sm:px-2 w-24 sm:w-32">目標</th>
                  <th className="text-right py-2 px-1 sm:px-2">実績/予測</th>
                  <th className="text-right py-2 px-1 sm:px-2">達成率</th>
                  <th className="text-right py-2 px-1 sm:px-2 hidden sm:table-cell">差額</th>
                  <th className="py-2 px-1 w-12 sm:w-20"></th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                  const detail = monthDetails.find(d => d.month === month)
                  const sales = detail?.sales ?? 0
                  const isProjected = detail?.isProjected ?? true
                  const target = savedTargets[month] ?? 0
                  const achievement = target > 0 && sales > 0 ? (sales / target * 100) : null
                  const diff = target > 0 ? sales - target : null
                  const barPct = target > 0 && sales > 0 ? Math.min((sales / target) * 100, 150) : 0

                  return (
                    <tr key={month} className={`border-b border-gray-700/50 ${isProjected ? 'opacity-70' : ''}`}>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-gray-300 font-medium whitespace-nowrap">
                        {month}月
                        {isProjected && sales > 0 && (
                          <span className="text-[10px] text-blue-400 ml-0.5">予</span>
                        )}
                      </td>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-right">
                        <input
                          type="text"
                          value={targets[month] ?? ''}
                          onChange={e => setTargets(prev => ({ ...prev, [month]: e.target.value }))}
                          placeholder="0"
                          className="bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-white text-xs
                                     w-20 sm:w-28 text-right focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                        />
                      </td>
                      <td className={`py-1.5 sm:py-2 px-1 sm:px-2 text-right font-bold whitespace-nowrap ${
                        isProjected ? 'text-blue-300' : 'text-white'
                      }`}>
                        {sales > 0 ? `¥${sales.toLocaleString()}` : '—'}
                      </td>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-right">
                        {achievement !== null ? (
                          <span className={
                            achievement >= 100 ? 'text-green-400' :
                            achievement >= 80 ? 'text-yellow-400' :
                            'text-red-400'
                          }>
                            {achievement.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-right hidden sm:table-cell">
                        {diff !== null && sales > 0 ? (
                          <span className={diff >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {diff >= 0 ? '+' : ''}¥{diff.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2">
                        {target > 0 && sales > 0 && (
                          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                achievement !== null && achievement >= 100 ? 'bg-green-500' :
                                achievement !== null && achievement >= 80 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(barPct, 100)}%` }}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {/* 年間合計行 */}
                <tr className="border-t-2 border-gray-600 font-bold">
                  <td className="py-2 px-1 sm:px-2 text-yellow-400">年間</td>
                  <td className="py-2 px-1 sm:px-2 text-right text-yellow-400 whitespace-nowrap">
                    {annualTarget > 0 ? formatOkuMan(annualTarget) : '—'}
                  </td>
                  <td className="py-2 px-1 sm:px-2 text-right text-white whitespace-nowrap">
                    {formatOkuMan(projectedTotal)}
                  </td>
                  <td className="py-2 px-1 sm:px-2 text-right">
                    {annualAchievement !== null ? (
                      <span className={annualAchievement >= 100 ? 'text-green-400' : 'text-red-400'}>
                        {annualAchievement.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2 px-1 sm:px-2 text-right hidden sm:table-cell">
                    {annualDiff !== null ? (
                      <span className={annualDiff >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {annualDiff >= 0 ? '+' : ''}{formatOkuMan(annualDiff)}
                      </span>
                    ) : '—'}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 保存ボタン */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-xs
                         px-4 py-1.5 rounded transition-colors"
            >
              {saving ? '保存中...' : saved ? '保存済み' : '月別目標を保存'}
            </button>
            <p className="text-[10px] text-gray-500">
              ※ 数値を入力して保存。年間目標はここの合計が自動反映されます
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function formatOkuMan(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  const oku = Math.floor(abs / 100000000)
  const man = Math.round((abs % 100000000) / 10000)
  if (oku > 0 && man > 0) return `${sign}¥${oku}億${man.toLocaleString()}万`
  if (oku > 0) return `${sign}¥${oku}億`
  if (man > 0) return `${sign}¥${man.toLocaleString()}万`
  return '¥0'
}
