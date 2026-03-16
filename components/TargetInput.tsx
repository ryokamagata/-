'use client'

import { useState } from 'react'

export default function TargetInput({
  year,
  month,
  currentTarget,
  onSaved,
}: {
  year: number
  month: number
  currentTarget: number | null
  onSaved: () => void
}) {
  const [value, setValue] = useState(
    currentTarget ? currentTarget.toLocaleString() : ''
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    const target = parseInt(value.replace(/[,¥\s]/g, ''))
    if (isNaN(target) || target <= 0) return

    setSaving(true)
    try {
      await fetch('/api/target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, target }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 text-sm whitespace-nowrap">月次目標</span>
      <span className="text-gray-500 text-sm">¥</span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="5,000,000"
        className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-white text-sm
                   w-32 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      <button
        onClick={save}
        disabled={saving}
        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm
                   px-3 py-1.5 rounded transition-colors whitespace-nowrap"
      >
        {saving ? '保存中' : saved ? '保存済み' : '保存'}
      </button>
    </div>
  )
}
