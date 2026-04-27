export interface ScheduleConfig {
  startDate: string
  dayStart: string
  dayEnd: string
  breakTimes: string[][]
  excludeWeekend: boolean
  excludePublicHolidays: boolean
  extraHolidays: ExtraHoliday[]
  curriculum: CurriculumItem[]
}

export interface CurriculumItem {
  subject: string
  hours: number
  order?: number
}

export interface ExtraHoliday {
  date: string
  reason: string
}

export interface HolidayInfo {
  date: string
  name: string
  type: '법정공휴일' | '추가휴일'
}
