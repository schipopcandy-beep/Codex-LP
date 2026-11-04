import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { createServiceRoleClient } from '@/lib/supabase/server'

/** 写真を置く場所（Supabase Storage。誰でも見られる場所。LINEが画像を取りに来るため） */
const BUCKET = 'product-images'
const FOLDER = 'line-messages'
/** 受け付ける写真の大きさの上限 */
const MAX_BYTES = 15 * 1024 * 1024

/**
 * 管理用: LINEメッセージに付ける写真をアップロードする
 * LINEは JPEG・PNG しか送れず、小さい表示用の画像（1MBまで）も要るため、
 * どんな写真も JPEG に変換して、本体（長い辺1600px）と小さい画像（長い辺480px）を作る
 * form-data: file
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: '写真を選んでください' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: '写真が大きすぎます（15MBまで）' }, { status: 400 })

  let original: Buffer
  let preview: Buffer
  try {
    const input = Buffer.from(await file.arrayBuffer())
    // rotate(): スマホの写真の向き（縦・横）を正しくする
    original = await sharp(input).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()
    preview = await sharp(input).rotate().resize(480, 480, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer()
  } catch {
    return NextResponse.json({ error: '写真として読み込めませんでした（JPEG・PNG・WebPなどの写真を選んでください）' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const name = `${FOLDER}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const upload = (path: string, data: Buffer) =>
    supabase.storage.from(BUCKET).upload(path, data, { contentType: 'image/jpeg', upsert: false })
  const [a, b] = await Promise.all([upload(`${name}.jpg`, original), upload(`${name}-preview.jpg`, preview)])
  if (a.error || b.error) {
    return NextResponse.json({ error: `写真を保存できませんでした: ${(a.error ?? b.error)!.message}` }, { status: 500 })
  }
  const publicUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  return NextResponse.json({ image_url: publicUrl(`${name}.jpg`), preview_url: publicUrl(`${name}-preview.jpg`) })
}
