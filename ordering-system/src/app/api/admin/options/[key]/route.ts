import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { OPTION_KEYS } from '@/lib/options'

interface Params {
  params: Promise<{ key: string }>
}

/** オプションの売り切れを切り替える。body: { is_sold_out: boolean } */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { key } = await params
  if (!(OPTION_KEYS as string[]).includes(key)) {
    return NextResponse.json({ error: '不明なオプションです' }, { status: 400 })
  }

  const body: { is_sold_out?: boolean } = await req.json()
  if (typeof body.is_sold_out !== 'boolean') {
    return NextResponse.json({ error: 'is_sold_out は boolean 必須です' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('product_options')
    .upsert(
      { key, is_sold_out: body.is_sold_out, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )

  if (error) {
    return NextResponse.json(
      { error: `${error.message}（オプションの表が未作成の場合は、案内したSQLを実行してください）` },
      { status: 500 },
    )
  }
  return NextResponse.json({ key, is_sold_out: body.is_sold_out })
}
