import { useCallback, useEffect, useState } from 'react'
import type { Draw, DrawsFile } from '../lib/draws'

export interface DrawsState {
  draws: Draw[]
  updatedAt: string | null
  loading: boolean
  error: string | null
  updating: boolean
  /** 개발 서버에서만 동작 (빌드 결과물에서는 404) */
  update: () => Promise<string>
}

async function load(): Promise<DrawsFile> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/draws.json?t=${Date.now()}`)
  if (!res.ok) throw new Error(`당첨번호 데이터를 불러오지 못했어요 (HTTP ${res.status})`)
  return res.json()
}

export function useDraws(): DrawsState {
  const [file, setFile] = useState<DrawsFile>({ updatedAt: null, draws: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    load()
      .then(setFile)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const update = useCallback(async () => {
    setUpdating(true)
    try {
      const res = await fetch('/api/update-draws', { method: 'POST' })
      if (res.status === 404) return '업데이트는 개발 서버(실행.cmd)에서만 가능해요.'
      const body = await res.json()
      if (!body.ok) return `업데이트 실패: ${body.error}`
      setFile(await load())
      setError(null)
      return body.added > 0 ? `${body.added}개 회차를 새로 받았어요.` : '이미 최신이에요.'
    } catch (e) {
      return `업데이트 실패: ${e instanceof Error ? e.message : e}`
    } finally {
      setUpdating(false)
    }
  }, [])

  return { draws: file.draws, updatedAt: file.updatedAt, loading, error, updating, update }
}
