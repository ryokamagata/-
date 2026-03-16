'use client'

import { useCallback, useEffect, useState } from 'react'
import ScrapeButton from '@/components/ScrapeButton'

interface StoreData {
  bm_code: string
  store: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  scraped_at: string
}

interface AllData {
  account: StoreData[]
  visitor: StoreData[]
  cycle: StoreData[]
  user: StoreData[]
}

export default function AnalyticsTabs({ year, month }: { year: number; month: number }) {
  const [data, setData] = useState<AllData>({ account: [], visitor: [], cycle: [], user: [] })
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const types = ['account', 'visitor', 'cycle', 'user'] as const
      const results = await Promise.all(
        types.map(async (type) => {
          const params = new URLSearchParams({ type, year: String(year), month: String(month) })
          const res = await fetch(`/api/analysis?${params}`)
          const json = await res.json()
          return { type, stores: json.stores ?? [] }
        })
      )
      const newData: AllData = { account: [], visitor: [], cycle: [], user: [] }
      for (const r of results) {
        newData[r.type] = r.stores
      }
      setData(newData)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // === 売上集計 ===
  const sales = { pureSales: 0, totalSales: 0, avgSpend: 0, totalCustomers: 0, namedSales: 0, namedCount: 0 }
  for (const s of data.account) {
    const sum = s.data?.summary ?? {}
    sales.pureSales += sum.pureSales || 0
    sales.totalCustomers += sum.totalCustomers || 0
    sales.namedSales += sum.namedSales || 0
    sales.namedCount += sum.namedCount || 0
    sales.totalSales += sum.totalSales || 0
  }
  sales.avgSpend = sales.totalCustomers > 0 ? Math.round(sales.pureSales / sales.totalCustomers) : 0

  // === 来店客集計 ===
  let visitorNominated = 0, visitorFree = 0
  let visitorNew = 0, visitorReturn = 0, visitorFixed = 0, visitorReReturn = 0
  for (const s of data.visitor) {
    const tables = s.data?.tables as { headers: string[]; rows: string[][] }[] | undefined
    if (!tables || tables.length === 0) continue
    // Use first table (main aggregate data)
    const t = tables[0]
    if (!t.rows || t.rows.length === 0) continue
    // Sum all rows (each row is a date or summary)
    // The last row is usually the total/合計
    const lastRow = t.rows[t.rows.length - 1]
    if (!lastRow) continue
    // Headers: 日付, 曜日, 指名件数, フリー件数, 指名率, 新規, 再来, 固定, リターン, リピート率
    const hi = (name: string) => t.headers.findIndex((h) => h.includes(name))
    const num = (v: string) => parseInt((v || '0').replace(/[^0-9.-]/g, '')) || 0

    // Check if last row is total (合計)
    const isTotal = /合計/.test(lastRow[0] || '')
    const row = isTotal ? lastRow : lastRow
    visitorNominated += num(row[hi('指名件数')] || '0')
    visitorFree += num(row[hi('フリー件数')] || '0')
    visitorNew += num(row[hi('新規')] || '0')
    visitorReturn += num(row[hi('再来')] || '0')
    visitorFixed += num(row[hi('固定')] || '0')
    visitorReReturn += num(row[hi('リターン')] || '0')
  }
  const visitorTotal = visitorNominated + visitorFree
  const nominationRate = visitorTotal > 0 ? ((visitorNominated / visitorTotal) * 100).toFixed(1) : '0'
  const visitorRepeatTotal = visitorReturn + visitorFixed + visitorReReturn
  const repeatRate = (visitorNew + visitorRepeatTotal) > 0
    ? ((visitorRepeatTotal / (visitorNew + visitorRepeatTotal)) * 100).toFixed(1)
    : '0'

  // === サイクル集計 ===
  let cycleWeightedSum = 0, cycleWeightedCount = 0
  for (const s of data.cycle) {
    const tables = s.data?.tables as { headers: string[]; rows: string[][] }[] | undefined
    if (!tables || tables.length === 0) continue
    const t = tables[0]
    if (!t.rows || t.rows.length === 0) continue
    // Last row = 合計, last column = 平均来店サイクル
    const lastRow = t.rows[t.rows.length - 1]
    if (!lastRow) continue
    const totalIdx = t.headers.findIndex((h) => h.includes('合計'))
    const cycleIdx = t.headers.findIndex((h) => h.includes('平均来店サイクル'))
    const totalCount = parseInt((lastRow[totalIdx] || '0').replace(/[^0-9]/g, '')) || 0
    const avgCycle = parseFloat((lastRow[cycleIdx] || '0').replace(/[^0-9.]/g, '')) || 0
    if (totalCount > 0 && avgCycle > 0) {
      cycleWeightedSum += avgCycle * totalCount
      cycleWeightedCount += totalCount
    }
  }
  const avgCycleAll = cycleWeightedCount > 0 ? (cycleWeightedSum / cycleWeightedCount).toFixed(1) : '—'

  // === 顧客集計 (latest day) ===
  let totalKokyaku = 0, totalAppMembers = 0
  for (const s of data.user) {
    const tables = s.data?.tables as { headers: string[]; rows: string[][] }[] | undefined
    if (!tables || tables.length === 0) continue
    const t = tables[0]
    if (!t.rows || t.rows.length === 0) continue
    // Last row = latest date
    const lastRow = t.rows[t.rows.length - 1]
    if (!lastRow) continue
    const kokyakuIdx = t.headers.findIndex((h) => h.includes('顧客数'))
    const appIdx = t.headers.findIndex((h) => h.includes('アプリ会員数'))
    totalKokyaku += parseInt((lastRow[kokyakuIdx] || '0').replace(/[^0-9]/g, '')) || 0
    totalAppMembers += parseInt((lastRow[appIdx] || '0').replace(/[^0-9]/g, '')) || 0
  }
  const appRate = totalKokyaku > 0 ? ((totalAppMembers / totalKokyaku) * 100).toFixed(1) : '0'

  const noData = data.account.length === 0 && data.visitor.length === 0 && data.cycle.length === 0 && data.user.length === 0

  return (
    <div className="space-y-5">
      {/* Scrape button */}
      <ScrapeButton
        url="/api/scrape-analysis"
        label="全分析データ同期"
        onDone={fetchAll}
      />

      {loading ? (
        <div className="text-gray-400 text-base text-center py-10">読み込み中...</div>
      ) : noData ? (
        <div className="text-gray-500 text-base text-center py-10">
          分析データがありません。「全分析データ同期」を実行してください。
        </div>
      ) : (
        <div className="space-y-6">
          {/* 売上サマリー */}
          <Section title="売上">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Kpi label="純売上" value={`¥${sales.pureSales.toLocaleString()}`} />
              <Kpi label="総売上" value={`¥${sales.totalSales.toLocaleString()}`} />
              <Kpi label="客単価" value={`¥${sales.avgSpend.toLocaleString()}`} />
              <Kpi label="総客数" value={`${sales.totalCustomers.toLocaleString()}人`} />
              <Kpi label="指名売上" value={`¥${sales.namedSales.toLocaleString()}`} />
              <Kpi label="指名数" value={`${sales.namedCount.toLocaleString()}人`} />
            </div>
          </Section>

          {/* 来店客サマリー */}
          <Section title="来店客">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Kpi label="指名件数" value={`${visitorNominated.toLocaleString()}件`} />
              <Kpi label="フリー件数" value={`${visitorFree.toLocaleString()}件`} />
              <Kpi label="指名率" value={`${nominationRate}%`}
                valueColor={parseFloat(nominationRate) >= 85 ? 'text-green-400' : parseFloat(nominationRate) >= 70 ? 'text-blue-400' : 'text-yellow-400'} />
              <Kpi label="新規" value={`${visitorNew.toLocaleString()}人`} />
              <Kpi label="再来+固定+リターン" value={`${visitorRepeatTotal.toLocaleString()}人`} />
              <Kpi label="リピート率" value={`${repeatRate}%`}
                valueColor={parseFloat(repeatRate) >= 60 ? 'text-green-400' : parseFloat(repeatRate) >= 40 ? 'text-blue-400' : 'text-yellow-400'} />
            </div>
          </Section>

          {/* サイクル & 顧客 */}
          <Section title="顧客・サイクル">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Kpi label="平均来店サイクル" value={avgCycleAll === '—' ? '—' : `${avgCycleAll}日`} />
              <Kpi label="総顧客数" value={`${totalKokyaku.toLocaleString()}人`} />
              <Kpi label="アプリ会員数" value={`${totalAppMembers.toLocaleString()}人`} />
              <Kpi label="アプリ会員率" value={`${appRate}%`}
                valueColor={parseFloat(appRate) >= 50 ? 'text-green-400' : parseFloat(appRate) >= 30 ? 'text-blue-400' : 'text-yellow-400'} />
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h3 className="text-lg font-bold text-gray-100 mb-4">{title}</h3>
      {children}
    </div>
  )
}

function Kpi({ label, value, valueColor = 'text-white' }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="bg-gray-900/50 rounded-lg p-4">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
    </div>
  )
}
