/**
 * LINE 休眠ユーザー検出 API（バッチ処理用）
 *
 * POST /api/line/dormancy-check
 *   Body: { secret: string, days?: 30 | 60 }
 *
 * 本来は外部cronサービス（Vercel Cron / GitHub Actions など）から
 * 1日1回呼び出す想定。
 *
 * 呼び出し例:
 *   # 30日休眠チェック
 *   curl -X POST https://your-domain/api/line/dormancy-check \
 *     -H "Content-Type: application/json" \
 *     -d '{"secret": "<CRON_SECRET>", "days": 30}'
 *
 *   # 60日休眠チェック（30日チェックの後に実行）
 *   curl -X POST https://your-domain/api/line/dormancy-check \
 *     -H "Content-Type: application/json" \
 *     -d '{"secret": "<CRON_SECRET>", "days": 60}'
 *
 * 環境変数:
 *   LINE_CRON_SECRET - 不正呼び出し防止用シークレット
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { markDormantUsers } from '@/lib/line-tags'

export async function POST(req: NextRequest) {
  let body: { secret?: string; days?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // シークレット検証
  const cronSecret = process.env.LINE_CRON_SECRET
  if (cronSecret && body.secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const days = body.days === 60 ? 60 : 30

  const supabase = createServiceRoleClient()
  const updated = await markDormantUsers(supabase, days)

  return NextResponse.json({ ok: true, days, updated })
}
