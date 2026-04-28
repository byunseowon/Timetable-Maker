'use client'
import { useState } from 'react'
import { ScheduleConfig, CurriculumItem, ExtraHoliday, HolidayInfo } from '@/lib/types'
import { rowsToCsv } from '@/lib/timetable'
import EditableTable from './EditableTable'

const TIME_OPTIONS: string[] = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`)

interface State {
  startDate: string; dayStart: string; dayEnd: string
  breakTimes: string[]; numBreaks: number
  excludeWeekend: boolean; excludePublicHolidays: boolean
  extraHolidays: ExtraHoliday[]; curriculum: CurriculumItem[]
  headerColor: string; breakColor: string
}

export default function TimetableTab() {
  const [s, setS] = useState<State>({
    startDate: new Date().toISOString().slice(0, 10),
    dayStart: '09:00', dayEnd: '21:00',
    breakTimes: ['13:00', '18:00'], numBreaks: 2,
    excludeWeekend: true, excludePublicHolidays: true,
    extraHolidays: [], curriculum: [],
    headerColor: '#FFFACB', breakColor: '#EDEDED',
  })
  const update = (patch: Partial<State>) => { setS((p) => ({ ...p, ...patch })); resetPreview() }
  const resetPreview = () => { setPreviewDone(false); setHolidays(null) }

  const [savedCurricula, setSavedCurricula] = useState<Record<string, CurriculumItem[]> | null>(null)
  const [curLoading, setCurLoading] = useState(false)
  const [selectedCur, setSelectedCur] = useState('(직접 입력)')

  const [holidays, setHolidays] = useState<HolidayInfo[] | null>(null)
  const [ignoredHols, setIgnoredHols] = useState<Set<string>>(new Set())
  const [holLoading, setHolLoading] = useState(false)
  const [previewDone, setPreviewDone] = useState(false)

  const [generating, setGenerating] = useState(false)
  const [rows, setRows] = useState<string[][] | null>(null)
  const [endDate, setEndDate] = useState('')


  const [extraInput, setExtraInput] = useState({ date: '', reason: '' })
  const [colorOpen, setColorOpen] = useState(false)

  const buildCfg = (): ScheduleConfig => ({
    startDate: s.startDate, dayStart: s.dayStart, dayEnd: s.dayEnd,
    breakTimes: s.breakTimes.slice(0, s.numBreaks).map((bt) => [bt, `${String(parseInt(bt) + 1).padStart(2, '0')}:00`]),
    excludeWeekend: s.excludeWeekend, excludePublicHolidays: s.excludePublicHolidays,
    extraHolidays: s.extraHolidays, curriculum: s.curriculum,
  })

  const loadCurricula = async () => {
    setCurLoading(true)
    const res = await fetch('/api/curricula')
    const data = await res.json()
    if (!data.error) setSavedCurricula(data)
    setCurLoading(false)
  }

  const previewHolidays = async () => {
    if (!s.curriculum.some((c) => c.hours > 0)) { alert('커리큘럼 시수를 입력해주세요.'); return }
    setHolLoading(true)
    const res = await fetch('/api/holidays', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildCfg()) })
    const data = await res.json()
    if (!data.error) { setHolidays(data.holidays); setIgnoredHols(new Set()); setPreviewDone(true) }
    else alert(data.error)
    setHolLoading(false)
  }

  const generate = async () => {
    if (!s.curriculum.some((c) => c.hours > 0)) { alert('커리큘럼 시수를 입력해주세요.'); return }
    setGenerating(true); setRows(null)
    const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cfg: buildCfg(), ignoredPubHols: Array.from(ignoredHols) }) })
    const data = await res.json()
    if (!data.error) { setRows(data.rows); setEndDate(data.endDate); setPreviewDone(false) }
    else alert(data.error)
    setGenerating(false)
  }

  const downloadCsv = () => {
    if (!rows) return
    const blob = new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `시간표_${s.startDate}.csv`; a.click()
  }

const weekCount = rows ? rows.filter((r) => r[0].endsWith('주차') && r[3]?.endsWith('주차')).length : 0

  return (
    <div className="space-y-4">

      {/* 기본 설정 */}
      <div className="card space-y-5">
        <h2 className="section-title">기본 설정</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div><label className="label">개강일</label>
            <input type="date" className="input" value={s.startDate} onChange={(e) => update({ startDate: e.target.value })} /></div>
          <div><label className="label">수업 시작</label>
            <select className="input" value={s.dayStart} onChange={(e) => update({ dayStart: e.target.value })}>
              {TIME_OPTIONS.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label className="label">수업 종료</label>
            <select className="input" value={s.dayEnd} onChange={(e) => update({ dayEnd: e.target.value })}>
              {TIME_OPTIONS.map((t) => <option key={t}>{t}</option>)}</select></div>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-32"><label className="label">휴게시간 수</label>
            <select className="input" value={s.numBreaks} onChange={(e) => update({ numBreaks: Number(e.target.value) })}>
              {[0,1,2,3].map((n) => <option key={n}>{n}</option>)}</select></div>
          {Array.from({ length: s.numBreaks }).map((_, i) => (
            <div key={i}><label className="label">휴게 {i + 1}</label>
              <select className="input w-28" value={s.breakTimes[i] || '13:00'} onChange={(e) => { const bt = [...s.breakTimes]; bt[i] = e.target.value; update({ breakTimes: bt }) }}>
                {TIME_OPTIONS.map((t) => <option key={t}>{t}</option>)}</select></div>
          ))}
        </div>

        <div className="flex gap-5">
          {[{ label: '주말 제외', key: 'excludeWeekend' }, { label: '법정공휴일 제외', key: 'excludePublicHolidays' }].map(({ label, key }) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={s[key as keyof State] as boolean}
                onChange={(e) => update({ [key]: e.target.checked } as Partial<State>)} />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* 추가 휴일 */}
      <div className="card space-y-3">
        <h2 className="section-title">추가 휴일</h2>
        <div className="flex gap-2">
          <input type="date" className="input w-40" value={extraInput.date} onChange={(e) => setExtraInput((p) => ({ ...p, date: e.target.value }))} />
          <input type="text" className="input" placeholder="사유" value={extraInput.reason} onChange={(e) => setExtraInput((p) => ({ ...p, reason: e.target.value }))} />
          <button className="btn-secondary whitespace-nowrap" onClick={() => { if (!extraInput.date) return; update({ extraHolidays: [...s.extraHolidays, { date: extraInput.date, reason: extraInput.reason || '휴일' }] }); setExtraInput({ date: '', reason: '' }) }}>추가</button>
        </div>
        {s.extraHolidays.map((h, i) => (
          <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded-xl px-4 py-2">
            <span>{h.date} — {h.reason}</span>
            <button className="text-gray-300 hover:text-red-400 text-xs transition-colors" onClick={() => update({ extraHolidays: s.extraHolidays.filter((_, j) => j !== i) })}>삭제</button>
          </div>
        ))}
        {s.extraHolidays.length === 0 && <p className="text-xs text-gray-300">추가 휴일 없음</p>}
      </div>

      {/* 커리큘럼 */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="section-title">커리큘럼</h2>
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-all shadow-sm disabled:opacity-40"
              onClick={loadCurricula} disabled={curLoading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h8M4 18h8" />
              </svg>
              {curLoading ? '로딩...' : '저장된 커리큘럼'}
            </button>
            {savedCurricula && Object.keys(savedCurricula).length > 0 && (
              <>
                <select className="input w-40 py-1" value={selectedCur} onChange={(e) => setSelectedCur(e.target.value)}>
                  <option>(직접 입력)</option>
                  {Object.keys(savedCurricula).map((k) => <option key={k}>{k}</option>)}
                </select>
                {selectedCur !== '(직접 입력)' && (
                  <button className="btn-primary text-xs py-1" onClick={() => { const items = savedCurricula[selectedCur] || []; setS((p) => ({ ...p, curriculum: items.map((c) => ({ subject: c.subject, hours: c.hours })) })); setPreviewDone(false) }}>적용</button>
                )}
              </>
            )}
          </div>
        </div>
        <EditableTable value={s.curriculum} onChange={(v) => { setS((p) => ({ ...p, curriculum: v })); setPreviewDone(false) }} />
      </div>

      {/* 색상 */}
      <div className="card">
        <button className="flex items-center gap-2 text-sm font-medium text-gray-600" onClick={() => setColorOpen(!colorOpen)}>
          <span>시트 색상 설정</span>
          <span className="text-gray-300 text-xs">{colorOpen ? '▲' : '▼'}</span>
        </button>
        {colorOpen && (
          <div className="flex gap-6 mt-4">
            <div>
              <label className="label">헤더(주차) 배경</label>
              <div className="flex items-center gap-2">
                <input type="color" value={s.headerColor} onChange={(e) => setS((p) => ({ ...p, headerColor: e.target.value }))} />
                <span className="text-xs text-gray-400 font-mono">{s.headerColor}</span>
              </div>
            </div>
            <div>
              <label className="label">휴게시간 배경</label>
              <div className="flex items-center gap-2">
                <input type="color" value={s.breakColor} onChange={(e) => setS((p) => ({ ...p, breakColor: e.target.value }))} />
                <span className="text-xs text-gray-400 font-mono">{s.breakColor}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 공휴일 미리 확인 */}
      <div className="card space-y-4">
        <button className="btn-secondary w-full py-2.5" onClick={previewHolidays} disabled={holLoading}>
          {holLoading ? '계산 중...' : '공휴일 미리 확인'}
        </button>
        {holidays && previewDone && (
          <div className="space-y-2 pt-1">
            <p className="text-sm font-medium text-gray-700">적용 예정 공휴일 <span className="text-blue-500">({holidays.length}일)</span></p>
            <p className="text-xs text-gray-400">법정공휴일 체크 해제 시 수업일로 전환됩니다.</p>
            {holidays.length === 0 && <p className="text-sm text-gray-400">적용될 공휴일이 없습니다.</p>}
            <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
              {holidays.map((h) => (
                <label key={h.date} className="flex items-center gap-2.5 text-sm cursor-pointer py-1 rounded-lg hover:bg-gray-50 px-2 -mx-2">
                  <input type="checkbox" checked={!ignoredHols.has(h.date)} disabled={h.type === '추가휴일'}
                    onChange={(e) => { const n = new Set(ignoredHols); e.target.checked ? n.delete(h.date) : n.add(h.date); setIgnoredHols(n) }} />
                  <span>{h.date}</span>
                  <span className="font-medium">{h.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${h.type === '법정공휴일' ? 'bg-red-50 text-red-400' : 'bg-gray-100 text-gray-400'}`}>{h.type === '법정공휴일' ? '법정' : '추가'}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        {!previewDone && <p className="text-xs text-gray-300 text-center">공휴일 미리 확인 후 시간표를 생성할 수 있습니다.</p>}
      </div>

      {/* 생성 */}
      <button className="btn-primary w-full py-3.5 text-base rounded-2xl" onClick={generate} disabled={!previewDone || generating}>
        {generating ? '생성 중...' : '시간표 생성'}
      </button>

      {rows && (
        <div className="bg-green-50 border border-green-100 rounded-2xl px-5 py-4 text-sm text-green-700">
          완료 — <strong>{weekCount}주차</strong> &nbsp;|&nbsp; 개강 {s.startDate} → 종강 {endDate}
        </div>
      )}

      {/* 저장 */}
      {rows && (
        <div className="card">
          <button className="btn-primary w-full" onClick={downloadCsv}>CSV 다운로드</button>
        </div>
      )}
    </div>
  )
}
