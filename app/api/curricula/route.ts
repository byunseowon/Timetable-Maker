import { NextRequest, NextResponse } from 'next/server'
import { loadCurriculaFromSupabase, saveCurriculaToSupabase } from '@/lib/supabase'

export async function GET() {
  try {
    const data = await loadCurriculaFromSupabase()
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    await saveCurriculaToSupabase(data)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
