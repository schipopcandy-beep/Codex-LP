import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 同名・同カテゴリの重複行を除去（DBに重複がある場合の安全策）
  const seen = new Set<string>()
  const unique = (data ?? []).filter((p) => {
    const key = `${p.category}||${p.name}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return NextResponse.json(unique)
}
