import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { formatScheduleDate, generatePickupSlots, optionLabel, optionPrice } from '@/lib/types'
import { getEffectiveDays } from '@/lib/business-hours'
import { sendLineMessage } from '@/lib/line-message'
import { checkStock, countByStockKey, getLunchPlateIds, stockDateFor, syncAutoSoldOut } from '@/lib/stock'

interface TakeoutOrderItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  with_topping: boolean
  /** 漬け卵黄を追加 */
  with_egg_yolk?: boolean
}

interface TakeoutOrderRequestBody {
  table_id: string
  line_user_id?: string
  pickup_at?: string  // "YYYY-MM-DD HH:MM"
  /** お客様名（LINEの表示名、または店頭で店員が入力した名前） */
  customer_name?: string
  /** 店頭で店員が入力した注文（LINEの確認メッセージは送らない） */
  staff_entry?: boolean
  items: TakeoutOrderItem[]
}

/** 注文確認メッセージ本文を生成する */
function buildOrderMessage(
  orderId: string,
  items: TakeoutOrderItem[],
  pickupAt?: string,
): string {
  const lines: string[] = []
  lines.push('■ 織はや テイクアウトご注文確認 ■')
  lines.push('')

  let total = 0
  for (const item of items) {
    const toppingCost = optionPrice(item)
    const unitPrice = item.unit_price + toppingCost
    const subtotal = unitPrice * item.quantity
    total += subtotal

    const options = optionLabel(item)
    const toppingNote = options ? `（${options}）` : ''
    lines.push(`・${item.product_name}${toppingNote} ×${item.quantity}　¥${subtotal.toLocaleString()}`)
  }

  lines.push('')
  lines.push(`合計：¥${total.toLocaleString()}`)

  if (pickupAt) {
    const [datePart, timePart] = pickupAt.split(' ')
    const [, m, d] = datePart.split('-').map(Number)
    lines.push('')
    lines.push(`受取日時：${m}月${d}日 ${timePart}`)
  }

  const orderNum = (parseInt(orderId.replace(/-/g, '').slice(0, 8), 16) % 10000)
    .toString().padStart(4, '0')

  lines.push('')
  lines.push('ご注文ありがとうございます✨')
  lines.push('お気をつけてお越しください🙂‍↕️')
  lines.push('お受け取りの際はレジにてお声がけください🌟')
  lines.push(`（注文番号: ${orderNum}）`)
  lines.push('ーーーーーーーーーーーーー')
  lines.push('＼QRコード読み取りで来店スタンプGET！／')

  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  const body: TakeoutOrderRequestBody = await req.json()
  const { table_id, line_user_id, pickup_at, staff_entry, items } = body
  const customerName = body.customer_name?.trim().slice(0, 50) || null

  if (!table_id || !items || items.length === 0) {
    return NextResponse.json(
      { error: 'table_id と items は必須です' },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()

  // お客様の予約は、休業日や営業時間外の受け取りを受け付けない
  // （画面を開いた後に休業日に変更された場合などに備え、注文を受ける側でも確認する）
  // 店頭で店員が入力した注文は、その場の判断を優先して確認しない
  if (pickup_at && !staff_entry) {
    const [pickupDate, pickupTime] = pickup_at.split(' ')
    const [day] = await getEffectiveDays(supabase, [pickupDate])
    if (!day || !day.is_open) {
      return NextResponse.json(
        { error: `${formatScheduleDate(pickupDate)}は休業日のため、ご予約を承れません。別の日をお選びください。` },
        { status: 400 },
      )
    }
    if (!generatePickupSlots(day.open_time, day.close_time).includes(pickupTime)) {
      return NextResponse.json(
        { error: `${formatScheduleDate(pickupDate)}の${pickupTime}は受け取りの時間外です。別の時間をお選びください。` },
        { status: 400 },
      )
    }
  }

  // 仕込み数を入れている商品は、受け取り日の残り数を超える注文を断る
  const shortage = await checkStock(
    supabase,
    stockDateFor({ table_id, pickup_at }),
    countByStockKey(items, await getLunchPlateIds(supabase)),
  )
  if (shortage) return NextResponse.json({ error: shortage }, { status: 409 })

  // line_user_id が提供された場合、line_users に存在しなければ先に登録する
  // （orders.line_user_id の外部キー制約対策）
  if (line_user_id) {
    await supabase
      .from('line_users')
      .upsert(
        { user_id: line_user_id, is_friend: false, updated_at: new Date().toISOString() },
        { onConflict: 'user_id', ignoreDuplicates: true },
      )
  }

  const newOrderData: Record<string, unknown> = { table_id, status: 'new' }
  if (line_user_id) newOrderData.line_user_id = line_user_id
  if (pickup_at) newOrderData.pickup_at = pickup_at
  if (customerName) newOrderData.customer_name = customerName

  const { data: newOrder, error: createError } = await supabase
    .from('orders')
    .insert(newOrderData)
    .select('id')
    .single()

  if (createError || !newOrder) {
    return NextResponse.json(
      { error: createError?.message ?? '注文の作成に失敗しました' },
      { status: 500 },
    )
  }

  const orderId = newOrder.id

  const orderItems = items.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    with_topping: item.with_topping,
    with_egg_yolk: !!item.with_egg_yolk,
  }))

  const { error: insertError } = await supabase
    .from('order_items')
    .insert(orderItems)

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // 残りが0になった商品を自動で売り切れにする（失敗しても注文は成功のまま）
  await syncAutoSoldOut(supabase).catch((err) => console.error('自動売り切れの更新に失敗:', err))

  // LINE プッシュメッセージ送信（失敗しても注文自体は成功）
  if (line_user_id) {
    const message = buildOrderMessage(orderId, items, pickup_at)
    await sendLineMessage(line_user_id, message).catch((err) =>
      console.error('LINE push message failed:', err),
    )
  } else if (!staff_entry) {
    console.warn(`LINE送信なし: line_user_id が取得できていません order=${orderId}`)
  }

  return NextResponse.json({ order_id: orderId }, { status: 201 })
}
