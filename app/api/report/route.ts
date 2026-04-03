import { NextResponse } from 'next/server'
import {
  getMonthlyTotalSales,
  getMonthlyStoreSales,
  getMonthlyStaffSales,
  getAnnualTarget,
  getMonthlyTargets,
} from '@/lib/db'
import { STORES, MAX_REVENUE_PER_SEAT, isClosedStore } from '@/lib/stores'
import { normalizeStaffName } from '@/lib/staffNormalize'

export const revalidate = 0

function shortenStoreName(name: string): string {
  return name
    .replace(/^AI\s*TOKYO\s*/i, '')
    .replace(/^AITOKYO\s*\+?\s*/i, '')
    .replace(/^ams by AI\s*TOKYO\s*/i, 'ams ')
    .replace("men's ", '')
    .replace(' men', '')
    .trim()
}

export async function GET() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const prevMonth = month === 1 ? 12 : month - 1
  const prevMonthYear = month === 1 ? year - 1 : year

  const currentMonthData = getMonthlyTotalSales(year, month, year, month)
  const prevMonthData = getMonthlyTotalSales(prevMonthYear, prevMonth, prevMonthYear, prevMonth)
  const prevYearSameMonth = getMonthlyTotalSales(year - 1, month, year - 1, month)

  const currentSales = currentMonthData[0]?.sales ?? 0
  const currentCustomers = currentMonthData[0]?.customers ?? 0
  const prevSales = prevMonthData[0]?.sales ?? 0
  const prevCustomers = prevMonthData[0]?.customers ?? 0
  const prevYearSales = prevYearSameMonth[0]?.sales ?? 0

  const unitPrice = currentCustomers > 0 ? Math.round(currentSales / currentCustomers) : 0
  const prevUnitPrice = prevCustomers > 0 ? Math.round(prevSales / prevCustomers) : 0

  const monthlyTargets = getMonthlyTargets(year)
  const monthTarget = monthlyTargets[month] ?? null
  const annualTarget = getAnnualTarget(year)
  const achievementRate = monthTarget && monthTarget > 0 ? Math.round((currentSales / monthTarget) * 100) : null

  const ytdData = getMonthlyTotalSales(year, 1, year, month)
  const ytdSales = ytdData.reduce((s, m) => s + m.sales, 0)
  const ytdCustomers = ytdData.reduce((s, m) => s + m.customers, 0)

  // 店舗別
  const storeData = getMonthlyStoreSales(year, month, year, month)
    .filter(s => !isClosedStore(s.store))
    .sort((a, b) => b.sales - a.sales)
    .map(s => ({
      store: shortenStoreName(s.store),
      sales: s.sales,
      customers: s.customers,
      unitPrice: s.customers > 0 ? Math.round(s.sales / s.customers) : 0,
    }))

  // スタッフTOP10
  const staffRaw = getMonthlyStaffSales(year, month, year, month)
  const staffMap = new Map<string, number>()
  for (const s of staffRaw) {
    const name = normalizeStaffName(s.staff)
    if (!name || name === 'フリー' || name === '不明') continue
    staffMap.set(name, (staffMap.get(name) ?? 0) + s.sales)
  }
  const topStaff = Array.from(staffMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, sales]) => ({ name, sales }))

  const momGrowth = prevSales > 0 ? (currentSales - prevSales) / prevSales * 100 : null
  const yoyGrowth = prevYearSales > 0 ? (currentSales - prevYearSales) / prevYearSales * 100 : null

  const totalSeats = STORES.filter(s => !isClosedStore(s.name)).reduce((s, st) => s + st.seats, 0)
  const seatUtilization = totalSeats > 0 && currentSales > 0
    ? Math.round((currentSales / (totalSeats * MAX_REVENUE_PER_SEAT)) * 100)
    : null

  // 月別推移
  const monthlyTrend = ytdData.map(m => {
    const [, mStr] = m.month.split('-')
    const mo = parseInt(mStr)
    const target = monthlyTargets[mo] ?? null
    const rate = target && target > 0 ? Math.round(m.sales / target * 100) : null
    return {
      month: mo,
      sales: m.sales,
      customers: m.customers,
      unitPrice: m.customers > 0 ? Math.round(m.sales / m.customers) : 0,
      target,
      rate,
    }
  })

  return NextResponse.json({
    year,
    month,
    dateLabel: `${month}/${now.getDate()}時点`,
    currentSales,
    currentCustomers,
    unitPrice,
    prevUnitPrice,
    monthTarget,
    achievementRate,
    momGrowth,
    yoyGrowth,
    ytdSales,
    ytdCustomers,
    annualTarget,
    seatUtilization,
    totalSeats,
    stores: storeData,
    topStaff,
    monthlyTrend,
  })
}
