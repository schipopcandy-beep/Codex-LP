import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getOptionSoldOut } from '@/lib/options'

/** おにぎりのオプション（とろろ昆布・漬け卵黄）の売り切れ状態 */
export async function GET() {
  const supabase = createServiceRoleClient()
  const soldOut = await getOptionSoldOut(supabase)
  return NextResponse.json(soldOut, { headers: { 'Cache-Control': 'no-store' } })
}
