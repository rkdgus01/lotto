// 동행복권 로또 용지 QR 해석
//
// 예: http://qr.dhlottery.co.kr/?v=1246q081014224044m010209212739n000000000000...0123456789
//   v= 뒤: 회차 4자리 + [영문 1글자 + 두 자리 번호 6개] × 최대 5 + 용지 고유번호
//   영문: q=자동, m=수동, s=반자동, n=빈 칸
import { MAX, PICK, type Ticket } from './lotto'

export type BuyType = 'auto' | 'manual' | 'semi'

export interface QrTicket {
  round: number
  games: { type: BuyType; numbers: Ticket }[]
  key: string // 같은 용지를 두 번 등록하지 않기 위한 값 (v 원문)
}

const TYPE: Record<string, BuyType> = { q: 'auto', m: 'manual', s: 'semi' }

export function parseLottoQr(text: string): QrTicket | string {
  let v: string | null = null
  try {
    const url = new URL(text.trim())
    if (!/(^|\.)dhlottery\.co\.kr$/.test(url.hostname)) return '동행복권 로또 QR이 아니에요.'
    v = url.searchParams.get('v')
  } catch {
    // URL 이 아니면 v 값만 붙여 넣은 경우로 본다
    v = /^\d{4}[qmsn]/.test(text.trim()) ? text.trim() : null
  }
  if (!v || !/^\d{4}/.test(v)) return '로또 용지 QR 형식이 아니에요.'

  const round = Number(v.slice(0, 4))
  const games: QrTicket['games'] = []
  let pos = 4
  while (pos < v.length && /[qmsn]/.test(v[pos])) {
    const letter = v[pos]
    const digits = v.slice(pos + 1, pos + 13)
    pos += 13
    if (letter === 'n') continue
    if (!/^\d{12}$/.test(digits)) return 'QR의 번호 부분이 손상됐어요.'
    const numbers = (digits.match(/\d\d/g) ?? []).map(Number)
    if (numbers.length !== PICK || numbers.some((n) => n < 1 || n > MAX) || new Set(numbers).size !== PICK) {
      return 'QR의 번호가 올바르지 않아요.'
    }
    games.push({ type: TYPE[letter], numbers: numbers.sort((a, b) => a - b) })
  }
  if (games.length === 0) return 'QR에서 게임을 찾지 못했어요.'
  return { round, games, key: v }
}
