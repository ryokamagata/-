import { NextRequest, NextResponse } from 'next/server'
import {
  getAllKpiValues,
  setKpiValue,
  KPI_NO_DATA,
  getMonthlyTotalSales,
  getPerStoreVisitors,
  getPerStoreCycle,
  getMonthlyStaffSales,
} from '@/lib/db'
import { EXECUTIVES, calculateScore, getScoreRank, getCurrentQuarter, getQuarterMonths } from '@/lib/kpiConfig'
import { isClosedStore } from '@/lib/stores'
import { normalizeStaffName } from '@/lib/staffNormalize'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const currentMonth = now.getMonth() + 1
  const currentQ = getCurrentQuarter(currentMonth)

  // 手動入力KPI値を取得
  const manualKpis = getAllKpiValues(year)

  // 自動計算KPI値を取得
  const autoKpis: Record<string, Record<number, number>> = {}

  // 年間売上
  const allMonthly = getMonthlyTotalSales(year, 1, year, 12)
  const annualRevenue = allMonthly.reduce((s, m) => s + m.sales, 0)
  autoKpis['annual_revenue'] = { 0: Math.round(annualRevenue / 100_000_000 * 100) / 100 } // 億円

  // 月別の新規人数・リターン率・生産性・客単価を計算
  for (let mo = 1; mo <= currentMonth; mo++) {
    // 新規人数（全店合計）
    const visitors = getPerStoreVisitors(year, mo)
    const totalNewCustomers = visitors
      .filter(v => !isClosedStore(v.store))
      .reduce((s, v) => s + v.new_customers, 0)
    if (totalNewCustomers > 0) {
      if (!autoKpis['new_customers']) autoKpis['new_customers'] = {}
      autoKpis['new_customers'][mo] = totalNewCustomers
    }

    // リターン率（全店平均）
    const cycles = getPerStoreCycle(year, mo)
    const returnRates = cycles
      .filter(c => !isClosedStore(c.store) && c.new_return_3m > 0)
      .map(c => c.new_return_3m)
    if (returnRates.length > 0) {
      if (!autoKpis['return_rate']) autoKpis['return_rate'] = {}
      autoKpis['return_rate'][mo] = Math.round(returnRates.reduce((a, b) => a + b, 0) / returnRates.length * 10) / 10
    }

    // 月間売上データ
    const monthSales = allMonthly.find(m => m.month === `${year}-${String(mo).padStart(2, '0')}`)

    // 生産性（1人あたり売上 = 売上 ÷ スタッフ数、万円単位）
    const staffData = getMonthlyStaffSales(year, mo, year, mo)
    const activeStaff = new Set<string>()
    for (const s of staffData) {
      const name = normalizeStaffName(s.staff)
      if (name && name !== 'フリー' && name !== '不明' && s.sales > 0) activeStaff.add(name)
    }
    if (monthSales && activeStaff.size > 0) {
      if (!autoKpis['productivity']) autoKpis['productivity'] = {}
      autoKpis['productivity'][mo] = Math.round(monthSales.sales / activeStaff.size / 10000)
    }

    // 平均客単価
    if (monthSales && monthSales.customers > 0) {
      if (!autoKpis['avg_unit_price']) autoKpis['avg_unit_price'] = {}
      autoKpis['avg_unit_price'][mo] = Math.round(monthSales.sales / monthSales.customers)
    }
  }

  // 月別目標マップを取得
  const NAKAJIMA_MONTHLY = (await import('@/lib/kpiConfig')).NAKAJIMA_MONTHLY_TARGETS
  const MATSUDATE_MONTHLY = (await import('@/lib/kpiConfig')).MATSUDATE_MONTHLY_TARGETS
  const CREATIVE_MONTHLY = (await import('@/lib/kpiConfig')).CREATIVE_MONTHLY_TARGETS

  // 手動で上書きされた目標値を取得（kpi_target_xxx キーで保存）
  const manualTargets = getAllKpiValues(year, 'kpi_target_')

  // KPIキー→月別目標のマッピング（デフォルト値）
  const defaultTargetMap: Record<string, Record<number, number>> = {}
  for (let mo = 1; mo <= 12; mo++) {
    const nt = NAKAJIMA_MONTHLY[mo]
    if (nt) {
      if (!defaultTargetMap['turnover']) defaultTargetMap['turnover'] = {}
      defaultTargetMap['turnover'][mo] = nt.turnover
      if (!defaultTargetMap['debut']) defaultTargetMap['debut'] = {}
      defaultTargetMap['debut'][mo] = nt.debut
      if (!defaultTargetMap['leader_index']) defaultTargetMap['leader_index'] = {}
      defaultTargetMap['leader_index'][mo] = nt.leaderIndex
    }
    const mt = MATSUDATE_MONTHLY[mo]
    if (mt) {
      if (!defaultTargetMap['new_customers']) defaultTargetMap['new_customers'] = {}
      defaultTargetMap['new_customers'][mo] = mt.newCustomers
      if (!defaultTargetMap['return_rate']) defaultTargetMap['return_rate'] = {}
      defaultTargetMap['return_rate'][mo] = mt.returnRate
      if (!defaultTargetMap['productivity']) defaultTargetMap['productivity'] = {}
      defaultTargetMap['productivity'][mo] = mt.productivity
    }
    const ct = CREATIVE_MONTHLY[mo]
    if (ct) {
      if (!defaultTargetMap['hpb_styles']) defaultTargetMap['hpb_styles'] = {}
      defaultTargetMap['hpb_styles'][mo] = ct.hpbStyles
      if (!defaultTargetMap['instagram_followers']) defaultTargetMap['instagram_followers'] = {}
      defaultTargetMap['instagram_followers'][mo] = ct.instagram
      if (!defaultTargetMap['avg_unit_price']) defaultTargetMap['avg_unit_price'] = {}
      defaultTargetMap['avg_unit_price'][mo] = ct.unitPrice
    }
  }

  // 手動目標があればデフォルトを上書き
  const monthlyTargetMap: Record<string, Record<number, number>> = {}
  for (const key of Object.keys(defaultTargetMap)) {
    monthlyTargetMap[key] = { ...defaultTargetMap[key] }
    const overrides = manualTargets[`kpi_target_${key}`] ?? {}
    for (const [moStr, val] of Object.entries(overrides)) {
      monthlyTargetMap[key][parseInt(moStr)] = val as number
    }
  }

  // Q最終月かどうか判定（Q末のみ評価確定）
  const qMonthsList = getQuarterMonths(currentQ)
  const isQFinal = currentMonth === qMonthsList[qMonthsList.length - 1]

  // 各責任者のスコアカードを計算
  const executives = EXECUTIVES.map(exec => {
    const kpiResults = exec.kpis.map(kpi => {
      // autoKpiを基本にし、手動入力があれば上書き（全KPIで手動入力可能に）
      const autoValues = autoKpis[kpi.key] ?? {}
      const manualValues = manualKpis[kpi.key] ?? {}
      // 手動入力が優先、なければ自動値
      // KPI_NO_DATA(-99999)は「データなし」として記録されている → nullとして扱う
      const monthlyValues: Record<number, number | null> = {}
      for (let mo = 1; mo <= 12; mo++) {
        if (manualValues[mo] !== undefined && manualValues[mo] !== null) {
          monthlyValues[mo] = manualValues[mo] === KPI_NO_DATA ? null : manualValues[mo]
        } else if (autoValues[mo] !== undefined && autoValues[mo] !== null) {
          monthlyValues[mo] = autoValues[mo]
        }
      }

      // 入力状態を別途追跡（「未入力」vs「データなし」vs「値あり」）
      const inputStatus: Record<number, 'not_entered' | 'no_data' | 'has_value'> = {}
      for (const m of qMonthsList) {
        if (manualValues[m] === KPI_NO_DATA) {
          inputStatus[m] = 'no_data'
        } else if (monthlyValues[m] !== undefined && monthlyValues[m] !== null) {
          inputStatus[m] = 'has_value'
        } else {
          inputStatus[m] = 'not_entered'
        }
      }

      // Q期間の値を集計（nullは除外）
      const qMonths = getQuarterMonths(currentQ)
      const qValues = qMonths
        .map(m => monthlyValues[m])
        .filter((v): v is number => v !== undefined && v !== null)

      let qValue: number | null = null
      if (qValues.length > 0) {
        qValue = kpi.mode === 'sum'
          ? qValues.reduce((a, b) => a + b, 0)
          : Math.round(qValues.reduce((a, b) => a + b, 0) / qValues.length * 10) / 10
      }

      // 特殊: annual_revenueは年間合計
      if (kpi.key === 'annual_revenue') {
        qValue = autoKpis['annual_revenue']?.[0] ?? null
      }

      // スコア計算
      const isReverse = kpi.key === 'turnover'
      const score = qValue !== null ? calculateScore(qValue, kpi.scoring, isReverse) : null
      const target = kpi.quarterTargets[currentQ] ?? null

      // 月別目標
      const kpiMonthlyTargets = monthlyTargetMap[kpi.key] ?? {}

      // 月別進捗（月ごとの目標対比）
      const monthlyProgress = qMonths.map(m => {
        const actual = monthlyValues[m] ?? null
        const monthTarget = kpiMonthlyTargets[m] ?? null
        const iStatus = inputStatus[m] ?? 'not_entered'
        let status: 'achieved' | 'on_track' | 'behind' | 'no_data' | 'no_data_entered' = 'no_data'
        if (iStatus === 'no_data') {
          status = 'no_data_entered'
        } else if (actual !== null && monthTarget !== null && monthTarget > 0) {
          const ratio = isReverse
            ? (actual === 0 ? 2 : monthTarget / actual)
            : (actual / monthTarget)
          status = ratio >= 1 ? 'achieved' : ratio >= 0.8 ? 'on_track' : 'behind'
        } else if (actual === 0 && iStatus === 'has_value') {
          // 0で入力された場合
          if (isReverse) {
            status = 'achieved' // 離職0人は達成
          } else {
            status = monthTarget !== null && monthTarget > 0 ? 'behind' : 'no_data'
          }
        }
        return {
          month: m,
          actual,
          target: monthTarget,
          autoValue: autoValues[m] ?? null,
          manualValue: manualValues[m] ?? null,
          inputStatus: iStatus,
          status,
        }
      })

      return {
        key: kpi.key,
        label: kpi.label,
        unit: kpi.unit,
        source: kpi.source,
        target,
        currentValue: qValue,
        score,
        maxScore: 30,
        monthlyValues,
        monthlyProgress,
        monthlyTargets: qMonths.map(m => ({
          month: m,
          value: monthlyValues[m] ?? null,
        })),
      }
    })

    const totalScore = kpiResults.reduce((s, k) => s + (k.score ?? 0), 0)
    const maxPossible = kpiResults.length * 30
    const rank = getScoreRank(totalScore, exec.scoreRanges)

    return {
      id: exec.id,
      name: exec.name,
      role: exec.role,
      description: exec.description,
      kpis: kpiResults,
      totalScore,
      maxScore: maxPossible,
      rank: rank.rank,
      reward: rank.reward,
    }
  })

  return NextResponse.json({
    year,
    currentQuarter: currentQ,
    currentMonth,
    isQFinal,
    quarterLabel: `${currentQ}Q（${getQuarterMonths(currentQ).join('・')}月）`,
    executives,
  })
}

// KPI手動入力・目標変更
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { year, month, key, value, type } = body

  // type: 'target' → 目標値を保存、それ以外 → 実績値を保存
  if (type === 'target') {
    if (!year || !month || !key || value === undefined) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 })
    }
    setKpiValue(year, month, `kpi_target_${key}`, value)
    return NextResponse.json({ ok: true })
  }

  // type: 'no_data' → データなしとして保存
  if (type === 'no_data') {
    if (!year || !month || !key) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 })
    }
    setKpiValue(year, month, key, KPI_NO_DATA)
    return NextResponse.json({ ok: true })
  }

  if (!year || !month || !key || value === undefined) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }
  setKpiValue(year, month, key, value)
  return NextResponse.json({ ok: true })
}
