'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useConfirm } from '@/components/admin/useConfirm'

/** タイマーの長さ（分） */
const TIMER_MINUTES = 30
/** 終了時刻を保存するキー（画面を開き直してもカウントを続けるため） */
const STORAGE_KEY = 'orihaya-rice-timer-end'
/** 終わったときのアラームを鳴らし続ける上限（ミリ秒） */
const ALARM_MAX_MS = 3 * 60 * 1000

function readEndAt(): number | null {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

function writeEndAt(value: number | null) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, String(value))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 保存できなくてもタイマーは動く（画面を開き直すと消えるだけ）
  }
}

/** ピピピッという3音のアラーム */
function playAlarm(ctx: AudioContext) {
  const now = ctx.currentTime
  ;[0, 0.25, 0.5].forEach((offset) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'square'
    osc.frequency.value = 1320
    const t = now + offset
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.25, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    osc.start(t)
    osc.stop(t + 0.2)
  })
}

const format = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/**
 * ご飯炊きタイマー（30分のカウントダウン）
 * 終了時刻で数えるので、画面を開き直したり、しばらく裏に回したりしてもずれない。
 * 終わったら「止める」を押すまでアラームを鳴らす（最長3分）。
 */
export default function RiceTimer() {
  const [endAt, setEndAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  /** アラームを止めた（または鳴らし終えた）か */
  const [silenced, setSilenced] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const [confirm, confirmDialog] = useConfirm()

  const unlockAudio = useCallback(() => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
    } catch {
      // 音が出せない端末でも、画面の表示は動く
    }
  }, [])

  // 開き直したときに、動いていたタイマーを引き継ぐ
  useEffect(() => {
    setEndAt(readEndAt())
    // 画面を開き直した後は、最初のタッチで音を出せるようにする
    const handler = () => unlockAudio()
    window.addEventListener('pointerdown', handler, { once: true })
    return () => window.removeEventListener('pointerdown', handler)
  }, [unlockAudio])

  useEffect(() => {
    if (!endAt) return
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [endAt])

  const remaining = endAt ? endAt - now : 0
  const finished = endAt !== null && remaining <= 0
  const alarming = finished && !silenced && now - (endAt ?? 0) < ALARM_MAX_MS

  // 終わったら2秒おきにアラームを鳴らす
  useEffect(() => {
    if (!alarming) return
    const ring = () => audioCtxRef.current && playAlarm(audioCtxRef.current)
    ring()
    const timer = setInterval(ring, 2000)
    return () => clearInterval(timer)
  }, [alarming])

  const start = () => {
    unlockAudio()
    const next = Date.now() + TIMER_MINUTES * 60 * 1000
    writeEndAt(next)
    setEndAt(next)
    setNow(Date.now())
    setSilenced(false)
  }

  const reset = () => {
    writeEndAt(null)
    setEndAt(null)
    setSilenced(false)
  }

  const running = endAt !== null && !finished

  // カウント中に間違えて押しても消えないよう、確認してから操作する
  const restart = async () => {
    if (running && !(await confirm('タイマーを30分から測り直しますか？', { confirmLabel: '測り直す' }))) return
    start()
  }
  const cancel = async () => {
    if (running && !(await confirm('タイマーを止めますか？', { confirmLabel: '止める', danger: true }))) return
    reset()
  }

  return (
    <div
      className={`card p-3 mb-4 flex items-center justify-between gap-3 flex-wrap border-2 ${
        finished ? 'border-red-400 bg-red-50' : running ? 'border-matcha-500' : 'border-cream-300'
      } ${alarming ? 'animate-pulse' : ''}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">🍚</span>
        <div>
          <p className="text-sm font-bold text-brown-700">ご飯炊きタイマー</p>
          {finished ? (
            <p className="text-xl font-bold text-red-600">炊き上がりました！</p>
          ) : (
            <p className={`text-3xl font-bold tabular-nums ${running ? 'text-matcha-600' : 'text-brown-400'}`}>
              {format(running ? remaining : TIMER_MINUTES * 60 * 1000)}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {alarming && (
          <button
            type="button"
            onClick={() => setSilenced(true)}
            className="px-4 py-3 rounded-xl bg-red-600 text-white font-bold active:bg-red-700"
          >
            アラームを止める
          </button>
        )}
        {running || finished ? (
          <>
            <button
              type="button"
              onClick={restart}
              className="px-4 py-3 rounded-xl border-2 border-brown-400 bg-white text-brown-700 font-bold"
            >
              30分から再スタート
            </button>
            <button
              type="button"
              onClick={cancel}
              className="px-4 py-3 rounded-xl border border-cream-300 bg-white text-brown-500 font-bold"
            >
              リセット
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={start}
            className="px-6 py-3 rounded-xl bg-matcha-600 text-white font-bold text-lg active:bg-matcha-500"
          >
            スタート（30分）
          </button>
        )}
      </div>
      {confirmDialog}
    </div>
  )
}
