// Shared store list (used by both server and client code)
export const STORES = [
  { name: 'AI TOKYO 渋谷', bm_code: '69110375' },
  { name: 'AI TOKYO Rita', bm_code: '11780846' },
  { name: 'AI TOKYO S', bm_code: '12479835' },
  { name: 'AI TOKYO 名古屋栄', bm_code: '28162229' },
  { name: "AI TOKYO men's 横浜", bm_code: '31132259' },
  { name: "AI TOKYO Ciel men's 横浜", bm_code: '27468498' },
  { name: "AI TOKYO men's 下北沢", bm_code: '46641695' },
  { name: "AI TOKYO men's 池袋", bm_code: '63811270' },
  { name: 'ams by AI TOKYO', bm_code: '94303402' },
  { name: 'AI TOKYO 名古屋 2nd', bm_code: '65211838' },
  { name: 'AITOKYO + Sea店 横浜', bm_code: '73245379' },
] as const

// 閉店済み店舗（グレー表示・末尾配置）
export const CLOSED_STORES: string[] = [
  '福岡',
]

export function isClosedStore(storeName: string): boolean {
  return CLOSED_STORES.some(keyword => storeName.includes(keyword))
}
