/**
 * 商品マスタ更新スクリプト
 * 使い方: node scripts/update-products.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const envPath = resolve(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) process.env[match[1].trim()] = match[2].trim()
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const PRODUCTS = [
  { name: '伊達の旨塩にぎり', price: 250,  description: '素材を活かす伊達な旨塩',                          category: 'おにぎり', sort_order: 10,  is_sold_out: false, topping_available: false },
  { name: 'おかか',           price: 350,  description: 'ふわっと広がる手作りの甘み',                      category: 'おにぎり', sort_order: 20,  is_sold_out: false, topping_available: true  },
  { name: '茎わかめ佃煮',         price: 350,  description: '石巻の旨みがあふれる味わいと食感',       category: 'おにぎり', sort_order: 30,  is_sold_out: false, topping_available: true  },
  { name: 'ほぐし梅',         price: 350,  description: '南高梅の豊かな香りとほどよい酸味がクセになる',                  category: 'おにぎり', sort_order: 40,  is_sold_out: false, topping_available: true  },
  { name: '焼しゃけ',         price: 350,  description: '毎朝店内で焼き上げる風味豊かなしゃけ',                      category: 'おにぎり', sort_order: 50,  is_sold_out: false, topping_available: true  },
  { name: 'ツナマヨ',         price: 350,  description: 'ツナから手作り 他では味わえない絶品',                    category: 'おにぎり', sort_order: 60,  is_sold_out: false, topping_available: true  },
  { name: '鶏そぼろ',         price: 400,  description: '生姜が香る甘辛ジューシー',                        category: 'おにぎり', sort_order: 70,  is_sold_out: false, topping_available: true  },
  { name: '焼きおにぎり',     price: 400,  description: '香ばしい味噌につい笑顔になる味', category: 'おにぎり', sort_order: 80,  is_sold_out: false, topping_available: false },
  { name: 'おかチー',         price: 400,  description: '当店一番人気!! おかかとチーズの驚きの相性',                      category: 'おにぎり', sort_order: 90,  is_sold_out: false, topping_available: true  },
  { name: '辛子明太子',       price: 400,  description: 'ピリッとやみつき プチプチの食感',                category: 'おにぎり', sort_order: 100, is_sold_out: false, topping_available: true  },
  { name: '萩のしそひじき',   price: 400,  description: '井上商店の名産品 山口県からお取り寄せ',           category: 'おにぎり', sort_order: 110, is_sold_out: false, topping_available: false },
  { name: 'ガパオ',           price: 400,  description: 'ひと口でタイ旅行 鶏ひき肉のバジル炒め',            category: 'おにぎり', sort_order: 120, is_sold_out: false, topping_available: true  },
  { name: 'えびマヨ',         price: 450,  description: 'えび好きのあなたをときめかせたい',               category: 'おにぎり', sort_order: 130, is_sold_out: false, topping_available: true  },
  { name: 'ルーロー',         price: 450,  description: '台湾の人気グルメ 豚肉の甘辛煮',                  category: 'おにぎり', sort_order: 140, is_sold_out: false, topping_available: true  },
  { name: '極み筋子',         price: 600,  description: '店主こだわりの逸品 青森県からお取り寄せ',         category: 'おにぎり', sort_order: 150, is_sold_out: false, topping_available: true  },
  { name: 'しゃけ筋子',       price: 650,  description: '海からの贈り物をご堪能下さい',                   category: 'おにぎり', sort_order: 160, is_sold_out: false, topping_available: true  },
  { name: 'おにぎり屋のみそ汁', price: 400, description: null,                                            category: 'サイド',   sort_order: 170, is_sold_out: false, topping_available: false },
  { name: '限定おにぎり',     price: 600,  description: '本日の具材はお席のチラシをご覧ください',          category: 'おにぎり', sort_order: 165, is_sold_out: false, topping_available: true  },
  { name: 'おかずパック',     price: 500,  description: 'メイン1品・副菜3品',                                category: 'テイクアウト限定', sort_order: 175, is_sold_out: false, topping_available: false },
  { name: 'ランチプレート（おにぎり1個）', price: 1300, description: '選べるおにぎり1個、メインおかず1品と副菜3品の盛り合わせ', category: 'ランチ', sort_order: 180, is_sold_out: false, topping_available: false },
  { name: 'ランチプレート（おにぎり2個）', price: 1500, description: '選べるおにぎり2個、メインおかず1品と副菜3品の盛り合わせ', category: 'ランチ', sort_order: 181, is_sold_out: false, topping_available: false },
]

async function main() {
  console.log('🍙 商品マスタを更新します\n')

  // 全削除してから再投入
  console.log('🗑  既存の商品データを削除中...')
  const { error: deleteError } = await supabase
    .from('products')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // 全件対象
  if (deleteError) throw new Error(`削除: ${deleteError.message}`)
  console.log('✅ 削除完了\n')

  console.log('🍙 新しい商品データを投入中...')
  const { error: insertError } = await supabase
    .from('products')
    .insert(PRODUCTS)
  if (insertError) throw new Error(`投入: ${insertError.message}`)
  console.log(`✅ ${PRODUCTS.length}品 投入完了\n`)

  const { data } = await supabase.from('products').select('name, price, topping_available').order('sort_order')
  console.log('📋 登録済み商品一覧:')
  for (const p of (data ?? [])) {
    const topping = p.topping_available ? '（とろろ昆布○）' : ''
    console.log(`   ${p.name.padEnd(14)} ¥${String(p.price).padEnd(5)} ${topping}`)
  }
  console.log('\n✨ 更新完了！')
}

main().catch((e) => {
  console.error('❌ エラー:', e.message)
  process.exit(1)
})
