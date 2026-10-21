import { useRef, useState } from 'react'
import { compressImage } from '../lib/image'
import type { PhotoDraft, PhotoKind } from '../types'

interface Props {
  kind: PhotoKind
  defectId?: string | null
  palletIndex?: number | null
  photos: PhotoDraft[]
  onAdd: (photos: PhotoDraft[]) => void
  onRemove: (id: string) => void
  onBusy?: (busy: boolean) => void
}

export function PhotoPicker({ kind, defectId = null, palletIndex = null, photos, onAdd, onRemove, onBusy }: Props) {
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const mine = photos.filter((p) => p.kind === kind && p.defectId === defectId && p.palletIndex === palletIndex)

  async function pick(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    onBusy?.(true)
    const added: PhotoDraft[] = []
    for (const f of Array.from(files)) {
      try {
        const blob = await compressImage(f)
        added.push({ id: crypto.randomUUID(), kind, defectId, palletIndex, path: null, file: blob, url: URL.createObjectURL(blob) })
      } catch {
        /* imagen ilegible: se ignora */
      }
    }
    onAdd(added)
    setBusy(false)
    onBusy?.(false)
    if (camera.current) camera.current.value = ''
    if (gallery.current) gallery.current.value = ''
  }

  return (
    <div>
      <div className="photo-actions">
        <button type="button" className="btn secondary" disabled={busy} onClick={() => camera.current?.click()}>
          📷 Hacer foto
        </button>
        <button type="button" className="btn secondary" disabled={busy} onClick={() => gallery.current?.click()}>
          🖼️ Elegir del dispositivo
        </button>
      </div>
      {/* Cámara: abre directamente la cámara trasera. Galería: elegir una o varias fotos ya hechas. */}
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files)} />
      <input ref={gallery} type="file" accept="image/*" multiple hidden onChange={(e) => pick(e.target.files)} />
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
