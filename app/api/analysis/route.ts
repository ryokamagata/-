import { NextResponse } from 'next/server'
import {
  getMonthlyTotalSales,
  getMonthlyStoreSales,
  getDayOfWeekSales,
  getStoreDayOfWeekSales,
  getDayOfWeekUtilization,
  getStoreDayOfWeekUtilization,
  getMonthlyTargets,
  getAnnualTarget,
  getSeasonalIndex,
} from '@/lib/db'
import { STORES, MAX_REVENUE_PER_SEAT, isClosedStore } from '@/lib/stores'

export const revalidate = 0

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']

export async function GET() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const toYear = now.getFullYear()
  const toMonth = now.getMonth() + 1

  // ── 客単価×客数 分解分析 ──────────────────────────────────────────────
  // 過去12ヶ月の月別データ
  const fromYear = toMonth <= 12 ? toYear - 1 : toYear
  const fromMonth2 = ((toMonth - 1 + 12) % 12) + 1
  const totalMonthly = getMonthlyTotalSales(fromYear, fromMonth2, toYear, toMonth)
  const storeMonthly = getMonthlyStoreSales(fromYear, fromMonth2, toYear, toMonth)

  // 全店合計の客単価×客数分解
  const priceVolumeDecomposition = totalMonthly.map((m, i) => {
    const unitPrice = m.customers > 0 ? Math.round(m.sales / m.customers) : 0
    const prev = i > 0 ? totalMonthly[i - 1] : null
    const prevUnitPrice = prev && prev.customers > 0 ? Math.round(prev.sales / prev.customers) : null
    const prevCustomers = prev ? prev.customers : null

    // 分解: ΔSales = ΔPrice × avgCustomers + ΔCustomers × avgPrice
    let priceEffect: number | null = null
    let volumeEffect: number | null = null
    if (prevUnitPrice !== null && prevCustomers !== null) {
      const avgCustomers = (m.customers + prevCustomers) / 2
      const avgPrice = (unitPrice + prevUnitPrice) / 2
      priceEffect = Math.round((unitPrice - prevUnitPrice) * avgCustomers)
      volumeEffect = Math.round((m.customers - prevCustomers) * avgPrice)
    }

    return {
      month: m.month,
      sales: m.sales,
      customers: m.customers,
      unitPrice,
      priceEffect,
      volumeEffect,
    }
  })

  // 店舗別の客単価×客数分解
  const storeDecomposition: Record<string, typeof priceVolumeDecomposition> = {}
  const storeGrouped = new Map<string, typeof totalMonthly>()
  for (const row of storeMonthly) {
    if (!storeGrouped.has(row.store)) storeGrouped.set(row.store, [])
    storeGrouped.get(row.store)!.push(row)
  }
  for (const [store, months] of storeGrouped) {
    if (isClosedStore(store)) continue
    storeDecomposition[store] = months.map((m, i) => {
      const unitPrice = m.customers > 0 ? Math.round(m.sales / m.customers) : 0
      const prev = i > 0 ? months[i - 1] : null
      const prevUnitPrice = prev && prev.customers > 0 ? Math.round(prev.sales / prev.customers) : null
      const prevCustomers = prev ? prev.customers : null
      let priceEffect: number | null = null
      let volumeEffect: number | null = null
      if (prevUnitPrice !== null && prevCustomers !== null) {
        const avgCustomers = (m.customers + prevCustomers) / 2
        const avgPrice = (unitPrice + prevUnitPrice) / 2
        priceEffect = Math.round((unitPrice - prevUnitPrice) * avgCustomers)
        volumeEffect = Math.round((m.customers - prevCustomers) * avgPrice)
      }
      return {
        month: m.month,
        sales: m.sales,
        customers: m.customers,
        unitPrice,
        priceEffect,
        volumeEffect,
      }
    })
  }

  // ── 曜日別売上パターン ─────────────────────────────────────────────
  // 直近3ヶ月分の曜日別集計
  const dowFromMonth = toMonth <= 3 ? toMonth + 9 : toMonth - 3
  const dowFromYear = toMonth <= 3 ? toYear - 1 : toYear
  const dowAll = getDayOfWeekSales(dowFromYear, dowFromMonth, toYear, toMonth)
  const dowByStore = getStoreDayOfWeekSales(dowFromYear, dowFromMonth, toYear, toMonth)

  const dowSummary = dowAll.map(d => ({
    dow: d.dow,
    label: DOW_LABELS[d.dow],
    days: d.days,
    avgSales: d.avgSales,
    avgCustomers: d.avgCustomers,
    avgUnitPrice: d.avgCustomers > 0 ? Math.round(d.totalSales / d.totalCustomers) : 0,
  }))

  // 店舗別曜日データ
  const dowByStoreGrouped: Record<string, typeof dowSummary> = {}
  for (const d of dowByStore) {
    if (isClosedStore(d.store)) continue
    if (!dowByStoreGrouped[d.store]) dowByStoreGrouped[d.store] = []
    dowByStoreGrouped[d.store].push({
      dow: d.dow,
      label: DOW_LABELS[d.dow],
      days: d.days,
      avgSales: d.avgSales,
      avgCustomers: d.avgCustomers,
      avgUnitPrice: d.avgCustomers > 0 ? Math.round(d.totalSales / d.totalCustomers) : 0,
    })
  }

  // ── 曜日別稼働率 ──────────────────────────────────────────────────
  const utilAll = getDayOfWeekUtilization(dowFromYear, dowFromMonth, toYear, toMonth)
  const utilByStore = getStoreDayOfWeekUtilization(dowFromYear, dowFromMonth, toYear, toMonth)

  const dowUtilization = utilAll.map(u => ({
    dow: u.dow,
    label: DOW_LABELS[u.dow],
    avgRate: u.avgRate,
    days: u.days,
  }))

  const dowUtilByStore: Record<string, typeof dowUtilization> = {}
  for (const u of utilByStore) {
    if (isClosedStore(u.store)) continue
    if (!dowUtilByStore[u.store]) dowUtilByStore[u.store] = []
    dowUtilByStore[u.store].push({
      dow: u.dow,
      label: DOW_LABELS[u.dow],
      avgRate: u.avgRate,
      days: u.days,
    })
  }

  // ── 目標サジェスト ──────────────────────────────────────────────────
  // 各月の目標を席数・成長率・季節変動から提案
  const seasonalIndex = getSeasonalIndex(toYear)
  const prevYearMonthly = getMonthlyTotalSales(toYear - 1, 1, toYear - 1, 12)
  const currentYearMonthly = getMonthlyTotalSales(toYear, 1, toYear, toMonth)
  const existingTargets = getMonthlyTargets(toYear)
  const annualTarget = getAnnualTarget(toYear)

  // 全店合計の席数上限
  const totalSeats = STORES.filter(s => !isClosedStore(s.name)).reduce((s, st) => s + st.seats, 0)
  const monthlyRevenueCeiling = totalSeats * MAX_REVENUE_PER_SEAT
  const realisticCeiling = Math.round(monthlyRevenueCeiling * 0.85) // 席稼働85%前提

  // YoY成長率（完了月ベース）
  const yoyRates: number[] = []
  for (const cm of currentYearMonthly) {
    if (cm.month === `${toYear}-${String(toMonth).padStart(2, '0')}`) continue // 今月は除外
    const [, mStr] = cm.month.split('-')
    const mo = parseInt(mStr)
    const prev = prevYearMonthly.find(p => {
      const [, pMStr] = p.month.split('-')
      return parseInt(pMStr) === mo
    })
    if (prev && prev.sales > 0) {
      yoyRates.push((cm.sales - prev.sales) / prev.sales)
    }
  }
  const avgYoYRate = yoyRates.length > 0
    ? yoyRates.reduce((a, b) => a + b, 0) / yoyRates.length
    : null

  // 月別サジェスト
  const targetSuggestions: {
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
  }[] = []

  for (let mo = 1; mo <= 12; mo++) {
    const moStr = String(mo).padStart(2, '0')
    const prevData = prevYearMonthly.find(p => p.month.endsWith(`-${moStr}`))
    const prevSales = prevData?.sales ?? null
    const seasonal = seasonalIndex[mo] ?? null
    const existing = existingTargets[mo] ?? null

    let suggested: number
    const rationale: string[] = []

    if (prevSales && avgYoYRate !== null) {
      // ベース: 前年同月 × (1 + 成長率)
      const base = Math.round(prevSales * (1 + avgYoYRate))
      rationale.push(`前年${mo}月 ${(prevSales / 10000).toFixed(0)}万 × 成長率${(avgYoYRate * 100).toFixed(1)}%`)

      // 季節変動で補正
      if (seasonal !== null && seasonal > 0) {
        suggested = Math.round(base * Math.max(seasonal, 0.7))
        if (Math.abs(seasonal - 1.0) > 0.05) {
          rationale.push(`季節変動 ${(seasonal * 100).toFixed(0)}%で補正`)
        }
      } else {
        suggested = base
      }

      // 席数上限でキャップ
      if (suggested > realisticCeiling) {
        suggested = realisticCeiling
        rationale.push(`席数上限(${totalSeats}席×85%)でキャップ`)
      }

      // 攻めの目標: 提案値の105-110%を推奨（ユーザーは高め設定を好む）
      const aggressive = Math.round(suggested * 1.08)
      suggested = Math.min(aggressive, realisticCeiling)
      rationale.push(`攻め目標として+8%上乗せ`)
    } else if (prevSales) {
      suggested = Math.round(prevSales * 1.1)
      rationale.push(`前年同月 +10%（成長データ不足）`)
    } else {
      // 前年データなし
      const avgMonthly = currentYearMonthly.length > 0
        ? currentYearMonthly.reduce((s, m) => s + m.sales, 0) / currentYearMonthly.length
        : realisticCeiling * 0.6
      suggested = Math.round(avgMonthly * 1.05)
      rationale.push(`今期平均 ×105%（前年データなし）`)
    }

    targetSuggestions.push({
      month: mo,
      suggested,
      existing,
      rationale,
      basis: {
        prevYear: prevSales,
        yoyRate: avgYoYRate !== null ? Math.round(avgYoYRate * 1000) / 10 : null,
        seasonal,
        ceiling: realisticCeiling,
      },
    })
  }

  const suggestedAnnualTotal = targetSuggestions.reduce((s, t) => s + t.suggested, 0)

  return NextResponse.json({
    priceVolumeDecomposition,
    storeDecomposition,
    dowSummary,
    dowByStore: dowByStoreGrouped,
    dowUtilization,
    dowUtilByStore,
    targetSuggestions,
    suggestedAnnualTotal,
    existingAnnualTarget: annualTarget,
    realisticCeiling,
    totalSeats,
  })
}
