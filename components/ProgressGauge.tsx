'use client'

export default function ProgressGauge({
  actual,
  target,
  forecast,
}: {
  actual: number
  target: number
  forecast: number
}) {
  const actualPct = Math.min((actual / target) * 100, 100)
  const forecastPct = Math.min((forecast / target) * 100, 100)

  const getColor = (pct: number) => {
    if (pct >= 100) return 'bg-green-500'
    if (pct >= 80) return 'bg-blue-500'
    if (pct >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-3">
      {/* 実績 */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
          <span>実績達成率</span>
          <span className="font-semibold text-white">{actualPct.toFixed(1)}%</span>
        </div>
        <div className="h-5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${getColor(actualPct)}`}
            style={{ width: `${actualPct}%` }}
          />
        </div>
      </div>

      {/* 予測 */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
          <span>予測達成率（月末見込み）</span>
          <span className="font-semibold text-white">{forecastPct.toFixed(1)}%</span>
        </div>
        <div className="h-5 bg-gray-700 rounded-full overflow-hidden relative">
          {/* 実績部分 */}
          <div
            className={`h-full rounded-l-full absolute left-0 ${getColor(actualPct)}`}
            style={{ width: `${actualPct}%` }}
          />
          {/* 予測上乗せ部分（薄い色） */}
          {forecastPct > actualPct && (
            <div
              className="h-full absolute bg-blue-400 opacity-40"
              style={{ left: `${actualPct}%`, width: `${forecastPct - actualPct}%` }}
            />
          )}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>¥{actual.toLocaleString()} 実績</span>
          <span>¥{forecast.toLocaleString()} 予測</span>
          <span>目標 ¥{target.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}
