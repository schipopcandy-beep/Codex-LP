/**
 * 織はや GAS スクリプト
 *
 * スクリプトプロパティ（設定 > スクリプトプロパティ）に以下を登録:
 *   SUPABASE_URL              : https://xxxxxxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY : eyJhbGci...（Supabase > Settings > API > service_role）
 *   LINE_CHANNEL_ACCESS_TOKEN : （LINE Developers > Channel access token）
 *
 * スクリプトプロパティ（任意追加）:
 *   OPENWEATHER_API_KEY    : OpenWeatherMap API キー（売上予測の天気係数に使用）
 *
 * 関数一覧:
 *   refreshAll()             - 全シートをまとめて最新化（手動 or 日次トリガー）
 *   exportTakeoutHistory()   - テイクアウト履歴シートを更新
 *   exportEatinHistory()     - 店内注文履歴シートを更新
 *   exportDailySales()       - 商品日次販売数シートを更新
 *   exportSoldoutLogs()      - 売切時刻シートを更新
 *   exportVisitLog()         - 来店記録シートを更新
 *   exportSalesAnalysis()    - 売上分析シートを更新（天気・競合・イベント付き）
 *   exportSalesForecast()    - 売上予測シートを更新（今後1か月）
 *   sendWeeklyFollowUp()     - 7日前来店者にLINEメッセージ送信（毎日トリガー推奨）
 */

// ─── 設定 ───────────────────────────────────────────────────────

const CONFIG = {
  TOPPING_PRICE: 50,
  FOLLOW_UP_MESSAGE: '先日は織はやにご来店いただきありがとうございました😊\nまたのご来店をお待ちしております！',
  SALES_DAYS: 30,        // 日次販売数の集計期間（日）
  TAKEOUT_LIMIT: 500,    // テイクアウト履歴の取得件数

  // 期間限定メニューのお知らせ（空文字にすると送らない）
  LIMITED_MENU_IMAGE_URL: '',   // Supabase Storage の画像URL（https://...）
  LIMITED_MENU_TEXT: '',        // 例: '🌟期間限定メニュー登場！\n【商品名】¥○○\nぜひこの機会にお試しください！'
}

/** フォローアップで送るメッセージ配列を生成する */
function buildFollowUpMessages() {
  const messages = [{ type: 'text', text: CONFIG.FOLLOW_UP_MESSAGE }]

  if (CONFIG.LIMITED_MENU_IMAGE_URL && CONFIG.LIMITED_MENU_TEXT) {
    messages.push({
      type: 'image',
      originalContentUrl: CONFIG.LIMITED_MENU_IMAGE_URL,
      previewImageUrl:    CONFIG.LIMITED_MENU_IMAGE_URL,
    })
    messages.push({ type: 'text', text: CONFIG.LIMITED_MENU_TEXT })
  }

  return messages
}

function getProps() {
  const p = PropertiesService.getScriptProperties()
  return {
    supabaseUrl: p.getProperty('SUPABASE_URL'),
    supabaseKey: p.getProperty('SUPABASE_SERVICE_ROLE_KEY'),
    lineToken:   p.getProperty('LINE_CHANNEL_ACCESS_TOKEN'),
  }
}

// ─── Supabase ヘルパー ───────────────────────────────────────────

function supabaseGet(table, params) {
  const { supabaseUrl, supabaseKey } = getProps()
  const base = supabaseUrl.replace(/\/+$/, '') // 末尾スラッシュを除去

  // params はオブジェクトまたは [[key, value], ...] 配列（同キー複数対応）
  const entries = Array.isArray(params) ? params : Object.entries(params)
  const queryParts = entries.map(([k, v]) => `${k}=${v}`)
  const url = `${base}/rest/v1/${table}?${queryParts.join('&')}`

  console.log('Supabase URL:', url) // デバッグ用：実行ログで確認可能

  const res = UrlFetchApp.fetch(url, {
    headers: {
      apikey:        supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Accept:        'application/json',
    },
    muteHttpExceptions: true,
  })
  if (res.getResponseCode() !== 200) {
    throw new Error(`Supabase error ${res.getResponseCode()}: ${res.getContentText()}`)
  }
  return JSON.parse(res.getContentText())
}

// ─── 日付ヘルパー ──────────────────────────────────────────────

function toJstDate(isoStr) {
  return new Date(new Date(isoStr).getTime() + 9 * 3600000)
}

function jstDateStr(jstDate) {
  return Utilities.formatDate(jstDate, 'Asia/Tokyo', 'yyyy/MM/dd')
}

function jstTimeStr(isoStr) {
  return Utilities.formatDate(toJstDate(isoStr), 'Asia/Tokyo', 'HH:mm')
}

function utcRangeForJstDay(jstDate) {
  // jstDate の日本時間 0:00〜24:00 を UTC に変換して返す
  const jstMidnight = new Date(jstDate.getFullYear(), jstDate.getMonth(), jstDate.getDate())
  const start = new Date(jstMidnight.getTime() - 9 * 3600000).toISOString()
  const end   = new Date(jstMidnight.getTime() - 9 * 3600000 + 86400000).toISOString()
  return { start, end }
}

function nDaysAgoJst(n) {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 3600000)
  return new Date(jst.getFullYear(), jst.getMonth(), jst.getDate() - n)
}

// ─── 共通: ヘッダースタイル ─────────────────────────────────────

function styleHeader(sheet, numCols) {
  const header = sheet.getRange(1, 1, 1, numCols)
  header.setFontWeight('bold')
       .setBackground('#f5f0e8')
       .setFontColor('#5c3d2e')
  sheet.setFrozenRows(1)
}

function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  return ss.getSheetByName(name) || ss.insertSheet(name)
}

// ─── 接続テスト ──────────────────────────────────────────────────

function testConnection() {
  try {
    const data = supabaseGet('orders', { limit: 1, select: 'id,status' })
    console.log('接続OK:', JSON.stringify(data))
    SpreadsheetApp.getActiveSpreadsheet().toast('Supabase 接続OK', '成功', 3)
  } catch (e) {
    console.error('接続エラー:', e.message)
    SpreadsheetApp.getActiveSpreadsheet().toast(`エラー: ${e.message}`, '失敗', 10)
  }
}

// ─── 1. テイクアウト履歴 ─────────────────────────────────────────

function exportTakeoutHistory() {
  const data = supabaseGet('orders', {
    select:    'id,line_user_id,created_at,pickup_at,order_items(unit_price,quantity,with_topping,products(name))',
    table_id:  'eq.takeout',
    status:    'eq.paid',
    order:     'created_at.desc',
    limit:     CONFIG.TAKEOUT_LIMIT,
  })

  const sheet = getOrCreateSheet('テイクアウト履歴')
  sheet.clearContents()

  const headers = ['注文日', '受取時刻', '商品名', '数量', '単価', '小計', 'LINE user ID']
  const rows = [headers]

  for (const order of data) {
    const dateStr   = jstDateStr(toJstDate(order.created_at))
    const pickupStr = order.pickup_at ? jstTimeStr(order.pickup_at) : '—'
    const userId    = order.line_user_id || '—'
    const items = order.order_items || []

    if (items.length === 0) {
      rows.push([dateStr, pickupStr, '（商品なし）', '', '', '', userId])
      continue
    }

    for (const item of items) {
      const unitPrice = item.unit_price + (item.with_topping ? CONFIG.TOPPING_PRICE : 0)
      rows.push([
        dateStr,
        pickupStr,
        item.products?.name ?? '不明',
        item.quantity,
        unitPrice,
        unitPrice * item.quantity,
        userId,
      ])
    }
  }

  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows)
  styleHeader(sheet, headers.length)
  sheet.autoResizeColumns(1, headers.length)
  SpreadsheetApp.getActiveSpreadsheet().toast(`テイクアウト履歴: ${rows.length - 1}行を更新しました`, '完了', 3)
}

// ─── 2. 商品日次販売数（ピボット形式）────────────────────────────

function exportDailySales() {
  const fromJst = nDaysAgoJst(CONFIG.SALES_DAYS - 1)
  const { start: fromUtc } = utcRangeForJstDay(fromJst)

  const data = supabaseGet('orders', {
    select:       'created_at,order_items(quantity,products(name,category))',
    status:       'eq.paid',
    'created_at': `gte.${fromUtc}`,
    order:        'created_at.asc',
  })

  // 日付一覧と商品一覧を収集
  const dateSet    = new Set()
  const productSet = new Set()

  // [productName][dateStr] = total_quantity
  const matrix = {}

  for (const order of data) {
    const ds = jstDateStr(toJstDate(order.created_at))
    dateSet.add(ds)
    for (const item of order.order_items || []) {
      const name = item.products?.name ?? '不明'
      productSet.add(name)
      if (!matrix[name]) matrix[name] = {}
      matrix[name][ds] = (matrix[name][ds] ?? 0) + item.quantity
    }
  }

  const dates    = [...dateSet].sort()
  const products = [...productSet].sort()

  const sheet = getOrCreateSheet('日次販売数')
  sheet.clearContents()

  const headers = ['商品名', ...dates]
  const rows    = [headers]

  for (const product of products) {
    const row = [product]
    for (const ds of dates) {
      row.push(matrix[product]?.[ds] ?? 0)
    }
    rows.push(row)
  }

  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows)
  styleHeader(sheet, headers.length)
  sheet.autoResizeColumn(1)
  SpreadsheetApp.getActiveSpreadsheet().toast(`日次販売数: ${products.length}商品 × ${dates.length}日を更新しました`, '完了', 3)
}

// ─── 3. 売切時刻 ────────────────────────────────────────────────

function exportSoldoutLogs() {
  const fromJst = nDaysAgoJst(CONFIG.SALES_DAYS - 1)
  const fromStr = Utilities.formatDate(fromJst, 'Asia/Tokyo', 'yyyy-MM-dd')

  const data = supabaseGet('product_soldout_log', {
    select: 'product_name,sold_out_at,date',
    date:   `gte.${fromStr}`,
    order:  'date.desc,sold_out_at.asc',
    limit:  300,
  })

  const sheet = getOrCreateSheet('売切時刻')
  sheet.clearContents()

  const headers = ['日付', '商品名', '売切時刻']
  const rows    = [headers]

  for (const log of data) {
    rows.push([
      log.date.replace(/-/g, '/'),
      log.product_name,
      jstTimeStr(log.sold_out_at),
    ])
  }

  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows)
  styleHeader(sheet, headers.length)
  sheet.autoResizeColumns(1, headers.length)
  SpreadsheetApp.getActiveSpreadsheet().toast(`売切時刻: ${rows.length - 1}件を更新しました`, '完了', 3)
}

// ─── 4. まとめて更新 ────────────────────────────────────────────

function refreshAll() {
  exportTakeoutHistory()
  exportEatinHistory()
  exportDailySales()
  exportSoldoutLogs()
  exportVisitLog()
  exportSalesAnalysis()
  exportSalesForecast()
}

// ─── 5. 来店記録 ─────────────────────────────────────────────────

function exportVisitLog() {
  const data = supabaseGet('orders', [
    ['select',       'line_user_id,created_at,table_id'],
    ['status',       'eq.paid'],
    ['line_user_id', 'not.is.null'],
    ['order',        'created_at.desc'],
    ['limit',        5000],
  ])

  // (line_user_id, 来店日) ごとに集計
  const visitMap = new Map()
  for (const order of data) {
    if (!order.line_user_id) continue
    const ds      = jstDateStr(toJstDate(order.created_at))
    const key     = `${order.line_user_id}__${ds}`
    const type    = order.table_id === 'takeout' ? 'テイクアウト' : 'イートイン'
    const existing = visitMap.get(key)
    if (existing) {
      existing.count++
      if (existing.type !== type) existing.type = '両方'
    } else {
      visitMap.set(key, { userId: order.line_user_id, date: ds, count: 1, type })
    }
  }

  const visits = [...visitMap.values()].sort((a, b) => b.date.localeCompare(a.date))

  const sheet   = getOrCreateSheet('来店記録')
  sheet.clearContents()
  const headers = ['LINE user_id', '来店日', '注文数', '注文タイプ']
  const rows    = [headers, ...visits.map(v => [v.userId, v.date, v.count, v.type])]

  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows)
  styleHeader(sheet, headers.length)
  sheet.setColumnWidth(1, 240) // LINE ID は長いので幅を広く
  sheet.autoResizeColumns(2, headers.length - 1)
  SpreadsheetApp.getActiveSpreadsheet().toast(`来店記録: ${visits.length}件を更新しました`, '完了', 3)
}

// ─── 6. 店内注文履歴 ─────────────────────────────────────────────

function exportEatinHistory() {
  const data = supabaseGet('orders', [
    ['select',   'id,line_user_id,created_at,table_id,order_items(unit_price,quantity,with_topping,products(name))'],
    ['table_id', 'neq.takeout'],
    ['status',   'eq.paid'],
    ['order',    'created_at.desc'],
    ['limit',    CONFIG.TAKEOUT_LIMIT],
  ])

  const sheet = getOrCreateSheet('店内注文履歴')
  sheet.clearContents()

  const headers = ['注文日', '注文時刻', 'テーブル', '商品名', '数量', '単価', '小計', 'LINE user ID']
  const rows = [headers]

  for (const order of data) {
    const jst     = toJstDate(order.created_at)
    const dateStr = jstDateStr(jst)
    const timeStr = Utilities.formatDate(jst, 'Asia/Tokyo', 'HH:mm')
    const tableStr = order.table_id || '—'
    const userId   = order.line_user_id || '—'
    const items   = order.order_items || []

    if (items.length === 0) {
      rows.push([dateStr, timeStr, tableStr, '（商品なし）', '', '', '', userId])
      continue
    }

    for (const item of items) {
      const unitPrice = item.unit_price + (item.with_topping ? CONFIG.TOPPING_PRICE : 0)
      rows.push([
        dateStr,
        timeStr,
        tableStr,
        item.products?.name ?? '不明',
        item.quantity,
        unitPrice,
        unitPrice * item.quantity,
        userId,
      ])
    }
  }

  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows)
  styleHeader(sheet, headers.length)
  sheet.autoResizeColumns(1, headers.length)
  SpreadsheetApp.getActiveSpreadsheet().toast(`店内注文履歴: ${rows.length - 1}行を更新しました`, '完了', 3)
}

// ─── 7. 売上分析（日付・曜日・天気・競合・イベント・売上）────────

function exportSalesAnalysis() {
  const fromJst   = nDaysAgoJst(CONFIG.SALES_DAYS - 1)
  const todayJst  = nDaysAgoJst(0)
  const { start: fromUtc } = utcRangeForJstDay(fromJst)
  const fromStr   = Utilities.formatDate(fromJst, 'Asia/Tokyo', 'yyyy-MM-dd')
  const todayStr  = Utilities.formatDate(todayJst, 'Asia/Tokyo', 'yyyy-MM-dd')

  // 日次売上
  const orders = supabaseGet('orders', [
    ['select',     'created_at,order_items(unit_price,quantity,with_topping)'],
    ['status',     'eq.paid'],
    ['created_at', 'gte.' + fromUtc],
    ['order',      'created_at.asc'],
  ])

  const dailyRev = {}
  for (let oi = 0; oi < orders.length; oi++) {
    const order = orders[oi]
    const ds    = jstDateStr(toJstDate(order.created_at))
    const items = order.order_items || []
    for (let ii = 0; ii < items.length; ii++) {
      const item  = items[ii]
      const price = item.unit_price + (item.with_topping ? CONFIG.TOPPING_PRICE : 0)
      dailyRev[ds] = (dailyRev[ds] || 0) + price * item.quantity
    }
  }

  // 天気ログ
  const weatherLogs = supabaseGet('weather_log', [
    ['select', 'date,weather_main'],
    ['date',   'gte.' + fromStr],
    ['order',  'date.asc'],
  ])
  const weatherMap = {}
  for (let wi = 0; wi < weatherLogs.length; wi++) {
    const w = weatherLogs[wi]
    weatherMap[w.date.replace(/-/g, '/')] = w.weather_main
  }

  // 競合店一覧（is_active=true のみ ⑤）
  const shops = supabaseGet('competitor_shops', [
    ['select',    'id,name,open_weekdays'],
    ['is_active', 'eq.true'],
    ['order',     'name.asc'],
  ])

  // 競合ステータスオーバーライド
  const statusLogs = supabaseGet('competitor_status_log', [
    ['select', 'shop_id,date,is_open'],
    ['date',   'gte.' + fromStr],
  ])
  const statusMap = {}
  for (let si = 0; si < statusLogs.length; si++) {
    const s = statusLogs[si]
    if (!statusMap[s.shop_id]) statusMap[s.shop_id] = {}
    statusMap[s.shop_id][s.date.replace(/-/g, '/')] = s.is_open
  }

  // イベント（複数日対応: 2週間前から取得して end_date まで展開 ④）
  const evFromStr = Utilities.formatDate(nDaysAgoJst(CONFIG.SALES_DAYS + 13), 'Asia/Tokyo', 'yyyy-MM-dd')
  const rawEvents = supabaseGet('sendai_events', [
    ['select', 'date,end_date,name'],
    ['date',   'gte.' + evFromStr],
    ['date',   'lte.' + todayStr],
  ])
  const eventMap = {}
  for (let ei = 0; ei < rawEvents.length; ei++) {
    const ev    = rawEvents[ei]
    const start = new Date(ev.date + 'T12:00:00+09:00')
    const end   = ev.end_date ? new Date(ev.end_date + 'T12:00:00+09:00') : new Date(start)
    const cur   = new Date(start)
    while (cur <= end) {
      const ds = Utilities.formatDate(cur, 'Asia/Tokyo', 'yyyy/MM/dd')
      eventMap[ds] = eventMap[ds] ? eventMap[ds] + ' / ' + ev.name : ev.name
      cur.setDate(cur.getDate() + 1)
    }
  }

  const DOW_NAMES = ['日', '月', '火', '水', '木', '金', '土']

  const dates = []
  for (let i = 0; i < CONFIG.SALES_DAYS; i++) {
    const d = nDaysAgoJst(CONFIG.SALES_DAYS - 1 - i)
    dates.push(Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy/MM/dd'))
  }

  const shopNames = []
  for (let si = 0; si < shops.length; si++) shopNames.push(shops[si].name)
  const headers = ['日付', '曜日', '天気'].concat(shopNames).concat(['イベント情報', '売上'])
  const rows = [headers]

  for (let di = 0; di < dates.length; di++) {
    const ds  = dates[di]
    const d   = new Date(ds.replace(/\//g, '-') + 'T12:00:00+09:00')
    const dow = d.getDay()

    const shopStatuses = []
    for (let si = 0; si < shops.length; si++) {
      const shop      = shops[si]
      const overrides = statusMap[shop.id] || {}
      const override  = overrides[ds]
      const openDays  = Array.isArray(shop.open_weekdays) ? shop.open_weekdays : []
      const isOpen    = override !== undefined ? override : openDays.indexOf(dow) !== -1
      shopStatuses.push(isOpen ? '営業' : '休業')
    }

    const row = [ds, DOW_NAMES[dow], weatherMap[ds] || '—']
    for (let si = 0; si < shopStatuses.length; si++) row.push(shopStatuses[si])
    row.push(eventMap[ds] || '—')
    row.push(dailyRev[ds] || 0)
    rows.push(row)
  }

  const sheet = getOrCreateSheet('売上分析')
  sheet.clearContents()
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows)
  styleHeader(sheet, headers.length)
  sheet.autoResizeColumns(1, headers.length)
  SpreadsheetApp.getActiveSpreadsheet().toast('売上分析: ' + (rows.length - 1) + '日分を更新しました', '完了', 3)
}

// ─── 8. 売上予測（今後1か月）─── 管理画面と同一ロジック ──────────

function exportSalesForecast() {
  const HIST_DAYS     = 180  // ③ 6か月（管理画面と同じ）
  const FORECAST_DAYS = 30
  const EVENT_FACTORS = [1.0, 1.03, 1.07, 1.12, 1.20, 1.30] // scale 0〜5
  const COMP_FACTOR   = 1.12 // ② 休業1店でも一律×1.12（管理画面と同じ）

  // ─ 過去売上 → 曜日平均 ③
  const histFromJst = nDaysAgoJst(HIST_DAYS - 1)
  const histFromStr = Utilities.formatDate(histFromJst, 'Asia/Tokyo', 'yyyy-MM-dd')
  const { start: histFromUtc } = utcRangeForJstDay(histFromJst)

  const histOrders = supabaseGet('orders', [
    ['select',     'created_at,order_items(unit_price,quantity,with_topping)'],
    ['status',     'eq.paid'],
    ['created_at', 'gte.' + histFromUtc],
  ])

  const histDailyRev = {}
  for (let oi = 0; oi < histOrders.length; oi++) {
    const order = histOrders[oi]
    const ds    = jstDateStr(toJstDate(order.created_at))
    const items = order.order_items || []
    for (let ii = 0; ii < items.length; ii++) {
      const item  = items[ii]
      const price = item.unit_price + (item.with_topping ? CONFIG.TOPPING_PRICE : 0)
      histDailyRev[ds] = (histDailyRev[ds] || 0) + price * item.quantity
    }
  }

  // 曜日平均
  const dowBuckets = [[], [], [], [], [], [], []]
  const histDsList = Object.keys(histDailyRev)
  for (let i = 0; i < histDsList.length; i++) {
    const ds  = histDsList[i]
    const dow = new Date(ds.replace(/\//g, '-') + 'T12:00:00+09:00').getDay()
    dowBuckets[dow].push(histDailyRev[ds])
  }
  const dowAvg = []
  for (let d = 0; d < 7; d++) {
    const revs = dowBuckets[d]
    if (revs.length > 0) {
      let sum = 0
      for (let i = 0; i < revs.length; i++) sum += revs[i]
      dowAvg.push(Math.round(sum / revs.length))
    } else {
      dowAvg.push(0)
    }
  }

  // ─ ① 天気係数を過去データの相関から動的算出（データ不足時は固定値フォールバック）
  // 固定値フォールバック: weather_log の蓄積が少ない天気タイプに使用
  const FALLBACK_WEATHER_FACTORS = { Clear: 1.08, Clouds: 1.0, Rain: 0.82, Drizzle: 0.88, Snow: 0.75, Thunderstorm: 0.70 }

  const histWeatherLogs = supabaseGet('weather_log', [
    ['select', 'date,weather_main'],
    ['date',   'gte.' + histFromStr],
  ])
  const histWeatherMap = {}
  for (let wi = 0; wi < histWeatherLogs.length; wi++) {
    const w = histWeatherLogs[wi]
    if (w.weather_main) histWeatherMap[w.date.replace(/-/g, '/')] = w.weather_main
  }

  // 全体平均売上
  let totalRevSum = 0, totalRevCnt = 0
  for (let i = 0; i < histDsList.length; i++) {
    totalRevSum += histDailyRev[histDsList[i]]
    totalRevCnt++
  }
  const overallAvg = totalRevCnt > 0 ? totalRevSum / totalRevCnt : 0

  // 天気カテゴリごとの平均売上 → 係数
  const wBuckets = {}
  for (let i = 0; i < histDsList.length; i++) {
    const ds = histDsList[i]
    const w  = histWeatherMap[ds]
    if (!w) continue
    if (!wBuckets[w]) wBuckets[w] = { total: 0, count: 0 }
    wBuckets[w].total += histDailyRev[ds]
    wBuckets[w].count++
  }
  const dynamicWeatherFactors = {}
  if (overallAvg > 0) {
    const wKeys = Object.keys(wBuckets)
    for (let wi = 0; wi < wKeys.length; wi++) {
      const w = wKeys[wi]
      const b = wBuckets[w]
      dynamicWeatherFactors[w] = b.count > 0
        ? Math.round(b.total / b.count / overallAvg * 100) / 100
        : 1.0
    }
  }

  // ─ 競合店（is_active=true のみ ⑤）
  const shops = supabaseGet('competitor_shops', [
    ['select',    'id,name,open_weekdays'],
    ['is_active', 'eq.true'],
    ['order',     'name.asc'],
  ])

  const todayJst = nDaysAgoJst(0)
  const todayStr = Utilities.formatDate(todayJst, 'Asia/Tokyo', 'yyyy-MM-dd')
  const endJst   = nDaysAgoJst(-FORECAST_DAYS)
  const endStr   = Utilities.formatDate(endJst, 'Asia/Tokyo', 'yyyy-MM-dd')

  // ─ 競合ステータスオーバーライド（今後1か月）
  const statusLogs = supabaseGet('competitor_status_log', [
    ['select', 'shop_id,date,is_open'],
    ['date',   'gte.' + todayStr],
    ['date',   'lte.' + endStr],
  ])
  const statusMap = {}
  for (let si = 0; si < statusLogs.length; si++) {
    const s = statusLogs[si]
    if (!statusMap[s.shop_id]) statusMap[s.shop_id] = {}
    statusMap[s.shop_id][s.date.replace(/-/g, '/')] = s.is_open
  }

  // ─ イベント（複数日対応: 2週間前から取得して end_date まで展開 ④）
  const evPastStr = Utilities.formatDate(nDaysAgoJst(14), 'Asia/Tokyo', 'yyyy-MM-dd')
  const rawEvents = supabaseGet('sendai_events', [
    ['select', 'date,end_date,name,scale'],
    ['date',   'gte.' + evPastStr],
    ['date',   'lte.' + endStr],
  ])
  const eventMap = {}
  for (let ei = 0; ei < rawEvents.length; ei++) {
    const ev    = rawEvents[ei]
    const start = new Date(ev.date + 'T12:00:00+09:00')
    const evEnd = ev.end_date ? new Date(ev.end_date + 'T12:00:00+09:00') : new Date(start)
    const cur   = new Date(start)
    while (cur <= evEnd) {
      const ds = Utilities.formatDate(cur, 'Asia/Tokyo', 'yyyy/MM/dd')
      if (!eventMap[ds] || ev.scale > eventMap[ds].scale) {
        eventMap[ds] = { name: ev.name, scale: ev.scale }
      }
      cur.setDate(cur.getDate() + 1)
    }
  }

  // ─ 天気予報（OpenWeatherMap Forecast API）
  const weatherApiKey = PropertiesService.getScriptProperties().getProperty('OPENWEATHER_API_KEY')
  const forecastWeatherMap = {}
  if (weatherApiKey) {
    try {
      const wRes = UrlFetchApp.fetch(
        'https://api.openweathermap.org/data/2.5/forecast?q=Sendai,JP&appid=' + weatherApiKey + '&units=metric&cnt=40',
        { muteHttpExceptions: true }
      )
      if (wRes.getResponseCode() === 200) {
        const wData  = JSON.parse(wRes.getContentText())
        const counts = {}
        const wList  = wData.list || []
        for (let wi = 0; wi < wList.length; wi++) {
          const item = wList[wi]
          const ds   = Utilities.formatDate(new Date(item.dt * 1000), 'Asia/Tokyo', 'yyyy/MM/dd')
          const wArr = item.weather || []
          const main = wArr.length > 0 ? wArr[0].main : 'Clouds'
          if (!counts[ds]) counts[ds] = {}
          counts[ds][main] = (counts[ds][main] || 0) + 1
        }
        const dsKeys = Object.keys(counts)
        for (let ki = 0; ki < dsKeys.length; ki++) {
          const ds   = dsKeys[ki]
          const c    = counts[ds]
          const cKeys = Object.keys(c)
          let best = cKeys[0]
          for (let ci = 1; ci < cKeys.length; ci++) {
            if (c[cKeys[ci]] > c[best]) best = cKeys[ci]
          }
          forecastWeatherMap[ds] = best
        }
      }
    } catch (e) {
      console.log('Weather forecast fetch failed:', e.message)
    }
  }

  // ─ シート出力
  const DOW_NAMES = ['日', '月', '火', '水', '木', '金', '土']
  const headers   = ['日付', '曜日', '売上予測', '曜日平均', '天気係数', '競合休業係数', 'イベント係数', '天気']
  const rows      = [headers]

  for (let i = 0; i < FORECAST_DAYS; i++) {
    const d   = new Date(todayJst.getTime() + i * 86400000)
    const ds  = Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy/MM/dd')
    const dow = new Date(ds.replace(/\//g, '-') + 'T12:00:00+09:00').getDay()
    const base = dowAvg[dow]

    // ① 天気係数（過去データ相関 → なければ固定値 → なければ1.0）
    const forecastWeather = forecastWeatherMap[ds] || null
    const wFactor = forecastWeather
      ? (dynamicWeatherFactors[forecastWeather] || FALLBACK_WEATHER_FACTORS[forecastWeather] || 1.0)
      : 1.0

    // ② 競合休業係数: 定休日以外の臨時休業が1店でもあれば×1.12（管理画面と同一）
    let reducedCompetition = false
    for (let si = 0; si < shops.length; si++) {
      const shop       = shops[si]
      const openDays   = Array.isArray(shop.open_weekdays) ? shop.open_weekdays : []
      const defaultOpen = openDays.indexOf(dow) !== -1
      const overrides  = statusMap[shop.id] || {}
      const override   = overrides[ds]
      const isOpen     = override !== undefined ? override : defaultOpen
      if (defaultOpen && !isOpen) reducedCompetition = true
    }
    const cFactor = reducedCompetition ? COMP_FACTOR : 1.0

    // イベント係数
    const ev      = eventMap[ds]
    const eScale  = ev ? Math.min(ev.scale, EVENT_FACTORS.length - 1) : 0
    const eFactor = ev ? (EVENT_FACTORS[eScale] || 1.0) : 1.0

    const predicted = Math.round(base * wFactor * cFactor * eFactor)

    rows.push([ds, DOW_NAMES[dow], predicted, base, wFactor, cFactor, eFactor, forecastWeather || '—'])
  }

  const sheet = getOrCreateSheet('売上予測')
  sheet.clearContents()
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows)
  styleHeader(sheet, headers.length)
  sheet.autoResizeColumns(1, headers.length)
  SpreadsheetApp.getActiveSpreadsheet().toast('売上予測: ' + FORECAST_DAYS + '日分を更新しました', '完了', 3)
}

// ─── 9. 1週間後フォローアップ LINE メッセージ ────────────────────

function sendWeeklyFollowUp() {
  const { lineToken } = getProps()
  if (!lineToken) { console.log('LINE_CHANNEL_ACCESS_TOKEN が未設定です'); return }

  // 7日前の来店者を「来店記録」シートから取得
  const targetDay     = nDaysAgoJst(7)
  const targetDateStr = Utilities.formatDate(targetDay, 'Asia/Tokyo', 'yyyy/MM/dd')

  const visitSheet = getOrCreateSheet('来店記録')
  if (visitSheet.getLastRow() <= 1) {
    console.log('来店記録が空です。先に refreshAll() を実行してください')
    return
  }

  const visitData = visitSheet.getRange(2, 1, visitSheet.getLastRow() - 1, 2).getValues()
  const userIds   = [...new Set(
    visitData.filter(row => row[1] === targetDateStr && row[0]).map(row => String(row[0]))
  )]

  if (userIds.length === 0) {
    console.log(`${targetDateStr}: 対象ユーザーなし`)
    return
  }

  console.log(`${targetDateStr}: 対象 ${userIds.length} 人`)

  // 送信済みログシートで重複送信を防ぐ
  const logSheet = getOrCreateSheet('送信ログ')
  if (logSheet.getLastRow() === 0) {
    logSheet.appendRow(['送信日時', '来店日', 'LINE user_id', '結果'])
    styleHeader(logSheet, 4)
  }

  const sentKeys = new Set()
  if (logSheet.getLastRow() > 1) {
    const logData = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 3).getValues()
    for (const [, visitDate, userId] of logData) {
      sentKeys.add(`${visitDate}__${userId}`)
    }
  }

  const nowJstStr = Utilities.formatDate(new Date(Date.now() + 9 * 3600000), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm')
  let sentCount = 0
  let skipCount = 0

  for (const userId of userIds) {
    const key = `${targetDateStr}__${userId}`
    if (sentKeys.has(key)) { skipCount++; continue }

    let result = 'OK'
    try {
      const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
        method: 'post',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${lineToken}`,
        },
        payload: JSON.stringify({
          to: userId,
          messages: buildFollowUpMessages(),
        }),
        muteHttpExceptions: true,
      })
      if (res.getResponseCode() !== 200) {
        result = `ERROR ${res.getResponseCode()}: ${res.getContentText().slice(0, 80)}`
      }
    } catch (e) {
      result = `EXCEPTION: ${e.message}`
    }

    logSheet.appendRow([nowJstStr, targetDateStr, userId, result])
    sentCount++
    Utilities.sleep(200) // レート制限対策
  }

  console.log(`フォローアップ送信完了: 送信${sentCount}件 / スキップ${skipCount}件（来店日: ${targetDateStr}）`)
}

// ─── テスト用: 自分だけにフォローアップメッセージを送信 ────────────
// GASエディタから手動で実行する。送信ログには記録されない。
// TEST_LINE_USER_ID スクリプトプロパティに自分の LINE user_id を設定しておくこと。

function testFollowUpToMyself() {
  const props = PropertiesService.getScriptProperties().getProperties()
  const lineToken  = props['LINE_CHANNEL_ACCESS_TOKEN']
  const testUserId = props['TEST_LINE_USER_ID']

  if (!lineToken)  { console.log('LINE_CHANNEL_ACCESS_TOKEN が未設定です'); return }
  if (!testUserId) { console.log('TEST_LINE_USER_ID が未設定です（スクリプトプロパティに追加してください）'); return }

  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${lineToken}`,
    },
    payload: JSON.stringify({
      to: testUserId,
      messages: buildFollowUpMessages(),
    }),
    muteHttpExceptions: true,
  })

  const code = res.getResponseCode()
  if (code === 200) {
    console.log(`テスト送信成功 → ${testUserId}`)
  } else {
    console.log(`テスト送信失敗 (${code}): ${res.getContentText()}`)
  }
}
