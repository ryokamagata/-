'use client'

import { useState, useCallback, useRef } from 'react'

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error' | 'duplicate'

export default function UploadZone({ onSuccess }: { onSuccess: () => void }) {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [message, setMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setStatus('uploading')
      setMessage('')

      const form = new FormData()
      form.append('file', file)

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: form })
        const json = await res.json()

        if (!res.ok) {
          setStatus('error')
          setMessage(json.error ?? 'アップロードに失敗しました')
        } else if (json.duplicate) {
          setStatus('duplicate')
          setMessage('このファイルは既にインポート済みです')
        } else {
          setStatus('done')
          setMessage(`${json.imported.toLocaleString()}件のデータを取り込みました`)
          onSuccess()
        }
      } catch {
        setStatus('error')
        setMessage('通信エラーが発生しました')
      }
    },
    [onSuccess]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const statusConfig = {
    idle: { text: 'BMのCSVをここにドロップ、またはクリックして選択', color: 'text-gray-400', border: 'border-gray-600 hover:border-blue-500' },
    uploading: { text: 'アップロード中...', color: 'text-blue-400', border: 'border-blue-500' },
    done: { text: message, color: 'text-green-400', border: 'border-green-500' },
    duplicate: { text: message, color: 'text-yellow-400', border: 'border-yellow-500' },
    error: { text: message, color: 'text-red-400', border: 'border-red-500' },
  }

  const config = statusConfig[status]

  return (
    <div>
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${config.border}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
        <div className="flex flex-col items-center gap-2">
          {status === 'uploading' ? (
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className={`w-8 h-8 ${config.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          )}
          <p className={`text-sm ${config.color}`}>{config.text}</p>
          {status !== 'idle' && status !== 'uploading' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setStatus('idle')
              }}
              className="text-xs text-gray-500 hover:text-gray-300 underline"
            >
              別のファイルを選択
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
