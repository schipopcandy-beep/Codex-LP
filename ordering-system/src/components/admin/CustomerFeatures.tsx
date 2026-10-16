/** 店頭テイクアウトで選んだお客様の特徴（お渡しのときに見分けるため） */
export default function CustomerFeatures({ features }: { features?: string[] | null }) {
  if (!features || features.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 pt-1">
      {features.map((f) => (
        <span
          key={f}
          className="px-2 py-0.5 rounded-full bg-white border border-amber-300 text-sm font-bold text-brown-700"
        >
          {f}
        </span>
      ))}
    </div>
  )
}
