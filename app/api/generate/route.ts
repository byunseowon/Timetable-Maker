import { NextRequest, NextResponse } from 'next/server'
import { generateRows } from '@/lib/timetable'
import { ScheduleConfig } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const { cfg, ignoredPubHols }: { cfg: ScheduleConfig; ignoredPubHols: string[] } = await req.json()
    const result = generateRows(cfg, new Set(ignoredPubHols))
    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
