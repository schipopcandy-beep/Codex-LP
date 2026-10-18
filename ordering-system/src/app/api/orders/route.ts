import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { checkStock, countByStockKey, getStockContext, syncAutoSoldOut } from '@/lib/stock'
import { todayJST } from '@/lib/business-hours'

interface OrderRequestBody {
  table_id: string
  line_user_id?: string
  party_size?: number
  items: Array<{
    product_id: string
    product_name: string
    quantity: number
    unit_price: number
    with_topping: boolean
    /** 漬け卵黄を追加 */
    with_egg_yolk?: boolean
    /** 大満足120%おにぎりにする */
    with_large?: boolean
    /** 何人目の注文者の分か（1始まり） */
    diner_no?: number | null
    timing?: string | null
    lunch_plate_index?: number | null
    /** 席から注文したお持ち帰り分 */
    is_takeout?: boolean
  }>
}

export async function POST(req: NextRequest) {
  const body: OrderRequestBody = await req.json()
  const { table_id, line_user_id, party_size, items } = body

  if (!table_id || !items || items.length === 0) {
    return NextResponse.json(
      { error: 'table_id と items は必須です' },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()

  // 仕込み数を入れている商品は、残り数を超える注文を断る
  const shortage = await checkStock(
    supabase,
    todayJST(),
    countByStockKey(items, await getStockContext(supabase)),
  )
  if (shortage) return NextResponse.json({ error: shortage }, { status: 409 })

  // 同じ席の未会計伝票を検索（status が paid 以外）
  const { data: existingOrder, error: fetchError } = await supabase
    .from('orders')
    .select('id')
    .eq('table_id', table_id)
    .neq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  let orderId: string

  if (existingOrder) {
    // 既存の伝票に追加。厨房が追加分に気づけるようステータスを「追加」に戻す
    orderId = existingOrder.id

    await supabase
      .from('orders')
      .update({ status: 'added', updated_at: new Date().toISOString() })
      .eq('id', orderId)
  } else {
    // line_user_id が提供された場合、line_users に存在しなければ先に登録する
    // （orders.line_user_id の外部キー制約対策。友だち登録していないお客様は未登録のため）
    if (line_user_id) {
      await supabase
        .from('line_users')
        .upsert(
          { user_id: line_user_id, is_friend: false, updated_at: new Date().toISOString() },
          { onConflict: 'user_id', ignoreDuplicates: true },
        )
    }

    // 新しい伝票を作成
    const newOrderData: Record<string, unknown> = { table_id, status: 'new' }
    if (line_user_id) newOrderData.line_user_id = line_user_id
    if (party_size) newOrderData.party_size = party_size

    let { data: newOrder, error: createError } = await supabase
      .from('orders')
      .insert(newOrderData)
      .select('id')
      .single()

    // それでもLINEのIDが原因で登録できない場合は、IDなしで伝票を作る（注文を止めない）
    if (createError?.code === '23503' && newOrderData.line_user_id) {
      delete newOrderData.line_user_id
      ;({ data: newOrder, error: createError } = await supabase
        .from('orders')
        .insert(newOrderData)
        .select('id')
        .single())
    }

    if (createError || !newOrder) {
      return NextResponse.json(
        { error: createError?.message ?? '伝票の作成に失敗しました' },
        { status: 500 },
      )
    }

    orderId = newOrder.id
  }

  // 注文者ごとに分けた注文か（分けていない注文では列を送らない）
  const validDinerNo = (n: unknown) => (Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 20 ? (n as number) : null)
  const hasDiners = items.some((item) => validDinerNo(item.diner_no) !== null)

  // 明細を挿入
  const orderItems = items.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    with_topping: item.with_topping,
    with_egg_yolk: !!item.with_egg_yolk,
    with_large: !!item.with_large,
    ...(item.timing != null ? { timing: item.timing } : {}),
    ...(item.lunch_plate_index != null ? { lunch_plate_index: item.lunch_plate_index } : {}),
    // 複数行をまとめて登録するとき、ある行にだけ付いた項目は他の行では
    // 既定値ではなく空（null）になるため、全行に明示して入れる
    is_takeout: !!item.is_takeout,
    ...(hasDiners ? { diner_no: validDinerNo(item.diner_no) } : {}),
  }))

  const { error: insertError } = await supabase
    .from('order_items')
    .insert(orderItems)

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // 残りが0になった商品を自動で売り切れにする（失敗しても注文は成功のまま）
  await syncAutoSoldOut(supabase).catch((err) => console.error('自動売り切れの更新に失敗:', err))

  return NextResponse.json({ order_id: orderId }, { status: 201 })
}
