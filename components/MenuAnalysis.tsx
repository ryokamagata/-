'use client'

interface MenuData {
  menus: {
    name: string
    count: number
    sales: number
    ratio: number
  }[]
}

export default function MenuAnalysis({ stores }: { stores: { store: string; data: MenuData }[] }) {
  if (stores.length === 0) return <Empty />

  // Aggregate menus across stores
  const menuMap = new Map<string, { count: number; sales: number }>()
  for (const s of stores) {
    const menuList = Array.isArray(s.data?.menus) ? s.data.menus : []
    for (const m of menuList) {
      const prev = menuMap.get(m.name) || { count: 0, sales: 0 }
      menuMap.set(m.name, { count: prev.count + m.count, sales: prev.sales + m.sales })
    }
  }

  const sorted = Array.from(menuMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.sales - a.sales)

  const totalSales = sorted.reduce((s, m) => s + m.sales, 0)

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h3 className="text-base font-semibold text-gray-200 mb-4">メニュー別 売上ランキング</h3>
      <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
        {sorted.slice(0, 30).map((m, i) => {
          const pct = totalSales > 0 ? (m.sales / totalSales) * 100 : 0
          return (
            <div key={m.name} className="flex items-center gap-3 text-sm">
              <span className="text-gray-500 w-6 text-right shrink-0 font-medium">{i + 1}</span>
              <span className="text-gray-200 truncate flex-1">{m.name}</span>
              <span className="text-gray-400 shrink-0 w-16 text-right">{m.count}件</span>
              <span className="text-gray-300 shrink-0 w-24 text-right font-medium">¥{m.sales.toLocaleString()}</span>
              <span className="text-gray-500 shrink-0 w-14 text-right">{pct.toFixed(1)}%</span>
            </div>
          )
        })}
        {sorted.length > 30 && (
          <p className="text-gray-500 text-sm text-center pt-2">他 {sorted.length - 30} メニュー</p>
        )}
      </div>
      <div className="mt-4 text-sm text-gray-400 text-right">合計: ¥{totalSales.toLocaleString()}</div>
    </div>
  )
}

function Empty() {
  return <p className="text-gray-500 text-base text-center py-10">メニュー分析データがありません。BM同期を実行してください。</p>
}
