import { NextRequest, NextResponse } from 'next/server'
import { previewHolidays } from '@/lib/timetable'
import { ScheduleConfig } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const cfg: ScheduleConfig = await req.json()
    const holidays = previewHolidays(cfg)
    return NextResponse.json({ holidays })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
