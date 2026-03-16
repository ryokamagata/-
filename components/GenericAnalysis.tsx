'use client'

interface GenericData {
  tables?: { headers: string[]; rows: string[][] }[]
  // Some types may have other shapes
  [key: string]: unknown
}

export default function GenericAnalysis({
  stores,
  label,
}: {
  stores: { store: string; data: GenericData }[]
  label: string
}) {
  if (stores.length === 0) {
    return (
      <p className="text-gray-500 text-base text-center py-10">
        {label}データがありません。BM同期を実行してください。
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {stores.map((s) => (
        <div key={s.store} className="bg-gray-800 rounded-xl p-5">
          {stores.length > 1 && (
            <h3 className="text-base font-semibold text-gray-200 mb-4">{s.store}</h3>
          )}
          {s.data.tables && s.data.tables.length > 0 ? (
            s.data.tables.map((table, ti) => (
              <div key={ti} className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  {table.headers.length > 0 && (
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-700">
                        {table.headers.map((h, hi) => (
                          <th key={hi} className="text-left py-2 px-3 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {table.rows.slice(0, 30).map((row, ri) => (
                      <tr key={ri} className="border-b border-gray-700/50">
                        {row.map((cell, ci) => (
                          <td key={ci} className="py-2 px-3 text-gray-200">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {table.rows.length > 30 && (
                  <p className="text-gray-500 text-sm text-center mt-3">他 {table.rows.length - 30} 行</p>
                )}
              </div>
            ))
          ) : (
            <pre className="text-gray-400 text-sm overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(s.data, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}
