import type { DailySales, ForecastResult } from './types'

export function computeForecast(
  dailySales: DailySales[],
  year: number,
  month: number,
  today: number
): ForecastResult {
  const daysInMonth = new Date(year, month, 0).getDate()

  // Step 1: 曜日別グループ化（ゼロ売上の日は除外）
  const dowBuckets: Record<number, number[]> = {
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [],
  }
  for (const day of dailySales) {
    if (day.totalAmount > 0) {
      const dow = new Date(day.date + 'T00:00:00').getDay()
      dowBuckets[dow].push(day.totalAmount)
    }
  }

  // Step 2: 曜日別平均
  const dowAverages: Record<number, number> = {}
  for (let dow = 0; dow <= 6; dow++) {
    const amounts = dowBuckets[dow]
    dowAverages[dow] =
      amounts.length > 0
        ? Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length)
        : 0
  }

  // Step 3: 全曜日が0の場合（データなし）のフォールバック
  const hasData = Object.values(dowAverages).some((v) => v > 0)
  if (!hasData) {
    return {
      actualTotal: 0,
      projectedTotal: 0,
      forecastTotal: 0,
      confidence: 'low',
      dailyProjections: [],
      dowAverages,
    }
  }

  // Step 4: 残り日数の予測
  const actualTotal = dailySales.reduce((s, d) => s + d.totalAmount, 0)
  const dailyProjections: { date: string; projected: number }[] = []
  let projectedTotal = 0

  for (let d = today + 1; d <= daysInMonth; d++) {
    const futureDate = new Date(year, month - 1, d)
    const dow = futureDate.getDay()
    const projected = dowAverages[dow] ?? 0
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    dailyProjections.push({ date: dateStr, projected })
    projectedTotal += projected
  }

  // Step 5: 予測精度
  const actualDays = dailySales.filter((d) => d.totalAmount > 0).length
  const confidence: ForecastResult['confidence'] =
    actualDays >= 15 ? 'high' : actualDays >= 7 ? 'medium' : 'low'

  return {
    actualTotal,
    projectedTotal,
    forecastTotal: actualTotal + projectedTotal,
    confidence,
    dailyProjections,
    dowAverages,
  }
}
