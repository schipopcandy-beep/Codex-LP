import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

interface Params { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const now = new Date()
  const year  = parseInt(searchParams.get('year')  ?? String(now.getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1))

  const supabase = createServiceRoleClient()
  const lastDay = new Date(year, month, 0).getDate()
  const fromDate = `${year}-${String(month).padStart(2, '0')}-01`
  const toDate   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const [shopResult, overridesResult] = await Promise.all([
    supabase.from('competitor_shops').select('id, name, open_weekdays').eq('id', id).single(),
    supabase.from('competitor_status_log').select('date, is_open').eq('shop_id', id).gte('date', fromDate).lte('date', toDate),
  ])

  if (shopResult.error) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  const shop = shopResult.data
  const overrideMap = new Map(overridesResult.data?.map((o) => [o.date, o.is_open]) ?? [])

  const days = Array.from({ length: lastDay }, (_, i) => {
    const d = i + 1
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dow = new Date(dateStr).getUTCDay()
    const defaultOpen = (shop.open_weekdays as number[]).includes(dow)
    const override = overrideMap.has(dateStr) ? overrideMap.get(dateStr)! : null
    return {
      date: dateStr,
      dow,
      default_open: defaultOpen,
      override,
      is_open: override !== null ? override : defaultOpen,
    }
  })

  return NextResponse.json({ shop, days })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { date, is_open }: { date: string; is_open: boolean } = await req.json()

  const supabase = createServiceRoleClient()

  const shopResult = await supabase.from('competitor_shops').select('open_weekdays').eq('id', id).single()
  if (shopResult.error) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  const dow = new Date(date).getUTCDay()
  const defaultOpen = (shopResult.data.open_weekdays as number[]).includes(dow)

  if (is_open === defaultOpen) {
    // デフォルトと同じ → 上書き不要なので削除
    await supabase.from('competitor_status_log').delete().eq('shop_id', id).eq('date', date)
  } else {
    await supabase.from('competitor_status_log').upsert(
      { shop_id: id, date, is_open },
      { onConflict: 'shop_id,date' },
    )
  }

  return NextResponse.json({ ok: true })
}
