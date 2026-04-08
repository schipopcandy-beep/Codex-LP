import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { TOPPING_NAME, TOPPING_PRICE } from '@/lib/types'

interface TakeoutOrderItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  with_topping: boolean
}

interface TakeoutOrderRequestBody {
  table_id: string
  line_user_id?: string
  items: TakeoutOrderItem[]
}

/** LINE Messaging API でプッシュメッセージを送信する */
async function sendLineMessage(lineUserId: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return

  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: 'text', text }],
    }),
  })
}

/** 注文確認メッセージ本文を生成する */
function buildOrderMessage(
  orderId: string,
  items: TakeoutOrderItem[],
): string {
  const lines: string[] = []
  lines.push('【織はや テイクアウトご注文確認】')
  lines.push('')

  let total = 0
  for (const item of items) {
    const toppingCost = item.with_topping ? TOPPING_PRICE : 0
    const unitPrice = item.unit_price + toppingCost
    const subtotal = unitPrice * item.quantity
    total += subtotal

    const toppingNote = item.with_topping ? `（＋${TOPPING_NAME}）` : ''
    lines.push(`・${item.product_name}${toppingNote} ×${item.quantity}　¥${subtotal.toLocaleString()}`)
  }

  lines.push('')
  lines.push(`合計：¥${total.toLocaleString()}`)
  lines.push('')
  lines.push('まもなくご用意いたします。')
  lines.push('お受け取りの際はレジにてお声がけください。')
  lines.push(`（注文番号: ${orderId.slice(0, 8)}）`)

  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  const body: TakeoutOrderRequestBody = await req.json()
  const { table_id, line_user_id, items } = body

  if (!table_id || !items || items.length === 0) {
    return NextResponse.json(
      { error: 'table_id と items は必須です' },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()

  // テイクアウトは常に新規伝票を作成（同じ人が複数回注文可）
  const newOrderData: Record<string, unknown> = { table_id, status: 'new' }
  if (line_user_id) newOrderData.line_user_id = line_user_id

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

  // 明細を挿入
  const orderItems = items.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    with_topping: item.with_topping,
  }))

  const { error: insertError } = await supabase
    .from('order_items')
    .insert(orderItems)

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // LINE プッシュメッセージ送信（失敗しても注文自体は成功）
  if (line_user_id) {
    const message = buildOrderMessage(orderId, items)
    await sendLineMessage(line_user_id, message).catch((err) =>
      console.error('LINE push message failed:', err),
    )
  }

  return NextResponse.json({ order_id: orderId }, { status: 201 })
}
