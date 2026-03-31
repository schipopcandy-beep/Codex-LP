/**
 * DBセットアップスクリプト
 * 使い方: node scripts/setup-db.mjs
 *
 * 事前に .env.local に Supabase の接続情報を設定しておいてください。
 * schema.sql は Supabase ダッシュボードの SQL Editor で実行済みであること。
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// .env.local を手動で読み込む
const envPath = resolve(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) process.env[match[1].trim()] = match[2].trim()
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ .env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

// ─── テーブルの存在確認 ───────────────────────────────────────────
async function checkTablesExist() {
  const { data, error } = await supabase.from('tables').select('id').limit(1)
  if (error && error.code === '42P01') return false // テーブルなし
  if (error) throw new Error(`接続エラー: ${error.message}`)
  return true
}

// ─── 席マスタ ─────────────────────────────────────────────────────
const TABLES = [
  { id: 'table-1',   name: 'テーブル席 1', is_active: true },
  { id: 'table-2',   name: 'テーブル席 2', is_active: true },
  { id: 'table-3',   name: 'テーブル席 3', is_active: true },
  { id: 'table-4',   name: 'テーブル席 4', is_active: true },
  { id: 'counter-1', name: 'カウンター 1', is_active: true },
  { id: 'counter-2', name: 'カウンター 2', is_active: true },
  { id: 'counter-3', name: 'カウンター 3', is_active: true },
  { id: 'counter-4', name: 'カウンター 4', is_active: true },
]

// ─── 商品マスタ ───────────────────────────────────────────────────
const PRODUCTS = [
  { name: '伊達の旨塩にぎり', price: 250,  description: 'シンプルな塩味の握り。素材の旨みを引き出したやさしい一品',  category: 'おにぎり', sort_order: 10,  is_sold_out: false, topping_available: true  },
  { name: '焼しゃけ',         price: 350,  description: '香ばしく焼き上げたサーモンを贅沢に使用',                    category: 'おにぎり', sort_order: 20,  is_sold_out: false, topping_available: true  },
  { name: 'おかかチー',       price: 400,  description: 'かつお節とクリームチーズの意外なハーモニー',                category: 'おにぎり', sort_order: 30,  is_sold_out: false, topping_available: true  },
  { name: 'えびマヨ',         price: 450,  description: 'プリプリ海老とこだわりマヨネーズの人気の組み合わせ',        category: 'おにぎり', sort_order: 40,  is_sold_out: false, topping_available: true  },
  { name: 'おかか',           price: 300,  description: '昔懐かしいかつお節の旨みを凝縮',                           category: 'おにぎり', sort_order: 50,  is_sold_out: false, topping_available: true  },
  { name: 'ツナマヨ',         price: 350,  description: 'ほぐしツナとマヨネーズのやさしい味わい',                   category: 'おにぎり', sort_order: 60,  is_sold_out: false, topping_available: true  },
  { name: '辛子明太子',       price: 400,  description: 'ピリッと辛い明太子をたっぷりと',                           category: 'おにぎり', sort_order: 70,  is_sold_out: false, topping_available: true  },
  { name: 'ルーロー',         price: 450,  description: '台湾風の甘辛八角煮込みを和えた個性派おにぎり',             category: 'おにぎり', sort_order: 80,  is_sold_out: false, topping_available: false },
  { name: '海苔佃煮',         price: 300,  description: '海の風味豊かな佃煮がご飯に馴染む一品',                     category: 'おにぎり', sort_order: 90,  is_sold_out: false, topping_available: true  },
  { name: '鶏そぼろ',         price: 400,  description: '甘辛に炊いた鶏そぼろをたっぷり混ぜ込み',                  category: 'おにぎり', sort_order: 100, is_sold_out: false, topping_available: true  },
  { name: '萩のしそひじき',   price: 400,  description: '国産しそとひじきの風味豊かな混ぜ込みおにぎり',            category: 'おにぎり', sort_order: 110, is_sold_out: false, topping_available: true  },
  { name: '極み筋子',         price: 600,  description: '厳選した上質な筋子を惜しみなく使用した贅沢な一品',        category: 'おにぎり', sort_order: 120, is_sold_out: false, topping_available: true  },
  { name: 'ほぐし梅',         price: 300,  description: '紀州産梅を手でほぐした昔ながらの梅おにぎり',              category: 'おにぎり', sort_order: 130, is_sold_out: false, topping_available: true  },
  { name: '焼きおにぎり',     price: 400,  description: '醤油を塗って香ばしく焼き上げた定番の焼きおにぎり',        category: 'おにぎり', sort_order: 140, is_sold_out: false, topping_available: false },
  { name: 'ガパオ',           price: 400,  description: 'バジルと鶏肉のエスニックな旨味が詰まった創作おにぎり',    category: 'おにぎり', sort_order: 150, is_sold_out: false, topping_available: false },
  { name: 'しゃけ筋子',       price: 650,  description: '焼しゃけと贅沢な筋子を合わせた最高級の組み合わせ',        category: 'おにぎり', sort_order: 160, is_sold_out: false, topping_available: true  },
]

// ─── メイン処理 ────────────────────────────────────────────────────
async function main() {
  console.log('🍙 おにぎり注文システム DBセットアップ\n')

  // テーブル存在確認
  console.log('⏳ テーブルの存在を確認中...')
  const exists = await checkTablesExist()
  if (!exists) {
    console.error(`
❌ テーブルが存在しません。

先に Supabase ダッシュボードの SQL Editor で
  supabase/schema.sql
の内容を実行してください。

https://supabase.com/dashboard/project/wgjfwjourukgtxpkuaup/sql/new
    `)
    process.exit(1)
  }
  console.log('✅ テーブル確認OK\n')

  // 席マスタ
  console.log('📍 席マスタを投入中...')
  const { error: tableError } = await supabase
    .from('tables')
    .upsert(TABLES, { onConflict: 'id' })
  if (tableError) throw new Error(`席マスタ: ${tableError.message}`)
  console.log(`✅ ${TABLES.length}席 投入完了\n`)

  // 商品マスタ
  console.log('🍙 商品マスタを投入中...')
  const { error: productError } = await supabase
    .from('products')
    .upsert(PRODUCTS, { onConflict: 'name' })
  if (productError) throw new Error(`商品マスタ: ${productError.message}`)
  console.log(`✅ ${PRODUCTS.length}品 投入完了\n`)

  // 確認
  const { data: products } = await supabase.from('products').select('name, price').order('sort_order')
  console.log('📋 登録済み商品一覧:')
  for (const p of (products ?? [])) {
    console.log(`   ${p.name.padEnd(16)} ¥${p.price}`)
  }

  console.log('\n✨ セットアップ完了！')
  console.log('   npm run dev でアプリを起動してください。')
}

main().catch((e) => {
  console.error('❌ エラー:', e.message)
  process.exit(1)
})
