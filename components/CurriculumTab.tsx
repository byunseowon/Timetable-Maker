'use client'
import { useState, useEffect } from 'react'
import { CurriculumItem } from '@/lib/types'
import EditableTable from './EditableTable'

export default function CurriculumTab() {
  const [curricula, setCurricula] = useState<Record<string, CurriculumItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null)

  const [newName, setNewName] = useState('')
  const [newItems, setNewItems] = useState<CurriculumItem[]>([])

  const [selected, setSelected] = useState('(선택 안함)')
  const [editName, setEditName] = useState('')
  const [editItems, setEditItems] = useState<CurriculumItem[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/curricula')
    const data = await res.json()
    if (!data.error) setCurricula(data)
    setLoading(false)
  }

  const flash = (text: string, type: 'ok' | 'err' = 'ok') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 3000) }

  const persist = async (updated: Record<string, CurriculumItem[]>) => {
    setSaving(true)
    const res = await fetch('/api/curricula', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
    const data = await res.json()
    if (data.error) flash(`저장 실패: ${data.error}`, 'err')
    else { setCurricula(updated); flash('저장 완료') }
    setSaving(false)
  }

  const addNew = async () => {
    if (!newName.trim()) { flash('트랙명을 입력해주세요.', 'err'); return }
    const cleaned = newItems.filter((r) => r.subject.trim()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    await persist({ ...curricula, [newName.trim()]: cleaned })
    setNewName(''); setNewItems([])
  }

  const saveEdit = async () => {
    if (!editName.trim()) { flash('트랙명을 입력해주세요.', 'err'); return }
    const cleaned = editItems.filter((r) => r.subject.trim()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const updated = { ...curricula }
    if (selected !== editName.trim()) delete updated[selected]
    updated[editName.trim()] = cleaned
    await persist(updated)
    setSelected(editName.trim())
  }

  const deleteTrack = async () => {
    const updated = { ...curricula }; delete updated[selected]
    await persist(updated)
    setSelected('(선택 안함)'); setConfirmDelete(false)
  }

  const onSelect = (name: string) => {
    setSelected(name); setConfirmDelete(false)
    if (name !== '(선택 안함)') { setEditName(name); setEditItems((curricula[name] || []).map((c, i) => ({ ...c, order: c.order ?? i + 1 }))) }
  }

  const totalH = (items: CurriculumItem[]) => items.reduce((s, c) => s + (c.hours || 0), 0)

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {msg.text}
        </div>
      )}

      {/* 새 커리큘럼 */}
      <div className="card space-y-4">
        <h2 className="section-title">새 커리큘럼 추가</h2>
        <div>
          <label className="label">트랙명</label>
          <input type="text" className="input" placeholder="예: Unreal 7기" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </div>
        <EditableTable value={newItems} onChange={setNewItems} />
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-gray-400">총 <span className="text-gray-700 font-medium">{totalH(newItems)}</span>시간</span>
          <button className="btn-primary" onClick={addNew} disabled={saving}>{saving ? '저장 중...' : '커리큘럼 저장'}</button>
        </div>
      </div>

      {/* 저장된 편집 */}
      {loading ? (
        <div className="text-sm text-gray-300 text-center py-8">불러오는 중...</div>
      ) : Object.keys(curricula).length > 0 ? (
        <div className="card space-y-4">
          <h2 className="section-title">저장된 커리큘럼 편집</h2>
          <div>
            <label className="label">트랙 선택</label>
            <select className="input" value={selected} onChange={(e) => onSelect(e.target.value)}>
              <option>(선택 안함)</option>
              {Object.keys(curricula).map((k) => <option key={k}>{k}</option>)}
            </select>
          </div>

          {selected !== '(선택 안함)' && (
            <>
              <div>
                <label className="label">트랙명</label>
                <input type="text" className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <EditableTable value={editItems} onChange={setEditItems} />
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm text-gray-400">총 <span className="text-gray-700 font-medium">{totalH(editItems)}</span>시간</span>
                <div className="flex gap-2">
                  {confirmDelete ? (
                    <>
                      <span className="text-sm text-red-500 self-center">정말 삭제할까요?</span>
                      <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>취소</button>
                      <button className="btn-danger" onClick={deleteTrack} disabled={saving}>삭제 확인</button>
                    </>
                  ) : (
                    <>
                      <button className="btn-danger" onClick={() => setConfirmDelete(true)}>삭제</button>
                      <button className="btn-primary" onClick={saveEdit} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
