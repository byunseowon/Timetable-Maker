import Holidays from 'date-holidays'

const LABOR_DAY_FROM = 2026

const NAME_MAP: Record<string, string> = {
  "New Year's Day": '신정',
  'Independence Movement Day': '삼일절',
  "Children's Day": '어린이날',
  'Memorial Day': '현충일',
  'Liberation Day': '광복절',
  'National Foundation Day': '개천절',
  "Hangul Day": '한글날',
  'Hangul Proclamation Day': '한글날',
  'Christmas Day': '크리스마스',
  "Lunar New Year's Day": '설날',
  "day before Lunar New Year's Day": '설날 연휴',
  "day after Lunar New Year's Day": '설날 연휴',
  "day before Lunar New Year": '설날 연휴',
  "day after Lunar New Year": '설날 연휴',
  "Lunar New Year": '설날',
  "Buddha's Birthday": '부처님오신날',
  Chuseok: '추석',
  'day before Chuseok': '추석 연휴',
  'day after Chuseok': '추석 연휴',
  'substitute holiday': '대체공휴일',
}

function krName(raw: string): string {
  return NAME_MAP[raw] ?? raw
}

export function getAllKrHolidays(startYear: number, endYear: number): Map<string, string> {
  const hd = new Holidays('KR')
  const result = new Map<string, string>()

  for (let year = startYear; year <= endYear; year++) {
    const list = hd.getHolidays(year)
    for (const h of list) {
      if (h.type === 'public' || h.type === 'optional') {
        const dateStr = h.date.substring(0, 10)
        if (!result.has(dateStr)) {
          result.set(dateStr, krName(h.name))
        }
      }
    }
    if (year >= LABOR_DAY_FROM) {
      const laborDay = `${year}-05-01`
      if (!result.has(laborDay)) result.set(laborDay, '노동절')
    }
  }
  return result
}
