import Holidays from 'date-holidays'

const LABOR_DAY_FROM = 2026
const EXCLUDED = new Set<string>()
const LUNAR_MULTI_DAY = new Set(['설날', '추석'])
const LUNAR_NAMES = new Set(['설날', '설날 연휴', '추석', '추석 연휴'])
const NO_SUBSTITUTE = new Set(['신정', '현충일', '제헌절'])
// date-holidays 라이브러리 버그: 추석을 매년 하루 일찍 반환
const LUNAR_DATE_FIX: Record<string, number> = { '추석': 1 }
const NAME_OVERRIDE: Record<string, string> = { '기독탄신일': '크리스마스' }

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function getAllKrHolidays(startYear: number, endYear: number): Map<string, string> {
  const hd = new Holidays('KR', { timezone: 'Asia/Seoul' })
  const result = new Map<string, string>()

  for (let year = startYear; year <= endYear; year++) {
    const list = hd.getHolidays(year)

    for (const h of list) {
      if (h.type !== 'public' && h.type !== 'optional') continue
      const name = h.name
      if (EXCLUDED.has(name)) continue
      const offset = LUNAR_DATE_FIX[name] ?? 0
      const dateStr = offset
        ? toDateStr(addDays(new Date(h.date.substring(0, 10)), offset))
        : h.date.substring(0, 10)
      if (!result.has(dateStr)) result.set(dateStr, NAME_OVERRIDE[name] ?? name)

      // 설날·추석: 전날/다음날 연휴 추가
      if (LUNAR_MULTI_DAY.has(name)) {
        const base = new Date(dateStr)
        const prev = toDateStr(addDays(base, -1))
        const next = toDateStr(addDays(base, 1))
        if (!result.has(prev)) result.set(prev, name + ' 연휴')
        if (!result.has(next)) result.set(next, name + ' 연휴')
      }
    }

    // 노동절 (2026년~)
    if (year >= LABOR_DAY_FROM) {
      const laborDay = `${year}-05-01`
      if (!result.has(laborDay)) result.set(laborDay, '노동절')
    }
  }

  const holidaySet = new Set(result.keys())

  // 명절 대체공휴일: 연휴 3일 중 일요일 있으면 → 연휴 마지막 날 다음 첫 평일
  for (const [dateStr, name] of Array.from(result.entries())) {
    if (!LUNAR_MULTI_DAY.has(name)) continue
    const base = new Date(dateStr)
    const prevStr = toDateStr(addDays(base, -1))
    const nextStr = toDateStr(addDays(base, 1))
    const hasSunday = [prevStr, dateStr, nextStr].some(ds => new Date(ds).getDay() === 0)
    if (!hasSunday) continue
    let candidate = addDays(new Date(nextStr), 1)
    while (holidaySet.has(toDateStr(candidate)) || candidate.getDay() === 0 || candidate.getDay() === 6) {
      candidate = addDays(candidate, 1)
    }
    const sub = toDateStr(candidate)
    if (!result.has(sub)) {
      result.set(sub, name + ' 대체공휴일')
      holidaySet.add(sub)
    }
  }

  // 그 외 공휴일 대체: 토/일 겹치면 다음 평일 (신정·현충일·제헌절·명절 연휴 제외)
  for (const dateStr of Array.from(result.keys())) {
    const name = result.get(dateStr) ?? ''
    if (NO_SUBSTITUTE.has(name) || LUNAR_NAMES.has(name)) continue
    const d = new Date(dateStr)
    const dow = d.getDay()
    if (dow === 0 || dow === 6) {
      let candidate = addDays(d, dow === 0 ? 1 : 2)
      while (holidaySet.has(toDateStr(candidate)) || candidate.getDay() === 0 || candidate.getDay() === 6) {
        candidate = addDays(candidate, 1)
      }
      const sub = toDateStr(candidate)
      if (!result.has(sub)) {
        result.set(sub, name + ' 대체공휴일')
        holidaySet.add(sub)
      }
    }
  }

  return result
}
