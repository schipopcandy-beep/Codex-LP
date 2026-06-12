import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceRoleClient()

  const jstOffset = 9 * 60 * 60 * 1000
  const todayJst = new Date(Date.now() + jstOffset).toISOString().slice(0, 10)
  const todayDow = new Date(todayJst).getUTCDay() // 0=日

  const [shopsResult, overridesResult] = await Promise.all([
    supabase.from('competitor_shops').select('*').eq('is_active', true).order('created_at'),
    supabase.from('competitor_status_log').select('shop_id, is_open').eq('date', todayJst),
  ])

  if (shopsResult.error) return NextResponse.json({ error: shopsResult.error.message }, { status: 500 })

  const overrideMap = new Map(overridesResult.data?.map((o) => [o.shop_id, o.is_open]) ?? [])

  const shops = shopsResult.data.map((shop) => {
    const defaultOpen = (shop.open_weekdays as number[]).includes(todayDow)
    const override = overrideMap.has(shop.id) ? overrideMap.get(shop.id) : undefined
    return {
      ...shop,
      today_open: override !== undefined ? override : defaultOpen,
      today_override: override !== undefined,
      today_default: defaultOpen,
    }
  })

  return NextResponse.json(shops)
}
