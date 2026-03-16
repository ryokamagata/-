import { Suspense } from 'react'
import Dashboard from './Dashboard'

export default function Home() {
  return (
    <Suspense fallback={<Loading />}>
      <Dashboard />
    </Suspense>
  )
}

function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-gray-400 text-sm">読み込み中...</div>
    </div>
  )
}
