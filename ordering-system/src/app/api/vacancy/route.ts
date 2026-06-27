import { NextResponse } from 'next/server'
import { getVacancy } from '@/lib/vacancy'

export async function GET() {
  try {
    const result = await getVacancy()
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
