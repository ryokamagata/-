'use client'

import { STORES } from '@/lib/stores'

export default function StoreBanner({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      {/* All stores banner */}
      <button
        onClick={() => onChange('all')}
        className={`w-full px-4 py-3 rounded-xl text-left font-bold text-base transition-all ${
          value === 'all'
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
        }`}
      >
        全店舗
        <span className={`text-sm font-normal ml-2 ${value === 'all' ? 'text-blue-200' : 'text-gray-500'}`}>
          ({STORES.length}店舗の合計)
        </span>
      </button>

      {/* Individual store cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {STORES.map((s) => {
          const isActive = value === s.bm_code
          // Shorten store name for display
          const shortName = s.name
            .replace(/^AI\s*TOKYO\s*/, '')
            .replace(/^AITOKYO\s*\+?\s*/, '')
            .replace(/^ams by AI TOKYO$/, 'ams')
            || s.name
          return (
            <button
              key={s.bm_code}
              onClick={() => onChange(s.bm_code)}
              className={`px-3 py-2.5 rounded-xl text-left transition-all truncate ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              <span className="text-sm font-medium block truncate">{shortName}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
