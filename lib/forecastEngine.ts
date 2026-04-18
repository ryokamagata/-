import type { DailySales, ForecastResult } from './types'
import { getHolidayMap } from './holidays'

export function computeForecast(
  dailySales: DailySales[],
  year: number,
  month: number,
  today: number
): ForecastResult {
  const daysInMonth = new Date(year, month, 0).getDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  const monthStart = `${year}-${pad(month)}-01`
  const monthEnd = `${year}-${pad(month)}-${pad(daysInMonth)}`
  const holidays = getHolidayMap(monthStart, monthEnd)

  const isWeekendOrHoliday = (dateStr: string, dow: number): boolean =>
    dow === 0 || dow === 6 || holidays[dateStr] !== undefined

  // Step 1: 平日 / 土日祝 に分類して実績を集計（ゼロ売上の日は除外）
  const weekdayAmounts: number[] = []
  const weekendAmounts: number[] = []
  for (const day of dailySales) {
    if (day.totalAmount <= 0) continue
    const dow = new Date(day.date + 'T00:00:00').getDay()
    if (isWeekendOrHoliday(day.date, dow)) {
      weekendAmounts.push(day.totalAmount)
    } else {
      weekdayAmounts.push(day.totalAmount)
    }
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round(arr.reduce((s, a) => s + a, 0) / arr.length) : 0

  const weekdayAverage = avg(weekdayAmounts)
  const weekendAverage = avg(weekendAmounts)

  // Step 2: 月内の平日/土日祝の総日数
  let weekdayCount = 0
  let weekendCount = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${pad(month)}-${pad(d)}`
    const dow = new Date(year, month - 1, d).getDay()
    if (isWeekendOrHoliday(dateStr, dow)) weekendCount++
    else weekdayCount++
  }

  const weekdayActualDays = weekdayAmounts.length
  const weekendActualDays = weekendAmounts.length

  // Step 3: データなしフォールバック
  if (weekdayAverage === 0 && weekendAverage === 0) {
    return {
      actualTotal: 0,
      projectedTotal: 0,
      forecastTotal: 0,
      confidence: 'low',
      dailyProjections: [],
      weekdayAverage: 0,
      weekendAverage: 0,
      weekdayCount,
      weekendCount,
      weekdayActualDays: 0,
      weekendActualDays: 0,
    }
  }

  // 片側しかデータがない場合は、もう片方にも同じ平均を使ってフォールバック
  const effectiveWeekdayAvg = weekdayAverage > 0 ? weekdayAverage : weekendAverage
  const effectiveWeekendAvg = weekendAverage > 0 ? weekendAverage : weekdayAverage

  // Step 4: 実績に無い日を平日/土日祝の平均で予測
  // today が DB にまだ無くても projection に含まれるので、締日直後のスクレイプで
  // 実績に繰り上がった瞬間に forecastTotal がズレずに差分だけ反映される。
  const actualTotal = dailySales.reduce((s, d) => s + d.totalAmount, 0)
  const actualDateSet = new Set(dailySales.map((d) => d.date))
  const dailyProjections: { date: string; projected: number }[] = []
  let projectedTotal = 0

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${pad(month)}-${pad(d)}`
    if (actualDateSet.has(dateStr)) continue
    const dow = new Date(year, month - 1, d).getDay()
    const projected = isWeekendOrHoliday(dateStr, dow)
      ? effectiveWeekendAvg
      : effectiveWeekdayAvg
    dailyProjections.push({ date: dateStr, projected })
    projectedTotal += projected
  }

  // Step 5: 予測精度
  const actualDays = weekdayActualDays + weekendActualDays
  const confidence: ForecastResult['confidence'] =
    actualDays >= 15 ? 'high' : actualDays >= 7 ? 'medium' : 'low'

  // today は呼び出し側の整合性のため残しているが、v2 の計算では未使用
  void today

  return {
    actualTotal,
    projectedTotal,
    forecastTotal: actualTotal + projectedTotal,
    confidence,
    dailyProjections,
    weekdayAverage,
    weekendAverage,
    weekdayCount,
    weekendCount,
    weekdayActualDays,
    weekendActualDays,
  }
}
