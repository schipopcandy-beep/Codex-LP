/**
 * 織はや GAS スクリプト
 *
 * スクリプトプロパティ（設定 > スクリプトプロパティ）に以下を登録:
 *   SUPABASE_URL              : https://xxxxxxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY : eyJhbGci...（Supabase > Settings > API > service_role）
 *   LINE_CHANNEL_ACCESS_TOKEN : （LINE Developers > Channel access token）
 *
 * 関数一覧:
 *   refreshAll()           - 3シートをまとめて最新化（手動 or 日次トリガー）
 *   exportTakeoutHistory() - テイクアウト履歴シートを更新
 *   exportDailySales()     - 商品日次販売数シートを更新
 *   exportSoldoutLogs()    - 売切時刻シートを更新
 *   sendWeeklyFollowUp()   - 7日前来店者にLINEメッセージ送信（毎日トリガー推奨）
 */

// ─── 設定 ───────────────────────────────────────────────────────

const CONFIG = {
  TOPPING_PRICE: 50,
  FOLLOW_UP_MESSAGE: '先日は織はやにご来店いただきありがとうございました😊\nまたのご来店をお待ちしております！',
  SALES_DAYS: 30,        // 日次販売数の集計期間（日）
  TAKEOUT_LIMIT: 500,    // テイクアウト履歴の取得件数
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
  const queryParts = entries.map(([k, v]) =>
    k === 'select' ? `select=${encodeURIComponent(v)}` : `${k}=${v}`
  )
  const url = `${base}/rest/v1/${table}?${queryParts.join('&')}`

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

// ─── 1. テイクアウト履歴 ─────────────────────────────────────────

function exportTakeoutHistory() {
  const data = supabaseGet('orders', {
    select:    'id,created_at,pickup_at,order_items(unit_price,quantity,with_topping,products(name))',
    table_id:  'eq.takeout',
    status:    'eq.paid',
    order:     'created_at.desc',
    limit:     CONFIG.TAKEOUT_LIMIT,
  })

  const sheet = getOrCreateSheet('テイクアウト履歴')
  sheet.clearContents()

  const headers = ['注文日', '受取時刻', '商品名', '数量', '単価', '小計', '注文ID']
  const rows = [headers]

  for (const order of data) {
    const dateStr   = jstDateStr(toJstDate(order.created_at))
    const pickupStr = order.pickup_at ? jstTimeStr(order.pickup_at) : '—'
    const items = order.order_items || []

    if (items.length === 0) {
      rows.push([dateStr, pickupStr, '（商品なし）', '', '', '', order.id])
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
        order.id,
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
  exportDailySales()
  exportSoldoutLogs()
}

// ─── 5. 1週間後フォローアップ LINE メッセージ ────────────────────

function sendWeeklyFollowUp() {
  const { lineToken, supabaseUrl, supabaseKey } = getProps()
  if (!lineToken) { console.log('LINE_CHANNEL_ACCESS_TOKEN が未設定です'); return }

  // 7日前（日本時間）の注文を取得
  const targetDay = nDaysAgoJst(7)
  const { start: fromUtc, end: toUtc } = utcRangeForJstDay(targetDay)
  const targetDateStr = Utilities.formatDate(targetDay, 'Asia/Tokyo', 'yyyy/MM/dd')

  const orders = supabaseGet('orders', [
    ['select',       'line_user_id'],
    ['status',       'eq.paid'],
    ['created_at',   `gte.${fromUtc}`],
    ['created_at',   `lt.${toUtc}`],
    ['line_user_id', 'not.is.null'],
  ])

  // LINE ユーザーIDを重複排除
  const userIds = [...new Set(orders.map(o => o.line_user_id).filter(Boolean))]
  if (userIds.length === 0) {
    console.log(`${targetDateStr}: 対象ユーザーなし`)
    return
  }

  // 送信済みログシートを確認（同じユーザーに重複送信しない）
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

  const now       = new Date()
  const nowJstStr = Utilities.formatDate(new Date(now.getTime() + 9 * 3600000), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm')

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
          messages: [{ type: 'text', text: CONFIG.FOLLOW_UP_MESSAGE }],
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
