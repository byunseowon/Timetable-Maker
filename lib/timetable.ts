import { ScheduleConfig, ExtraHoliday, HolidayInfo, CurriculumItem } from './types'
import { getAllKrHolidays } from './holidays'

const DAY_KR = ['월', '화', '수', '목', '금', '토', '일']

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h + (m || 0) / 60
}

function timeStr(h: number): string {
  const hour = Math.floor(h)
  const min = Math.round((h - hour) * 60)
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toDateStr(d: Date): string {
  return d.toISOString().substring(0, 10)
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function buildSlots(dayStart: string, dayEnd: string): number[] {
  const start = parseTime(dayStart)
  const end = parseTime(dayEnd)
  const slots: number[] = []
  for (let t = start; t < end; t += 1) slots.push(t)
  return slots
}

export function buildExtraDict(extraList: ExtraHoliday[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const h of extraList) {
    if (h.date) map.set(h.date, h.reason || '휴일')
  }
  return map
}

function isHoliday(
  dateStr: string,
  cfg: ScheduleConfig,
  pubHols: Map<string, string>,
  extraDict: Map<string, string>,
  ignoredPubHols: Set<string>
): [boolean, string] {
  const date = parseDate(dateStr)
  const dow = date.getDay()
  if (cfg.excludeWeekend && (dow === 0 || dow === 6)) return [true, '주말']
  if (cfg.excludePublicHolidays && pubHols.has(dateStr) && !ignoredPubHols.has(dateStr))
    return [true, pubHols.get(dateStr)!]
  if (extraDict.has(dateStr)) return [true, extraDict.get(dateStr)!]
  return [false, '']
}

function calculateEndDate(
  cfg: ScheduleConfig,
  pubHols: Map<string, string>,
  extraDict: Map<string, string>,
  ignoredPubHols: Set<string>
): Date {
  const slots = buildSlots(cfg.dayStart, cfg.dayEnd)
  const breakStarts = new Set(cfg.breakTimes.map((b) => parseTime(b[0])))
  const slotsPerDay = slots.filter((s) => !breakStarts.has(s)).length
  const totalHours = cfg.curriculum.reduce((sum, c) => sum + (c.hours || 0), 0)

  if (totalHours <= 0 || slotsPerDay <= 0) return parseDate(cfg.startDate)

  let remaining = totalHours
  let d = parseDate(cfg.startDate)
  for (let i = 0; i < 3000; i++) {
    const ds = toDateStr(d)
    const [isHol] = isHoliday(ds, cfg, pubHols, extraDict, ignoredPubHols)
    if (!isHol) {
      remaining -= slotsPerDay
      if (remaining <= 0) return d
    }
    d = addDays(d, 1)
  }
  return d
}

function buildSchedule(
  cfg: ScheduleConfig,
  pubHols: Map<string, string>,
  extraDict: Map<string, string>,
  ignoredPubHols: Set<string>
): Map<string, string> {
  const schedule = new Map<string, string>()
  const curriculum = cfg.curriculum.filter((c) => (c.hours || 0) > 0)
  if (!curriculum.length) return schedule

  const slots = buildSlots(cfg.dayStart, cfg.dayEnd)
  const breakStarts = new Set(cfg.breakTimes.map((b) => parseTime(b[0])))
  const end = calculateEndDate(cfg, pubHols, extraDict, ignoredPubHols)

  let subjIdx = 0
  let remaining = curriculum[0].hours

  let d = parseDate(cfg.startDate)
  while (d <= end && subjIdx < curriculum.length) {
    const ds = toDateStr(d)
    const [isHol] = isHoliday(ds, cfg, pubHols, extraDict, ignoredPubHols)
    if (!isHol) {
      for (const slot of slots) {
        if (breakStarts.has(slot)) continue
        schedule.set(`${ds} ${timeStr(slot)}`, curriculum[subjIdx].subject)
        remaining--
        if (remaining <= 0) {
          subjIdx++
          if (subjIdx >= curriculum.length) break
          remaining = curriculum[subjIdx].hours
        }
      }
    }
    d = addDays(d, 1)
  }
  return schedule
}

export function getAppliedHolidays(
  cfg: ScheduleConfig,
  pubHols: Map<string, string>,
  extraDict: Map<string, string>,
  ignoredPubHols: Set<string>
): HolidayInfo[] {
  const end = calculateEndDate(cfg, pubHols, extraDict, ignoredPubHols)
  const result: HolidayInfo[] = []
  let d = parseDate(cfg.startDate)
  while (d <= end) {
    const ds = toDateStr(d)
    if (cfg.excludePublicHolidays && pubHols.has(ds) && !ignoredPubHols.has(ds)) {
      result.push({ date: ds, name: pubHols.get(ds)!, type: '법정공휴일' })
    } else if (extraDict.has(ds)) {
      result.push({ date: ds, name: extraDict.get(ds)!, type: '추가휴일' })
    }
    d = addDays(d, 1)
  }
  return result
}

export function previewHolidays(cfg: ScheduleConfig): HolidayInfo[] {
  const startYear = parseDate(cfg.startDate).getFullYear()
  const pubHols = getAllKrHolidays(startYear, startYear + 3)
  const extraDict = buildExtraDict(cfg.extraHolidays)
  return getAppliedHolidays(cfg, pubHols, extraDict, new Set())
}

export function generateRows(
  cfg: ScheduleConfig,
  ignoredPubHols: Set<string>
): { rows: string[][]; endDate: string; holidays: HolidayInfo[] } {
  const startYear = parseDate(cfg.startDate).getFullYear()
  const pubHols = getAllKrHolidays(startYear, startYear + 3)
  const extraDict = buildExtraDict(cfg.extraHolidays)
  const end = calculateEndDate(cfg, pubHols, extraDict, ignoredPubHols)
  const slots = buildSlots(cfg.dayStart, cfg.dayEnd)
  const breakStarts = new Set(cfg.breakTimes.map((b) => parseTime(b[0])))
  const schedule = buildSchedule(cfg, pubHols, extraDict, ignoredPubHols)
  const holidays = getAppliedHolidays(cfg, pubHols, extraDict, ignoredPubHols)

  const rows: string[][] = []
  const start = parseDate(cfg.startDate)

  const dayOfWeek = start.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  let weekMon = addDays(start, mondayOffset)
  let weekNum = 0

  while (weekMon <= end) {
    const weekDays: (Date | null)[] = []
    for (let i = 0; i < 5; i++) {
      const d = addDays(weekMon, i)
      weekDays.push(d >= start && d <= end ? d : null)
    }
    if (weekDays.every((d) => d === null)) {
      weekMon = addDays(weekMon, 7)
      continue
    }
    weekNum++

    rows.push([`${weekNum}주차`, '', '', `${weekNum}주차`, '', '', '', ''])

    const dateRow = ['', '', '']
    for (const d of weekDays) {
      if (d) {
        const dow = d.getDay()
        dateRow.push(`${d.getMonth() + 1}/${d.getDate()}(${DAY_KR[dow === 0 ? 6 : dow - 1]})`)
      } else {
        dateRow.push('')
      }
    }
    rows.push(dateRow)
    rows.push(['시작시간', '~', '종료시간', '교과명', '교과명', '교과명', '교과명', '교과명'])

    for (const slot of slots) {
      const slotEnd = slot + 1
      const row = [timeStr(slot), '~', timeStr(slotEnd)]
      for (const d of weekDays) {
        if (!d) {
          row.push('')
          continue
        }
        const ds = toDateStr(d)
        const [isHol, hname] = isHoliday(ds, cfg, pubHols, extraDict, ignoredPubHols)
        if (isHol) {
          row.push(slot === slots[0] ? hname : '')
        } else if (breakStarts.has(slot)) {
          row.push('휴게시간')
        } else {
          row.push(schedule.get(`${ds} ${timeStr(slot)}`) || '')
        }
      }
      rows.push(row)
    }

    for (const label of ['[원격]강의명', '[프로젝트]', '[프로젝트]소주제', '과제/테스트/기타', '비고']) {
      rows.push([label, '', '', '', '', '', '', ''])
    }

    weekMon = addDays(weekMon, 7)
  }

  return { rows, endDate: toDateStr(end), holidays }
}

export function rowsToCsv(rows: string[][]): string {
  const bom = '﻿'
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
  return bom + csv
}
