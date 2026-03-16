'use client'

export default function StaffBreakdown({
  data,
  total,
}: {
  data: { staff: string; sales: number }[]
  total: number
}) {
  if (data.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-4">データがありません</p>
  }

  const top = data.slice(0, 15) // 上位15名まで表示

  return (
    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
      {top.map(({ staff, sales }, i) => {
        const pct = total > 0 ? (sales / total) * 100 : 0
        return (
          <div key={staff} className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 w-5 text-right shrink-0">{i + 1}</span>
            <span className="text-gray-300 truncate flex-1">{staff}</span>
            <span className="text-gray-400 shrink-0">
              ¥{sales.toLocaleString()}
            </span>
            <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden shrink-0">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
      {data.length > 15 && (
        <p className="text-gray-600 text-xs text-center pt-1">他 {data.length - 15} 名</p>
      )}
    </div>
  )
}
