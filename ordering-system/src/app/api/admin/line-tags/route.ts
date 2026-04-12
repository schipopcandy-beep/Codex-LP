/**
 * GET /api/admin/line-tags
 *
 * タグ集計 + ユーザーごとのタグ一覧を返す
 *
 * Query params:
 *   tag  : 特定タグでフィルタ（任意）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceRoleClient()
  const filterTag = req.nextUrl.searchParams.get('tag') ?? ''

  // タグごとのユーザー数集計
  const { data: tagCounts, error: tagError } = await supabase
    .from('line_tags')
    .select(`
      id,
      name,
      description,
      line_user_tags(count)
    `)
    .order('name')

  if (tagError) {
    return NextResponse.json({ error: tagError.message }, { status: 500 })
  }

  const summary = (tagCounts ?? []).map((t) => ({
    name: t.name,
    description: t.description,
    count: (t.line_user_tags as { count: number }[])[0]?.count ?? 0,
  }))

  // ユーザー一覧（タグ付き）
  let usersQuery = supabase
    .from('line_users')
    .select(`
      user_id,
      is_friend,
      followed_at,
      updated_at,
      line_user_tags(
        assigned_at,
        line_tags(name)
      )
    `)
    .eq('is_friend', true)
    .order('updated_at', { ascending: false })
    .limit(100)

  const { data: users, error: usersError } = await usersQuery

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 })
  }

  type RawUserTag = { assigned_at: string; line_tags: { name: string } | null }
  type RawUser = {
    user_id: string
    is_friend: boolean
    followed_at: string | null
    updated_at: string
    line_user_tags: RawUserTag[]
  }

  let formattedUsers = (users as RawUser[] ?? []).map((u) => ({
    user_id: u.user_id,
    is_friend: u.is_friend,
    followed_at: u.followed_at,
    updated_at: u.updated_at,
    tags: u.line_user_tags
      .map((ut) => ut.line_tags?.name)
      .filter((n): n is string => !!n)
      .sort(),
  }))

  // タグフィルタ
  if (filterTag) {
    formattedUsers = formattedUsers.filter((u) => u.tags.includes(filterTag))
  }

  return NextResponse.json({ summary, users: formattedUsers })
}
