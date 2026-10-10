import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { todayJST } from '@/lib/business-hours'
import { getStockStatus, syncAutoSoldOut } from '@/lib/stock'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** 管理用: 指定日（既定は今日）の仕込み数と残り数。?date=YYYY-MM-DD */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? todayJST()
  if (!DATE_RE.test(date)) return NextResponse.json({ error: '日付の形式が正しくありません' }, { status: 400 })

  const supabase = createServiceRoleClient()
  const items = await getStockStatus(supabase, date)
  return NextResponse.json({ date, items }, { headers: { 'Cache-Control': 'no-store' } })
}

/** 仕込み数を数える単位として受け付けるキー */
const STOCK_KEY_RE = /^(product:[0-9a-f-]{36}|group:lunch_plate|option:(tororo|egg_yolk))$/

/**
 * 管理用: 仕込み数を登録・変更する
 * body: { date, stock_key, prepared_qty }（prepared_qty が null なら数の管理をやめる）
 * stock_key は "product:<商品ID>"・"group:lunch_plate"・"option:egg_yolk" など
 */
export async function PUT(req: NextRequest) {
  const body: { date?: string; stock_key?: string; prepared_qty?: number | null } = await req.json()
  const date = body.date ?? todayJST()
  const stockKey = body.stock_key ?? ''
  if (!DATE_RE.test(date) || !STOCK_KEY_RE.test(stockKey)) {
    return NextResponse.json({ error: 'date と stock_key を正しく指定してください' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  if (body.prepared_qty == null) {
    const { error } = await supabase
      .from('stock_counts')
      .delete()
      .eq('date', date)
      .eq('stock_key', stockKey)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const qty = Number(body.prepared_qty)
    if (!Number.isInteger(qty) || qty < 0) {
      return NextResponse.json({ error: '仕込み数は0以上の整数で入力してください' }, { status: 400 })
    }
    const { error } = await supabase.from('stock_counts').upsert(
      { date, stock_key: stockKey, prepared_qty: qty, updated_at: new Date().toISOString() },
      { onConflict: 'date,stock_key' },
    )
    if (error) {
      return NextResponse.json(
        { error: `${error.message}（仕込み数の表が未作成の場合は、案内したSQLを実行してください）` },
        { status: 500 },
      )
    }
  }

  // 仕込み数を変えたら、今日の売り切れ表示を合わせる
  await syncAutoSoldOut(supabase, date)

  const items = await getStockStatus(supabase, date)
  return NextResponse.json({ date, items })
}
