// 동행복권에서 로또 6/45 회차별 당첨 결과를 받아 public/data/draws.json 에 누적 저장한다.
// 이미 저장된 회차는 건너뛰고, 새 회차만 받는다.
//
// 사용처
//   - node scripts/fetch-draws.mjs          (CLI, 매주 예약 작업)
//   - vite 개발 서버의 POST /api/update-draws (화면의 "지금 업데이트" 버튼)

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const DATA_FILE = resolve(ROOT, 'public', 'data', 'draws.json')

// 2025년 사이트 개편 이후 주소. 예전 common.do?method=getLottoNumber 는 메인 페이지로 넘어간다.
const API = 'https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do'
const CHUNK = 100
const RETRIES = 3

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchRange(from, to) {
  const url = `${API}?srchStrLtEpsd=${from}&srchEndLtEpsd=${to}`
  let lastErr
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; lotto-data-bot)', Accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      let json
      try {
        json = JSON.parse(text)
      } catch {
        throw new Error('JSON이 아닌 응답을 받았습니다. 동행복권 주소가 바뀌었거나 접근이 차단됐을 수 있습니다.')
      }
      return json?.data?.list ?? []
    } catch (e) {
      lastErr = e
      if (attempt < RETRIES) await sleep(2000 * attempt)
    }
  }
  throw lastErr
}

function toDraw(d) {
  const ymd = String(d.ltRflYmd)
  const draw = {
    round: Number(d.ltEpsd),
    date: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`,
    numbers: [d.tm1WnNo, d.tm2WnNo, d.tm3WnNo, d.tm4WnNo, d.tm5WnNo, d.tm6WnNo].map(Number).sort((a, b) => a - b),
    bonus: Number(d.bnsWnNo),
    // 1~5등 1게임당 당첨금 / 당첨 게임 수
    prize: [d.rnk1WnAmt, d.rnk2WnAmt, d.rnk3WnAmt, d.rnk4WnAmt, d.rnk5WnAmt].map(Number),
    winners: [d.rnk1WnNope, d.rnk2WnNope, d.rnk3WnNope, d.rnk4WnNope, d.rnk5WnNope].map(Number),
    // 1등 당첨자 구입 방식: [자동, 수동, 반자동]
    firstType: [d.winType1, d.winType2, d.winType3].map((x) => Number(x) || 0),
    sales: Number(d.wholEpsdSumNtslAmt),
  }
  const all = [...draw.numbers, draw.bonus]
  if (all.some((n) => !Number.isInteger(n) || n < 1 || n > 45) || new Set(all).size !== 7) {
    throw new Error(`${draw.round}회 번호가 올바르지 않습니다: ${all.join(',')}`)
  }
  return draw
}

export async function readDrawsFile() {
  try {
    return JSON.parse(await readFile(DATA_FILE, 'utf8'))
  } catch {
    return { updatedAt: null, draws: [] }
  }
}

/** @returns {Promise<{ added: number, latest: number, updatedAt: string }>} */
export async function updateDraws({ log = () => {} } = {}) {
  const file = await readDrawsFile()
  const byRound = new Map(file.draws.map((d) => [d.round, d]))
  // 필드가 추가된 뒤 처음 실행이면 전체를 다시 받는다
  const backfill = file.draws.some((d) => !d.firstType)
  let next = file.draws.length && !backfill ? Math.max(...byRound.keys()) + 1 : 1
  let added = 0

  // 아직 추첨하지 않은 회차는 결과에 빠지므로, 빈 구간이 나오면 끝
  for (;;) {
    const list = await fetchRange(next, next + CHUNK - 1)
    if (list.length === 0) break
    for (const raw of list) {
      const d = toDraw(raw)
      if (!byRound.has(d.round)) added++
      byRound.set(d.round, d)
    }
    log(`  ${next}~${next + CHUNK - 1}회: ${list.length}건`)
    if (list.length < CHUNK) break
    next += CHUNK
    await sleep(300) // 서버에 부담 주지 않게
  }

  const draws = [...byRound.values()].sort((a, b) => a.round - b.round)
  draws.forEach((d, i) => {
    if (d.round !== i + 1) throw new Error(`${i + 1}회가 빠져 있습니다.`)
  })

  // 바뀐 게 없으면 파일을 건드리지 않는다 (매주 빈 커밋 방지)
  if (added === 0 && !backfill) {
    return { added, latest: draws.at(-1)?.round ?? 0, updatedAt: file.updatedAt }
  }

  const updatedAt = new Date().toISOString()
  await mkdir(dirname(DATA_FILE), { recursive: true })
  // 회차당 한 줄 — git diff 가 깔끔하도록
  const body = `{"updatedAt":${JSON.stringify(updatedAt)},"draws":[\n${draws.map((d) => JSON.stringify(d)).join(',\n')}\n]}\n`
  await writeFile(DATA_FILE, body, 'utf8')
  return { added, latest: draws.at(-1)?.round ?? 0, updatedAt }
}
