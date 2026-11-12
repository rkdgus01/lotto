import { useEffect, useState } from 'react'
import LatestDraw from './components/LatestDraw'
import GenerateView from './components/GenerateView'
import StatsView from './components/StatsView'
import CheckView from './components/CheckView'
import SimulatorView from './components/SimulatorView'
import PopularityView from './components/PopularityView'
import type { HistoryEntry } from './components/History'
import { useDraws } from './hooks/useDraws'
import type { StatRangeId } from './lib/draws'
import type { Ticket } from './lib/lotto'

const HISTORY_KEY = 'lotto.history.v1'
const HISTORY_LIMIT = 30
const TAB_KEY = 'lotto.tab'

const TABS = [
  { id: 'generate', label: '번호 생성' },
  { id: 'stats', label: '당첨 통계' },
  { id: 'popular', label: '인기 분석' },
  { id: 'check', label: '당첨 확인' },
  { id: 'sim', label: '시뮬레이터' },
] as const
type TabId = (typeof TABS)[number]['id']

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : []
  } catch {
    return []
  }
}

function loadTab(): TabId {
  try {
    const t = localStorage.getItem(TAB_KEY)
    if (TABS.some((x) => x.id === t)) return t as TabId
  } catch {
    /* 무시 */
  }
  return 'generate'
}

export default function App() {
  const drawsState = useDraws()
  const [tab, setTab] = useState<TabId>(loadTab)
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory)
  // 통계 기준 — 통계 탭과 생성기의 가중치가 같은 값을 쓴다
  const [range, setRange] = useState<StatRangeId>('all')
  const [includeBonus, setIncludeBonus] = useState(true)

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    } catch {
      /* 저장 불가 환경 */
    }
  }, [history])

  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, tab)
    } catch {
      /* 무시 */
    }
  }, [tab])

  const onGenerated = (tickets: Ticket[]) =>
    setHistory((h) => [{ id: crypto.randomUUID(), at: Date.now(), tickets }, ...h].slice(0, HISTORY_LIMIT))

  const { draws } = drawsState

  return (
    <main className="app">
      <header className="app__head">
        <h1>로또 번호 생성기</h1>
        <p>6/45 · 매주 당첨번호 자동 수집</p>
      </header>

      <LatestDraw state={drawsState} />

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'generate' && <GenerateView draws={draws} range={range} includeBonus={includeBonus} onGenerated={onGenerated} />}
      {tab === 'stats' && (
        <StatsView draws={draws} range={range} onRange={setRange} includeBonus={includeBonus} onIncludeBonus={setIncludeBonus} />
      )}
      {tab === 'popular' && <PopularityView draws={draws} />}
      {tab === 'check' && <CheckView draws={draws} history={history} onClearHistory={() => setHistory([])} />}
      {tab === 'sim' && <SimulatorView draws={draws} />}

      <footer className="app__foot">재미로 즐기세요. 로또는 기대값이 마이너스인 게임입니다.</footer>
    </main>
  )
}
