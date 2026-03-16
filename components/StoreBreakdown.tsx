'use client'

const COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-yellow-500',
  'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500',
]

export default function StoreBreakdown({
  data,
  total,
}: {
  data: { store: string; sales: number }[]
  total: number
}) {
  if (data.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-4">データがありません</p>
  }

  return (
    <div className="space-y-2.5">
      {data.map(({ store, sales }, i) => {
        const pct = total > 0 ? (sales / total) * 100 : 0
        const color = COLORS[i % COLORS.length]
        return (
          <div key={store}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-300 truncate max-w-[60%]">{store}</span>
              <span className="text-gray-400">
                ¥{sales.toLocaleString()} ({pct.toFixed(1)}%)
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${color} transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
