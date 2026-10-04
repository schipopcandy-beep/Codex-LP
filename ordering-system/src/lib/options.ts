import type { SupabaseClient } from '@supabase/supabase-js'
import { NO_OPTION_SOLD_OUT, type OptionKey, type OptionSoldOut } from '@/lib/types'

export const OPTION_KEYS: OptionKey[] = ['tororo', 'egg_yolk']

/**
 * オプションの売り切れ状態を読む
 * 表がまだない（SQL未実行）場合は、すべて販売中として扱う
 */
export async function getOptionSoldOut(supabase: SupabaseClient): Promise<OptionSoldOut> {
  const result: OptionSoldOut = { ...NO_OPTION_SOLD_OUT }
  const { data, error } = await supabase.from('product_options').select('key, is_sold_out')
  if (error || !data) return result
  for (const row of data as { key: string; is_sold_out: boolean }[]) {
    if ((OPTION_KEYS as string[]).includes(row.key)) {
      result[row.key as OptionKey] = row.is_sold_out
    }
  }
  return result
}
