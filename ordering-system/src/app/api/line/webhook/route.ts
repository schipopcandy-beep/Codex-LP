import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { sendWelcomeMessage, replyLineMessage } from '@/lib/line-message'
import { getVacancy, buildVacancyText } from '@/lib/vacancy'

// LINE Harness 送信Webhookのペイロード型
// イベントタイプ: "friend.added" / "friend.removed" (Harness独自形式)
// 標準LINE形式: "follow" / "unfollow" にも対応（後方互換）
interface HarnessEvent {
  event?: string    // Harness形式: "friend.added", "friend.removed"
  type?: string     // LINE標準形式: "follow", "unfollow", "message"
  data?: {
    userId?: string
    lineUserId?: string
    source?: string   // 流入元: "qr_table" | "qr_takeout" | "instagram"
    text?: string     // メッセージ本文（Harness形式）
    [key: string]: unknown
  }
  source?: { userId?: string }
  userId?: string
  replyToken?: string
  message?: { type?: string; text?: string }  // LINE標準のメッセージイベント
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

  // シークレット検証
  // Harness 経由（友だち追加など）は LINE_HARNESS_WEBHOOK_SECRET で署名され、
  // 実 LINE Messaging API 経由（テキストメッセージなど）は LINE_CHANNEL_SECRET で署名される。
  // どちらの経路でも通るよう、両方のシークレットで検証していずれか一致すれば許可する。
  const harnessSecret = process.env.LINE_HARNESS_WEBHOOK_SECRET ?? ''
  const channelSecret = process.env.LINE_CHANNEL_SECRET ?? ''
  const secrets = [harnessSecret, channelSecret].filter(Boolean)

  const sigHeader =
    req.headers.get('x-harness-signature') ??
    req.headers.get('x-line-signature') ??
    req.headers.get('x-hub-signature-256') ??
    ''

  if (secrets.length > 0 && sigHeader) {
    const ok = secrets.some((s) => verifySignature(rawBody, sigHeader, s))
    if (!ok) {
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
    // Harness形式 ("friend.added") と LINE標準形式 ("follow") 両方に対応
    const eventType = ev.event ?? ev.type ?? ''

    // ── メッセージイベント（リッチメニューから「空席確認」が送られる）──
    if (eventType === 'message') {
      const text = (ev.message?.text ?? ev.data?.text ?? '').trim()
      if (text.includes('空席') && ev.replyToken) {
        try {
          const vacancy = await getVacancy()
          await replyLineMessage(ev.replyToken, buildVacancyText(vacancy))
        } catch (err) {
          console.error('空席確認の返信に失敗:', err)
        }
      }
      continue
    }

    // userIdをペイロード内の複数の場所から取得
    const userId =
      ev.data?.userId ??
      ev.data?.lineUserId ??
      ev.source?.userId ??
      ev.userId

    if (!userId) continue

    if (eventType === 'friend.added' || eventType === 'follow') {
      // line_users を upsert
      await supabase
        .from('line_users')
        .upsert(
          { user_id: userId, is_friend: true, followed_at: now, updated_at: now },
          { onConflict: 'user_id' },
        )

      // 【ウェルカムメッセージ】友だち追加・ブロック解除後の再登録どちらも follow で来る
      await sendWelcomeMessage(userId).catch((err) =>
        console.error('Welcome message failed:', err),
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
