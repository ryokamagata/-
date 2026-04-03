'use client'

import { useEffect, useState } from 'react'

type ReportData = {
  year: number
  month: number
  dateLabel: string
  currentSales: number
  currentCustomers: number
  unitPrice: number
  prevUnitPrice: number
  monthTarget: number | null
  achievementRate: number | null
  momGrowth: number | null
  yoyGrowth: number | null
  ytdSales: number
  ytdCustomers: number
  annualTarget: number | null
  seatUtilization: number | null
  totalSeats: number
  stores: { store: string; sales: number; customers: number; unitPrice: number }[]
  topStaff: { name: string; sales: number }[]
  monthlyTrend: { month: number; sales: number; customers: number; unitPrice: number; target: number | null; rate: number | null }[]
}

function formatMan(n: number): string {
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(2)}億`
  return `${Math.round(n / 10_000).toLocaleString()}万円`
}

function formatYen(n: number): string {
  return `¥${n.toLocaleString()}`
}

export default function ReportPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/report')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>レポート生成中...</div>
  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: '#c00' }}>データ取得に失敗しました</div>

  return (
    <>
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 15mm; }
        }
        .report { font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #fff; color: #1a1a1a; font-size: 12px; line-height: 1.5; }
        .rpt-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 20px; }
        .rpt-header h1 { font-size: 22px; margin: 0; }
        .rpt-header .date { font-size: 14px; color: #666; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .kpi-card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; text-align: center; }
        .kpi-card .label { font-size: 10px; color: #888; margin-bottom: 4px; }
        .kpi-card .value { font-size: 20px; font-weight: bold; }
        .kpi-card .sub { font-size: 10px; color: #666; margin-top: 2px; }
        .section { margin-bottom: 16px; }
        .section h2 { font-size: 14px; border-left: 4px solid #2563eb; padding-left: 8px; margin: 0 0 8px; }
        .rpt-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .rpt-table th { background: #f5f5f5; text-align: left; padding: 6px 8px; border-bottom: 2px solid #ddd; font-weight: 600; }
        .rpt-table td { padding: 5px 8px; border-bottom: 1px solid #eee; }
        .rpt-table tr:hover { background: #fafafa; }
        .text-right { text-align: right; }
        .text-green { color: #16a34a; }
        .text-red { color: #dc2626; }
        .print-btn { position: fixed; bottom: 20px; right: 20px; background: #2563eb; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,.2); z-index: 100; }
        .print-btn:hover { background: #1d4ed8; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .highlight { background: #eff6ff; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
        .highlight p { margin: 4px 0; font-size: 11px; }
      `}</style>

      <button className="print-btn no-print" onClick={() => window.print()}>PDF出力 / 印刷</button>

      <div className="report">
        <div className="rpt-header">
          <h1>AITOKYO 月次経営レポート</h1>
          <div className="date">{data.year}年{data.month}月度（{data.dateLabel}）</div>
        </div>

        {/* KPIカード */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="label">月間売上</div>
            <div className="value">{formatMan(data.currentSales)}</div>
            <div className="sub">目標 {data.monthTarget ? formatMan(data.monthTarget) : '未設定'}</div>
          </div>
          <div className="kpi-card">
            <div className="label">達成率</div>
            <div className="value" style={{
              color: data.achievementRate && data.achievementRate >= 100 ? '#16a34a'
                : data.achievementRate && data.achievementRate >= 80 ? '#2563eb' : '#dc2626'
            }}>
              {data.achievementRate ? `${data.achievementRate}%` : '—'}
            </div>
            <div className="sub">{data.monthTarget ? `残 ${formatMan(Math.max(0, data.monthTarget - data.currentSales))}` : ''}</div>
          </div>
          <div className="kpi-card">
            <div className="label">客単価</div>
            <div className="value">{formatYen(data.unitPrice)}</div>
            <div className="sub">前月 {formatYen(data.prevUnitPrice)}</div>
          </div>
          <div className="kpi-card">
            <div className="label">席稼働率</div>
            <div className="value">{data.seatUtilization ? `${data.seatUtilization}%` : '—'}</div>
            <div className="sub">{data.totalSeats}席</div>
          </div>
        </div>

        {/* サマリー */}
        <div className="highlight">
          <p>
            <strong>前月比:</strong>{' '}
            {data.momGrowth !== null ? (
              <span className={data.momGrowth >= 0 ? 'text-green' : 'text-red'}>
                {data.momGrowth >= 0 ? '+' : ''}{data.momGrowth.toFixed(1)}%
              </span>
            ) : '—'}
            {' / '}
            <strong>前年同月比:</strong>{' '}
            {data.yoyGrowth !== null ? (
              <span className={data.yoyGrowth >= 0 ? 'text-green' : 'text-red'}>
                {data.yoyGrowth >= 0 ? '+' : ''}{data.yoyGrowth.toFixed(1)}%
              </span>
            ) : '—'}
          </p>
          <p>
            <strong>年間累計:</strong> {formatMan(data.ytdSales)}（客数 {data.ytdCustomers.toLocaleString()}人）
            / 年間目標 {data.annualTarget ? formatMan(data.annualTarget) : '未設定'}
            / 進捗 {data.annualTarget ? `${Math.round(data.ytdSales / data.annualTarget * 100)}%` : '—'}
          </p>
        </div>

        <div className="two-col">
          {/* 店舗別 */}
          <div className="section">
            <h2>店舗別売上</h2>
            <table className="rpt-table">
              <thead>
                <tr>
                  <th>店舗</th>
                  <th className="text-right">売上</th>
                  <th className="text-right">客数</th>
                  <th className="text-right">客単価</th>
                </tr>
              </thead>
              <tbody>
                {data.stores.map(s => (
                  <tr key={s.store}>
                    <td>{s.store}</td>
                    <td className="text-right">{formatMan(s.sales)}</td>
                    <td className="text-right">{s.customers}人</td>
                    <td className="text-right">{formatYen(s.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* スタッフTOP10 */}
          <div className="section">
            <h2>スタッフ売上 TOP10</h2>
            <table className="rpt-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>スタッフ</th>
                  <th className="text-right">売上</th>
                </tr>
              </thead>
              <tbody>
                {data.topStaff.map((s, i) => (
                  <tr key={s.name}>
                    <td>{i + 1}</td>
                    <td>{s.name}</td>
                    <td className="text-right">{formatMan(s.sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 月別推移 */}
        <div className="section">
          <h2>月別推移（{data.year}年）</h2>
          <table className="rpt-table">
            <thead>
              <tr>
                <th>月</th>
                <th className="text-right">売上</th>
                <th className="text-right">客数</th>
                <th className="text-right">客単価</th>
                <th className="text-right">目標</th>
                <th className="text-right">達成率</th>
              </tr>
            </thead>
            <tbody>
              {data.monthlyTrend.map(m => (
                <tr key={m.month}>
                  <td>{m.month}月</td>
                  <td className="text-right">{formatMan(m.sales)}</td>
                  <td className="text-right">{m.customers.toLocaleString()}人</td>
                  <td className="text-right">{formatYen(m.unitPrice)}</td>
                  <td className="text-right">{m.target ? formatMan(m.target) : '—'}</td>
                  <td className="text-right">
                    {m.rate !== null ? (
                      <span className={m.rate >= 100 ? 'text-green' : 'text-red'}>{m.rate}%</span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 10, color: '#999' }}>
          AITOKYO Sales Dashboard - Generated {new Date().toLocaleDateString('ja-JP')}
        </div>
      </div>
    </>
  )
}
