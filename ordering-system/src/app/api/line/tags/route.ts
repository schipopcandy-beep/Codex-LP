/**
 * LINE タグ管理 API
 *
 * POST /api/line/tags
 *   Body: { userId, action: "assign" | "remove", tags: string[] }
 *
 * GET /api/line/tags?userId=xxx
 *   ユーザーの現在のタグ一覧を返す
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { assignTags, removeTags, getUserTags, TAGS } from '@/lib/line-tags'
import type { TagName } from '@/lib/line-tags'

const VALID_TAGS = new Set<string>(Object.values(TAGS))

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const tags = await getUserTags(supabase, userId)
  return NextResponse.json({ userId, tags })
}

export async function POST(req: NextRequest) {
  let body: { userId?: string; action?: string; tags?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { userId, action, tags } = body

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }
  if (action !== 'assign' && action !== 'remove') {
    return NextResponse.json({ error: 'action must be "assign" or "remove"' }, { status: 400 })
  }
  if (!Array.isArray(tags) || tags.length === 0) {
    return NextResponse.json({ error: 'tags must be a non-empty array' }, { status: 400 })
  }

  const invalid = tags.filter((t) => !VALID_TAGS.has(t))
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Unknown tags: ${invalid.join(', ')}` },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()

  if (action === 'assign') {
    await assignTags(supabase, userId, tags as TagName[])
  } else {
    await removeTags(supabase, userId, tags as TagName[])
  }

  const updated = await getUserTags(supabase, userId)
  return NextResponse.json({ ok: true, userId, tags: updated })
}
