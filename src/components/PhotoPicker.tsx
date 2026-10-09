import { useRef, useState } from 'react'
import { compressImage } from '../lib/image'
import type { PhotoDraft, PhotoKind } from '../types'

interface Props {
  kind: PhotoKind
  defectId?: string | null
  photos: PhotoDraft[]
  onAdd: (photos: PhotoDraft[]) => void
  onRemove: (id: string) => void
}

export function PhotoPicker({ kind, defectId = null, photos, onAdd, onRemove }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const mine = photos.filter((p) => p.kind === kind && p.defectId === defectId)

  async function pick(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    const added: PhotoDraft[] = []
    for (const f of Array.from(files)) {
      try {
        const blob = await compressImage(f)
        added.push({ id: crypto.randomUUID(), kind, defectId, path: null, file: blob, url: URL.createObjectURL(blob) })
      } catch {
        /* imagen ilegible: se ignora */
      }
    }
    onAdd(added)
    setBusy(false)
    if (input.current) input.current.value = ''
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={(e) => pick(e.target.files)}
      />
      <div className="thumb-grid">
        {mine.map((p) => (
          <div key={p.id} className="thumb-wrap">
            <img className="thumb" src={p.url} alt="" />
            <button type="button" className="thumb-del" aria-label="Quitar foto" onClick={() => onRemove(p.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="photo-count">
        {busy ? 'Procesando…' : `${mine.length} foto${mine.length === 1 ? '' : 's'}`}
      </div>
    </div>
  )
}
