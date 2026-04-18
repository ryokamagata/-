import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import {
  getMonthlyTotalSales,
  getMonthlyStoreSales,
  getDailySales,
  getTarget,
  getSeasonalIndex,
  getStoreOpeningRevenue,
  getScrapedDailySales,
} from '@/lib/db'
import { STORES, MAX_REVENUE_PER_SEAT, isClosedStore } from '@/lib/stores'
import { getHolidayMap } from '@/lib/holidays'
import { CUTOFF_HOUR, CUTOFF_MINUTE } from '@/lib/autoScrape'
import { computeForecast } from '@/lib/forecastEngine'
import type { DailySales } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const calendarToday = now.getDate()
  const hour = now.getHours()
  const minute = now.getMinutes()
  // 20:45締め: ダッシュボードと統一
  const today = (hour > CUTOFF_HOUR || (hour === CUTOFF_HOUR && minute >= CUTOFF_MINUTE)) ? calendarToday : calendarToday - 1
  const db = getDB()

  // ── 1. 顧客リピート分析 ──────────────────────────────────
  const fromYM12 = month === 12 ? year * 100 + 1 : (year - 1) * 100 + (month + 1)
  const toYM = year * 100 + month

  // 月別全店合計の来客分類
  const visitorMonthly = db.prepare(`
    SELECT year, month,
           SUM(nominated) as nominated, SUM(free_visit) as free_visit,
           SUM(new_customers) as new_customers, SUM(revisit) as revisit
    FROM store_monthly_visitors
    WHERE (year * 100 + month) >= ? AND (year * 100 + month) <= ?
    GROUP BY year, month
    ORDER BY year ASC, month ASC
  `).all(fromYM12, toYM) as {
    year: number; month: number; nominated: number; free_visit: number
    new_customers: number; revisit: number
  }[]

  // 店舗別来客分類
  const visitorByStore = db.prepare(`
    SELECT year, month, store,
           nominated, free_visit, new_customers, revisit
    FROM store_monthly_visitors
    WHERE (year * 100 + month) >= ? AND (year * 100 + month) <= ?
    ORDER BY year ASC, month ASC
  `).all(fromYM12, toYM) as {
    year: number; month: number; store: string
    nominated: number; free_visit: number; new_customers: number; revisit: number
  }[]

  // 3ヶ月リピート率推移
  const cycleData = db.prepare(`
    SELECT year, month, store, new_return_3m
    FROM store_monthly_cycle
    WHERE (year * 100 + month) >= ? AND (year * 100 + month) <= ?
    ORDER BY year ASC, month ASC
  `).all(fromYM12, toYM) as {
    year: number; month: number; store: string; new_return_3m: number
  }[]

  // 全店合計の月次指名率・フリー率推移
  const customerRepeatMonthly = visitorMonthly.map(v => {
    const total = v.nominated + v.free_visit + v.new_customers + v.revisit
    return {
      month: `${v.year}-${String(v.month).padStart(2, '0')}`,
      nominated: v.nominated,
      free: v.free_visit,
      newCustomers: v.new_customers,
      revisit: v.revisit,
      total,
      nominationRate: total > 0 ? Math.round(v.nominated / total * 1000) / 10 : 0,
      freeRate: total > 0 ? Math.round(v.free_visit / total * 1000) / 10 : 0,
      newRate: total > 0 ? Math.round(v.new_customers / total * 1000) / 10 : 0,
    }
  })

  // 店舗別リピート率（3ヶ月リターン率）ランキング
  const latestCycleByStore: Record<string, { rate: number; month: string }> = {}
  for (const c of cycleData) {
    if (isClosedStore(c.store)) continue
    const key = c.store
    const mo = `${c.year}-${String(c.month).padStart(2, '0')}`
    if (!latestCycleByStore[key] || mo > latestCycleByStore[key].month) {
      latestCycleByStore[key] = { rate: c.new_return_3m, month: mo }
    }
  }
  const storeReturnRanking = Object.entries(latestCycleByStore)
    .map(([store, d]) => ({ store, rate: d.rate, month: d.month }))
    .sort((a, b) => b.rate - a.rate)

  // 3ヶ月リピート率月次推移（全店平均）
  const cycleByMonth: Record<string, number[]> = {}
  for (const c of cycleData) {
    if (isClosedStore(c.store)) continue
    const mo = `${c.year}-${String(c.month).padStart(2, '0')}`
    if (!cycleByMonth[mo]) cycleByMonth[mo] = []
    if (c.new_return_3m > 0) cycleByMonth[mo].push(c.new_return_3m)
  }
  const returnRateTrend = Object.entries(cycleByMonth)
    .map(([mo, rates]) => ({
      month: mo,
      avgRate: rates.length > 0 ? Math.round(rates.reduce((s, r) => s + r, 0) / rates.length * 10) / 10 : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // ── 2. スタッフ生産性分析 ──────────────────────────────────
  const fromYM6 = month <= 6
    ? (year - 1) * 100 + (month + 6)
    : year * 100 + (month - 6)

  const staffSales = db.prepare(`
    SELECT year, month, staff, store, SUM(sales) as sales
    FROM staff_period_sales
    WHERE (year * 100 + month) >= ? AND (year * 100 + month) <= ?
    GROUP BY year, month, staff
    ORDER BY year ASC, month ASC, sales DESC
  `).all(fromYM6, toYM) as {
    year: number; month: number; staff: string; store: string; sales: number
  }[]

  // スタッフ別月次推移
  const staffByName: Record<string, { months: Record<string, number>; store: string }> = {}
  for (const s of staffSales) {
    if (!staffByName[s.staff]) staffByName[s.staff] = { months: {}, store: s.store }
    const mo = `${s.year}-${String(s.month).padStart(2, '0')}`
    staffByName[s.staff].months[mo] = (staffByName[s.staff].months[mo] ?? 0) + s.sales
    staffByName[s.staff].store = s.store
  }

  // 直近3ヶ月 vs 前3ヶ月の成長率
  const allMonths = [...new Set(staffSales.map(s => `${s.year}-${String(s.month).padStart(2, '0')}`))].sort()
  const recent3 = allMonths.slice(-3)
  const prev3 = allMonths.slice(-6, -3)

  const staffGrowth = Object.entries(staffByName).map(([staff, data]) => {
    const recentTotal = recent3.reduce((s, m) => s + (data.months[m] ?? 0), 0)
    const prevTotal = prev3.reduce((s, m) => s + (data.months[m] ?? 0), 0)
    const growthRate = prevTotal > 0 ? Math.round((recentTotal - prevTotal) / prevTotal * 1000) / 10 : null
    return { staff, store: data.store, recentTotal, prevTotal, growthRate }
  }).filter(s => s.recentTotal > 0)
    .sort((a, b) => (b.growthRate ?? -999) - (a.growthRate ?? -999))

  // 今月のスタッフランキング（客単価推定含む）
  const currentMonthStr = `${year}-${String(month).padStart(2, '0')}`
  const staffCurrentMonth = Object.entries(staffByName)
    .map(([staff, data]) => ({
      staff,
      store: data.store,
      sales: data.months[currentMonthStr] ?? 0,
    }))
    .filter(s => s.sales > 0)
    .sort((a, b) => b.sales - a.sales)

  // ── 3. 店舗ベンチマーク ──────────────────────────────────
  const currentMonthPrefix = `${year}-${String(month).padStart(2, '0')}`
  const storeSalesCurrentMonth = db.prepare(`
    SELECT store, SUM(sales) as sales, SUM(customers) as customers
    FROM store_daily_sales
    WHERE date LIKE ?
    GROUP BY store
  `).all(`${currentMonthPrefix}-%`) as { store: string; sales: number; customers: number }[]

  const storeUtilCurrentMonth = db.prepare(`
    SELECT store, ROUND(AVG(utilization_rate), 1) as avgRate
    FROM store_daily_utilization
    WHERE date LIKE ?
    GROUP BY store
  `).all(`${currentMonthPrefix}-%`) as { store: string; avgRate: number }[]

  const utilMap: Record<string, number> = {}
  for (const u of storeUtilCurrentMonth) utilMap[u.store] = u.avgRate

  const storeBenchmark = storeSalesCurrentMonth
    .filter(s => !isClosedStore(s.store))
    .map(s => {
      const storeConfig = STORES.find(st => s.store.includes(st.name) || st.name.includes(s.store))
      const seats = storeConfig?.seats ?? 10
      const revenuePerSeat = Math.round(s.sales / seats)
      const potential = seats * MAX_REVENUE_PER_SEAT
      const unitPrice = s.customers > 0 ? Math.round(s.sales / s.customers) : 0
      return {
        store: s.store,
        seats,
        sales: s.sales,
        customers: s.customers,
        unitPrice,
        revenuePerSeat,
        utilization: utilMap[s.store] ?? 0,
        potential,
        gap: potential - s.sales,
        achievementRate: Math.round(s.sales / potential * 1000) / 10,
      }
    })
    .sort((a, b) => b.revenuePerSeat - a.revenuePerSeat)

  // ── 4. 時系列・季節性分析 ──────────────────────────────────
  // 過去24ヶ月の月次データ
  const from24 = month === 12 ? (year - 1) : (year - 2)
  const fromMo24 = month === 12 ? 1 : month + 1
  const totalMonthly24 = getMonthlyTotalSales(from24, fromMo24, year, month)

  // 季節指数（月別平均からの乖離）
  const monthBuckets: Record<number, number[]> = {}
  for (const m of totalMonthly24) {
    const mo = parseInt(m.month.split('-')[1])
    if (!monthBuckets[mo]) monthBuckets[mo] = []
    monthBuckets[mo].push(m.sales)
  }
  const overallAvg = totalMonthly24.length > 0
    ? totalMonthly24.reduce((s, m) => s + m.sales, 0) / totalMonthly24.length
    : 1
  const seasonalIndex = Array.from({ length: 12 }, (_, i) => {
    const mo = i + 1
    const vals = monthBuckets[mo] ?? []
    const avg = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
    return {
      month: mo,
      label: `${mo}月`,
      index: overallAvg > 0 ? Math.round(avg / overallAvg * 100) / 100 : 0,
      avgSales: Math.round(avg),
    }
  })

  // 前年同月比の成長率
  const yoyGrowth: { month: string; current: number; prevYear: number; growthRate: number | null }[] = []
  for (const m of totalMonthly24) {
    const [yr, moStr] = m.month.split('-')
    const prevYearMonth = `${parseInt(yr) - 1}-${moStr}`
    const prev = totalMonthly24.find(p => p.month === prevYearMonth)
    if (prev) {
      yoyGrowth.push({
        month: m.month,
        current: m.sales,
        prevYear: prev.sales,
        growthRate: prev.sales > 0 ? Math.round((m.sales - prev.sales) / prev.sales * 1000) / 10 : null,
      })
    }
  }

  // 祝日インパクト分析（直近6ヶ月）
  const from6moDate = (() => {
    const d = new Date(year, month - 7, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })()
  const todayStr = `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const dailyForHolidays = getDailySales(from6moDate, todayStr)
  const holidayMap6 = getHolidayMap(from6moDate, todayStr)

  const holidaySales: number[] = []
  const nonHolidaySales: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  const holidayImpact: { date: string; name: string; sales: number; dow: number }[] = []

  for (const d of dailyForHolidays) {
    if (d.sales === 0) continue
    const dow = new Date(d.date + 'T00:00:00').getDay()
    if (holidayMap6[d.date]) {
      holidaySales.push(d.sales)
      holidayImpact.push({ date: d.date, name: holidayMap6[d.date], sales: d.sales, dow })
    } else {
      nonHolidaySales[dow].push(d.sales)
    }
  }

  // 祝日と同じ曜日の平均との比較
  const holidayImpactDetails = holidayImpact.map(h => {
    const sameDowAvg = nonHolidaySales[h.dow].length > 0
      ? Math.round(nonHolidaySales[h.dow].reduce((s, v) => s + v, 0) / nonHolidaySales[h.dow].length)
      : 0
    return {
      ...h,
      avgSameDow: sameDowAvg,
      impact: sameDowAvg > 0 ? Math.round((h.sales - sameDowAvg) / sameDowAvg * 1000) / 10 : 0,
    }
  })

  // ── 5. ABC分析（パレート分析） ──────────────────────────────────
  // スタッフABC（今月）
  const staffForABC = [...staffCurrentMonth].sort((a, b) => b.sales - a.sales)
  const staffTotalSales = staffForABC.reduce((s, st) => s + st.sales, 0)
  let staffCumPct = 0
  const staffABC = staffForABC.map(s => {
    staffCumPct += staffTotalSales > 0 ? s.sales / staffTotalSales * 100 : 0
    const grade = staffCumPct <= 80 ? 'A' : staffCumPct <= 95 ? 'B' : 'C'
    return { staff: s.staff, store: s.store, sales: s.sales, cumPct: Math.round(staffCumPct * 10) / 10, grade }
  })

  // 店舗ABC（今月）
  const storesForABC = [...storeBenchmark].sort((a, b) => b.sales - a.sales)
  const storeTotalSales = storesForABC.reduce((s, st) => s + st.sales, 0)
  let storeCumPct = 0
  const storeABC = storesForABC.map(s => {
    storeCumPct += storeTotalSales > 0 ? s.sales / storeTotalSales * 100 : 0
    const grade = storeCumPct <= 80 ? 'A' : storeCumPct <= 95 ? 'B' : 'C'
    return { store: s.store, sales: s.sales, cumPct: Math.round(storeCumPct * 10) / 10, grade }
  })

  const staffACount = staffABC.filter(s => s.grade === 'A').length
  const staffAShare = staffABC.length > 0
    ? Math.round(staffACount / staffABC.length * 1000) / 10
    : 0

  // ── 6. 月別予測 vs 目標（今年 3月〜12月） ─────────────────
  // - 完了月 (mo < 当月): 実績
  // - 当月 (mo === 当月): 進行中の着地予測（forecastEngine 平日/土日祝ペース）
  // - 未来月 (mo > 当月): 当月ペースを季節変動率で補正 + 出店計画上乗せ
  // - 目標: monthly_targets から取得

  const daysInCurrentMonth = new Date(year, month, 0).getDate()
  const cutoffDate = `${year}-${String(month).padStart(2, '0')}-${String(Math.max(today, 0)).padStart(2, '0')}`
  const rawDaily = getScrapedDailySales(year, month)
  const dailySalesForForecast: DailySales[] = rawDaily
    .filter(r => today > 0 && r.date <= cutoffDate)
    .map(r => ({
      date: r.date,
      dayOfWeek: new Date(r.date + 'T00:00:00').getDay(),
      totalAmount: r.sales,
      customers: r.customers,
      stores: {},
      staff: {},
    }))
  const currentMonthFc = computeForecast(dailySalesForForecast, year, month, today)
  const currentMonthEstimate = currentMonthFc.forecastTotal

  // 季節変動指数と当月比率（baseline 算出）
  const projSeasonalIndex = getSeasonalIndex(year)
  const currentSeasonalRatio = projSeasonalIndex[month] ?? 1.0
  const baselineMonthly = currentSeasonalRatio > 0 && currentMonthEstimate > 0
    ? currentMonthEstimate / currentSeasonalRatio
    : null

  // 前年同月データ（YoYフォールバック用）
  const prevYearMonthly = getMonthlyTotalSales(year - 1, 1, year - 1, 12)
  const prevYearMap = new Map<number, number>()
  for (const m of prevYearMonthly) {
    const mo = parseInt(m.month.split('-')[1])
    prevYearMap.set(mo, m.sales)
  }

  // 当年の完了月実績
  const currentYearActualMap = new Map<number, number>()
  for (const m of totalMonthly24) {
    const [yStr, mStr] = m.month.split('-')
    if (parseInt(yStr) === year) {
      currentYearActualMap.set(parseInt(mStr), m.sales)
    }
  }

  // YoY平均成長率（当月を除く完了月）
  const yoyRates: number[] = []
  for (const [mo, curr] of Array.from(currentYearActualMap.entries())) {
    if (mo >= month) continue
    const prev = prevYearMap.get(mo)
    if (prev && prev > 0) yoyRates.push((curr - prev) / prev)
  }
  const avgGrowthRate = yoyRates.length > 0
    ? yoyRates.reduce((a, b) => a + b, 0) / yoyRates.length
    : null

  // 出店計画の月別上乗せ
  const openingRevenue = getStoreOpeningRevenue(year)
  const newStoreByMonth: Record<number, number> = {}
  for (const r of openingRevenue) {
    newStoreByMonth[r.month] = (newStoreByMonth[r.month] ?? 0) + r.revenue
  }

  const monthlyProjectionItems: {
    month: number
    status: 'actual' | 'inProgress' | 'future'
    actual: number | null
    forecast: number | null
    target: number | null
    diff: number | null
    diffRate: number | null
  }[] = []

  for (let mo = 3; mo <= 12; mo++) {
    const target = getTarget(year, mo)
    let actual: number | null = null
    let forecast: number | null = null
    let status: 'actual' | 'inProgress' | 'future'

    if (mo < month) {
      status = 'actual'
      actual = currentYearActualMap.get(mo) ?? null
    } else if (mo === month) {
      status = 'inProgress'
      forecast = currentMonthEstimate > 0 ? currentMonthEstimate : null
    } else {
      status = 'future'
      const moRatio = projSeasonalIndex[mo] ?? 1.0
      let proj: number | null = null
      if (baselineMonthly !== null) {
        proj = Math.round(baselineMonthly * moRatio)
      } else {
        const prev = prevYearMap.get(mo)
        if (prev && prev > 0) {
          proj = avgGrowthRate !== null
            ? Math.round(prev * (1 + avgGrowthRate))
            : prev
        }
      }
      if (proj !== null && newStoreByMonth[mo]) proj += newStoreByMonth[mo]
      forecast = proj
    }

    const reference = actual !== null ? actual : forecast
    const diff = reference !== null && target !== null ? reference - target : null
    const diffRate = diff !== null && target !== null && target > 0
      ? Math.round((diff / target) * 1000) / 10
      : null

    monthlyProjectionItems.push({ month: mo, status, actual, forecast, target, diff, diffRate })
  }

  return NextResponse.json({
    // 1. 顧客リピート分析
    customerRepeat: {
      monthly: customerRepeatMonthly,
      storeReturnRanking,
      returnRateTrend,
    },
    // 2. スタッフ生産性分析
    staffProductivity: {
      currentMonth: staffCurrentMonth,
      growth: staffGrowth,
      monthlyTrends: staffByName,
    },
    // 3. 店舗ベンチマーク
    storeBenchmark,
    // 4. 季節性分析
    seasonal: {
      seasonalIndex,
      yoyGrowth,
      holidayImpact: holidayImpactDetails,
    },
    // 5. ABC分析
    abc: {
      staff: staffABC,
      stores: storeABC,
      staffAShare,
      staffACount,
      staffTotal: staffABC.length,
    },
    // 6. 月別予測 vs 目標（今年 3月〜12月）
    monthlyProjection: {
      year,
      currentMonth: month,
      items: monthlyProjectionItems,
    },
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  })
}
