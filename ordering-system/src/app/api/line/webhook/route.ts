import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'

// LINE Harness 送信Webhookのペイロード型
// イベントタイプ: "friend.added" / "friend.removed" (Harness独自形式)
// 標準LINE形式: "follow" / "unfollow" にも対応（後方互換）
interface HarnessEvent {
  event?: string    // Harness形式: "friend.added", "friend.removed"
  type?: string     // LINE標準形式: "follow", "unfollow"
  data?: {
    userId?: string
    lineUserId?: string
    [key: string]: unknown
  }
  source?: { userId?: string }
  userId?: string
}

interface WebhookBody {
  events?: HarnessEvent[]
  // LINE Harnessは単一イベントで送る場合もある
  event?: string
  data?: HarnessEvent['data']
  userId?: string
}

function verifySignature(rawBody: string, sigHeader: string, secret: string): boolean {
  // sha256=<hex> 形式 (GitHub-style) と base64形式 (LINE-style) の両方に対応
  const hmac = createHmac('sha256', secret)
  hmac.update(rawBody)

  if (sigHeader.startsWith('sha256=')) {
    return hmac.digest('hex') === sigHeader.slice(7)
  }
  return hmac.digest('base64') === sigHeader
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // シークレット検証（LINE_HARNESS_WEBHOOK_SECRET 優先、次に LINE_CHANNEL_SECRET）
  const harnessSecret = process.env.LINE_HARNESS_WEBHOOK_SECRET ?? ''
  const channelSecret = process.env.LINE_CHANNEL_SECRET ?? ''
  const activeSecret = harnessSecret || channelSecret

  const sigHeader =
    req.headers.get('x-harness-signature') ??
    req.headers.get('x-line-signature') ??
    req.headers.get('x-hub-signature-256') ??
    ''

  if (activeSecret && sigHeader) {
    if (!verifySignature(rawBody, sigHeader, activeSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let body: WebhookBody
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const now = new Date().toISOString()

  // LINE Harness は単一イベントまたは配列で送信する
  const events: HarnessEvent[] = body.events ?? (body.event ? [body as HarnessEvent] : [])

  for (const ev of events) {
    // userIdをペイロード内の複数の場所から取得
    const userId =
      ev.data?.userId ??
      ev.data?.lineUserId ??
      ev.source?.userId ??
      ev.userId

    if (!userId) continue

    // Harness形式 ("friend.added") と LINE標準形式 ("follow") 両方に対応
    const eventType = ev.event ?? ev.type ?? ''

    if (eventType === 'friend.added' || eventType === 'follow') {
      await supabase
        .from('line_users')
        .upsert(
          { user_id: userId, is_friend: true, followed_at: now, updated_at: now },
          { onConflict: 'user_id' },
        )
    } else if (eventType === 'friend.removed' || eventType === 'unfollow') {
      await supabase
        .from('line_users')
        .upsert(
          { user_id: userId, is_friend: false, updated_at: now },
          { onConflict: 'user_id' },
        )
    }
  }

  return NextResponse.json({ ok: true })
}
