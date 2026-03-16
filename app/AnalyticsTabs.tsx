'use client'

import { useCallback, useEffect, useState } from 'react'
import ScrapeButton from '@/components/ScrapeButton'
import SalesAnalysis from '@/components/SalesAnalysis'
import GenericAnalysis from '@/components/GenericAnalysis'
import type { AnalysisType } from '@/lib/analysisTypes'

const TABS: { key: AnalysisType; label: string }[] = [
  { key: 'account', label: '売上' },
  { key: 'visitor', label: '来店客' },
  { key: 'cycle', label: 'サイクル' },
  { key: 'user', label: '顧客' },
]

interface StoreData {
  bm_code: string
  store: string
  data: Record<string, unknown>
  scraped_at: string
}

export default function AnalyticsTabs({ year, month }: { year: number; month: number }) {
  const [activeTab, setActiveTab] = useState<AnalysisType>('account')
  const [stores, setStores] = useState<StoreData[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type: activeTab,
        year: String(year),
        month: String(month),
      })
      const res = await fetch(`/api/analysis?${params}`)
      const json = await res.json()
      setStores(json.stores ?? [])
    } catch {
      setStores([])
    } finally {
      setLoading(false)
    }
  }, [activeTab, year, month])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="space-y-5">
      {/* Scrape button with progress */}
      <ScrapeButton
        url="/api/scrape-analysis"
        label="全分析データ同期"
        onDone={fetchData}
      />

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-gray-400 text-base text-center py-10">読み込み中...</div>
      ) : (
        <AnalysisContent type={activeTab} stores={stores} />
      )}
    </div>
  )
}

function AnalysisContent({
  type,
  stores,
}: {
  type: AnalysisType
  stores: StoreData[]
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = stores.map((s) => ({ store: s.store, bm_code: s.bm_code, data: s.data as any }))

  switch (type) {
    case 'account':
      return <SalesAnalysis stores={data} />
    default: {
      const label = TABS.find((t) => t.key === type)?.label ?? type
      return <GenericAnalysis stores={data} label={label} />
    }
  }
}
