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
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [sheetTabs, setSheetTabs] = useState<string[] | null>(null)
  const [selectedTab, setSelectedTab] = useState('')
  const [officeModal, setOfficeModal] = useState(false)

  const [selected, setSelected] = useState('(선택 안함)')
  const [editName, setEditName] = useState('')
  const [editItems, setEditItems] = useState<CurriculumItem[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/curricula')
    const data = await res.json()
    if (data.error) flash(`로드 실패: ${data.error}`, 'err')
    else setCurricula(data)
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

  const fetchTabs = async () => {
    if (!importUrl.trim()) { flash('시간표 URL을 입력해주세요.', 'err'); return }
    setImporting(true)
    setSheetTabs(null)
    setSelectedTab('')
    const res = await fetch('/api/sheet-tabs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetUrl: importUrl.trim() }) })
    const data = await res.json()
    if (data.error) {
      if (data.error.includes('Office') || data.error.includes('not supported for this document')) {
        setOfficeModal(true)
      } else {
        flash(`오류: ${data.error}`, 'err')
      }
    } else if (data.titles?.length === 1) {
      await doImport(importUrl.trim(), data.titles[0])
    } else {
      setSheetTabs(data.titles)
      setSelectedTab(data.titles[0])
    }
    setImporting(false)
  }

  const doImport = async (url: string, tabName: string) => {
    setImporting(true)
    const res = await fetch('/api/parse-sheet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetUrl: url, sheetName: tabName }) })
    const data = await res.json()
    if (data.error) {
      if (data.error.includes('Office') || data.error.includes('not supported for this document')) {
        setOfficeModal(true)
      } else {
        flash(`불러오기 실패: ${data.error}`, 'err')
      }
    } else {
      const items: CurriculumItem[] = data.items.map((it: { subject: string; hours: number }, i: number) => ({ ...it, order: i + 1 }))
      setNewItems(items)
      setImportUrl('')
      setSheetTabs(null)
      flash(`${items.length}개 과목 불러오기 완료`)
    }
    setImporting(false)
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
      {officeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Office 파일은 지원되지 않습니다</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              입력한 URL은 <span className="font-medium">.xlsx 형식</span>의 Office 파일입니다. Google Sheets API는 네이티브 구글 스프레드시트만 읽을 수 있습니다.
            </p>
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 space-y-1">
              <p className="font-medium">해결 방법</p>
              <p>Google Drive에서 해당 파일을 열고</p>
              <p><span className="font-medium">메뉴 → Google Sheets로 저장</span>을 선택한 뒤, 새로 만들어진 구글 시트 URL을 입력해주세요.</p>
            </div>
            <button className="btn-primary w-full" onClick={() => setOfficeModal(false)}>확인</button>
          </div>
        </div>
      )}
      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {msg.text}
        </div>
      )}

      {/* 새 커리큘럼 */}
      <div className="card space-y-4">
        <h2 className="section-title">새 커리큘럼 추가</h2>
        <div>
          <label className="label">기존 시간표에서 불러오기 <span className="text-gray-300 font-normal">(선택)</span></label>
          <div className="flex gap-2">
            <input type="text" className="input" placeholder="구글 시트 URL" value={importUrl} onChange={(e) => { setImportUrl(e.target.value); setSheetTabs(null) }} />
            <button className="btn-secondary whitespace-nowrap" onClick={fetchTabs} disabled={importing}>{importing ? '읽는 중...' : '불러오기'}</button>
          </div>
          {sheetTabs && sheetTabs.length > 1 && (
            <div className="flex gap-2 mt-2">
              <select className="input" value={selectedTab} onChange={(e) => setSelectedTab(e.target.value)}>
                {sheetTabs.map((t) => <option key={t}>{t}</option>)}
              </select>
              <button className="btn-primary whitespace-nowrap" onClick={() => doImport(importUrl.trim(), selectedTab)} disabled={importing}>이 시트 불러오기</button>
            </div>
          )}
          <p className="text-xs text-gray-300 mt-1">구글 시트 URL을 붙여넣으면 과목별 시수를 자동으로 읽어옵니다.</p>
        </div>
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
