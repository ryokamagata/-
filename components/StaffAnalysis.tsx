'use client'

interface StylistData {
  staff: {
    name: string
    sales: number
    customers: number
    avgSpend: number
  }[]
}

export default function StaffAnalysis({ stores }: { stores: { store: string; data: StylistData }[] }) {
  if (stores.length === 0) return <Empty />

  // Merge all staff across stores
  const staffMap = new Map<string, { name: string; sales: number; customers: number; store: string }>()
  for (const s of stores) {
    const staffList = Array.isArray(s.data?.staff) ? s.data.staff : []
    for (const st of staffList) {
      const key = `${s.store}::${st.name}`
      staffMap.set(key, {
        name: st.name,
        sales: st.sales,
        customers: st.customers,
        store: s.store,
      })
    }
  }

  const allStaff = Array.from(staffMap.values()).sort((a, b) => b.sales - a.sales)
  const maxSales = allStaff.length > 0 ? allStaff[0].sales : 1

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h3 className="text-base font-semibold text-gray-200 mb-4">スタッフ別 パフォーマンス</h3>
      <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
        {allStaff.slice(0, 30).map((st, i) => {
          const pct = maxSales > 0 ? (st.sales / maxSales) * 100 : 0
          const avgSpend = st.customers > 0 ? Math.round(st.sales / st.customers) : 0
          return (
            <div key={`${st.store}-${st.name}`} className="flex items-center gap-3 text-sm">
              <span className="text-gray-500 w-6 text-right shrink-0 font-medium">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <span className="text-gray-200 truncate block font-medium">{st.name}</span>
                {stores.length > 1 && (
                  <span className="text-gray-500 text-xs truncate block">{st.store}</span>
                )}
              </div>
              <span className="text-gray-300 shrink-0 text-right w-24 font-medium">
                ¥{st.sales.toLocaleString()}
              </span>
              <span className="text-gray-400 shrink-0 text-right w-14">
                {st.customers}人
              </span>
              <span className="text-gray-400 shrink-0 text-right w-20">
                @¥{avgSpend.toLocaleString()}
              </span>
              <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden shrink-0">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
        {allStaff.length > 30 && (
          <p className="text-gray-500 text-sm text-center pt-2">他 {allStaff.length - 30} 名</p>
        )}
      </div>
    </div>
  )
}

function Empty() {
  return <p className="text-gray-500 text-base text-center py-10">スタッフ分析データがありません。BM同期を実行してください。</p>
}
