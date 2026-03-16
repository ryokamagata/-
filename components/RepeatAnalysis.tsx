'use client'

interface RepeatData {
  baseMonth: string
  categories: {
    type: string
    count: number
    ratio: number
    months: { month: number; rate: number }[]
  }[]
}

const TYPE_COLORS: Record<string, string> = {
  '新規': 'text-green-400',
  '再来': 'text-blue-400',
  '固定': 'text-purple-400',
  'リターン': 'text-yellow-400',
}

export default function RepeatAnalysis({ stores }: { stores: { store: string; data: RepeatData }[] }) {
  if (stores.length === 0) return <Empty />

  return (
    <div className="space-y-4">
      {stores.map((s) => (
        <div key={s.store} className="bg-gray-800 rounded-xl p-5">
          <h3 className="text-base font-semibold text-gray-200 mb-4">
            {stores.length > 1 ? s.store : 'リピート分析'}
            {s.data.baseMonth && (
              <span className="text-gray-500 text-sm ml-2">({s.data.baseMonth})</span>
            )}
          </h3>
          {(!Array.isArray(s.data?.categories) || s.data.categories.length === 0) ? (
            <p className="text-gray-500 text-sm">データなし</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2 pr-4 font-medium">区分</th>
                    <th className="text-right py-2 px-3 font-medium">人数</th>
                    <th className="text-right py-2 px-3 font-medium">構成比</th>
                    {s.data.categories[0]?.months.map((m) => (
                      <th key={m.month} className="text-right py-2 px-3 font-medium">{m.month}ヶ月後</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.data.categories.map((cat) => (
                    <tr key={cat.type} className="border-b border-gray-700/50">
                      <td className={`py-2.5 pr-4 font-semibold ${TYPE_COLORS[cat.type] ?? 'text-gray-200'}`}>
                        {cat.type}
                      </td>
                      <td className="text-right py-2.5 px-3 text-gray-200">{cat.count}</td>
                      <td className="text-right py-2.5 px-3 text-gray-400">{cat.ratio}%</td>
                      {cat.months.map((m) => (
                        <td key={m.month} className="text-right py-2.5 px-3">
                          <span className={m.rate >= 50 ? 'text-green-400 font-medium' : m.rate >= 30 ? 'text-yellow-400' : 'text-gray-400'}>
                            {m.rate}%
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Empty() {
  return <p className="text-gray-500 text-base text-center py-10">リピート分析データがありません。BM同期を実行してください。</p>
}
