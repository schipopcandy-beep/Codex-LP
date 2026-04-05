import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret)
  hmac.update(rawBody)
  return hmac.digest('base64') === signature
}

interface LineEventSource {
  type: string
  userId?: string
}

interface LineEvent {
  type: string
  source?: LineEventSource
}

interface LineWebhookBody {
  events?: LineEvent[]
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''
  const secret = process.env.LINE_CHANNEL_SECRET ?? ''

  // シークレットが設定されている場合は署名検証
  if (secret) {
    if (!signature || !verifySignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let body: LineWebhookBody
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  for (const event of body.events ?? []) {
    const userId = event.source?.userId
    if (!userId) continue

    const now = new Date().toISOString()

    if (event.type === 'follow') {
      await supabase
        .from('line_users')
        .upsert(
          {
            user_id: userId,
            is_friend: true,
            followed_at: now,
            updated_at: now,
          },
          { onConflict: 'user_id' },
        )
    } else if (event.type === 'unfollow') {
      await supabase
        .from('line_users')
        .upsert(
          {
            user_id: userId,
            is_friend: false,
            updated_at: now,
          },
          { onConflict: 'user_id' },
        )
    }
  }

  // LINE Webhook は 200 を返す必要がある
  return NextResponse.json({ ok: true })
}
