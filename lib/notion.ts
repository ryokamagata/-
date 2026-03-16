import { Client } from '@notionhq/client'

// Notion DB IDs
export const SALES_DB_ID = '9d04a886904144ae859b949d634419b0'
export const KPI_DB_ID = '2afa452b1aab8099b4b9c5e88d542aab'

export type SalesRecord = {
  id: string
  title: string
  date: string
  store: string
  leader: string
  customers: number
  totalSales: number
  cashIn: number
  wigPurchases: number
}

export type DailySummary = {
  date: string
  totalSales: number
  stores: { store: string; sales: number }[]
}

let _notion: Client | null = null
function getNotion() {
  if (!_notion) {
    _notion = new Client({ auth: process.env.NOTION_TOKEN })
  }
  return _notion
}

export async function fetchMonthlySales(year: number, month: number): Promise<SalesRecord[]> {
  const notion = getNotion()
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`

  const response = await notion.databases.query({
    database_id: SALES_DB_ID,
    filter: {
      and: [
        { property: '日付', date: { on_or_after: startDate } },
        { property: '日付', date: { on_or_before: endDate } },
      ],
    },
    sorts: [{ property: '日付', direction: 'ascending' }],
  })

  return response.results.map((page: any) => ({
    id: page.id,
    title: page.properties['店舗・日付']?.title?.[0]?.plain_text ?? '',
    date: page.properties['日付']?.date?.start ?? '',
    store: page.properties['店舗']?.select?.name ?? '',
    leader: page.properties['リーダー名']?.rich_text?.[0]?.plain_text ?? '',
    customers: page.properties['客数']?.number ?? 0,
    totalSales: page.properties['合計売上']?.number ?? 0,
    cashIn: page.properties['現金入金']?.number ?? 0,
    wigPurchases: page.properties['ウィッグ購入数']?.number ?? 0,
  }))
}

export async function fetchMonthlyTarget(year: number, month: number): Promise<number | null> {
  const notion = getNotion()
  const monthLabel = `${year}年${month}月`

  const response = await notion.databases.query({
    database_id: KPI_DB_ID,
    filter: { property: '月', title: { contains: `${month}月` } },
  })

  const page = response.results[0] as any
  if (!page) return null

  return page.properties['売上目標']?.number ?? null
}
