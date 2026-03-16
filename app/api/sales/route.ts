import { NextResponse } from 'next/server'
import { getSalesForMonth, getTarget } from '@/lib/db'
import { computeForecast } from '@/lib/forecastEngine'
import type { DailySales, DashboardData } from '@/lib/types'

export const revalidate = 0 // キャッシュなし（CSV アップロード後即反映）

export async function GET() {
  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
  )
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const today = now.getDate()
  const daysInMonth = new Date(year, month, 0).getDate()

  const rawRows = getSalesForMonth(year, month)
  const monthlyTarget = getTarget(year, month)

  // 日別集計
  const dayMap: Record<string, DailySales> = {}
  for (const r of rawRows) {
    if (!dayMap[r.date]) {
      dayMap[r.date] = {
        date: r.date,
        dayOfWeek: new Date(r.date + 'T00:00:00').getDay(),
        totalAmount: 0,
        customers: 0,
        stores: {},
        staff: {},
      }
    }
    const d = dayMap[r.date]
    d.totalAmount += r.amount
    d.customers += r.customers
    d.stores[r.store] = (d.stores[r.store] ?? 0) + r.amount
    d.staff[r.staff] = (d.staff[r.staff] ?? 0) + r.amount
  }

  const dailySales = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date))

  // 店舗別集計
  const storeMap: Record<string, number> = {}
  for (const d of dailySales) {
    for (const [store, amt] of Object.entries(d.stores)) {
      storeMap[store] = (storeMap[store] ?? 0) + amt
    }
  }

  // スタッフ別集計
  const staffMap: Record<string, number> = {}
  for (const d of dailySales) {
    for (const [staff, amt] of Object.entries(d.staff)) {
      staffMap[staff] = (staffMap[staff] ?? 0) + amt
    }
  }

  // 日別推移（累積）
  let running = 0
  const dailyData = dailySales.map((d) => {
    running += d.totalAmount
    return {
      date: d.date.slice(5), // MM-DD 形式
      sales: d.totalAmount,
      cumulative: running,
    }
  })

  // 予測
  const forecast = computeForecast(dailySales, year, month, today)
  const achievementRate = monthlyTarget
    ? Math.round((forecast.actualTotal / monthlyTarget) * 100)
    : null

  const response: DashboardData = {
    year,
    month,
    today,
    daysInMonth,
    totalSales: forecast.actualTotal,
    monthlyTarget,
    achievementRate,
    forecast,
    storeBreakdown: Object.entries(storeMap)
      .map(([store, sales]) => ({ store, sales }))
      .sort((a, b) => b.sales - a.sales),
    staffBreakdown: Object.entries(staffMap)
      .filter(([staff]) => staff !== '不明')
      .map(([staff, sales]) => ({ staff, sales }))
      .sort((a, b) => b.sales - a.sales),
    dailyData,
    lastUpdated: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
