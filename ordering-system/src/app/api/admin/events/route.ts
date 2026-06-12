import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceRoleClient()
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  let query = supabase.from('sendai_events').select('*').order('date', { ascending: false })
  if (from) query = query.gte('date', from)
  if (to)   query = query.lte('date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, date, end_date, location, scale, note } = body

  if (!name || !date) {
    return NextResponse.json({ error: 'name と date は必須です' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.from('sendai_events').insert({
    name,
    date,
    end_date: end_date || null,
    location: location || null,
    scale: scale ?? 3,
    note: note || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
