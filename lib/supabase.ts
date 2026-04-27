import { createClient } from '@supabase/supabase-js'
import { CurriculumItem } from './types'

function getClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.')
  return createClient(url, key)
}

export async function loadCurriculaFromSupabase(): Promise<Record<string, CurriculumItem[]>> {
  const sb = getClient()
  const { data, error } = await sb.from('curricula').select('track, items')
  if (error) throw new Error(error.message)
  const result: Record<string, CurriculumItem[]> = {}
  for (const row of data ?? []) {
    result[row.track] = row.items ?? []
  }
  return result
}

export async function saveCurriculaToSupabase(data: Record<string, CurriculumItem[]>) {
  const sb = getClient()

  // 현재 저장된 트랙 목록 가져오기
  const { data: existing, error: fetchErr } = await sb.from('curricula').select('track')
  if (fetchErr) throw new Error(fetchErr.message)

  const existingTracks = new Set((existing ?? []).map((r: { track: string }) => r.track))
  const newTracks = new Set(Object.keys(data))

  // 삭제된 트랙 제거
  const toDelete = Array.from(existingTracks).filter((t) => !newTracks.has(t))
  if (toDelete.length > 0) {
    const { error } = await sb.from('curricula').delete().in('track', toDelete)
    if (error) throw new Error(error.message)
  }

  // upsert
  const rows = Object.entries(data).map(([track, items]) => ({
    track,
    items,
    updated_at: new Date().toISOString(),
  }))
  if (rows.length > 0) {
    const { error } = await sb.from('curricula').upsert(rows, { onConflict: 'track' })
    if (error) throw new Error(error.message)
  }
}
