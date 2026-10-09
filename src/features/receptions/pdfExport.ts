import { buildPdf, downloadBlob, safeFilename } from '../../lib/pdf'
import type { Product } from '../../types'
import { loadReception } from './api'

interface ExportOptions {
  ids: string[]
  products: Product[]
  generatedBy: string
  includePhotos: boolean
  title: string
  subtitle?: string[]
  filename: string
  onProgress?: (done: number, total: number) => void
}

/** Carga las recepciones indicadas, genera un único PDF y lo descarga. */
export async function exportReceptionsPdf(o: ExportOptions): Promise<void> {
  const items = []
  for (let i = 0; i < o.ids.length; i++) {
    o.onProgress?.(i, o.ids.length)
    const draft = await loadReception(o.ids[i])
    items.push({
      draft,
      inspector: draft.inspector_name ?? '',
      hasDryMatter: o.products.find((p) => p.id === draft.product_id)?.has_dry_matter ?? false,
    })
  }
  const blob = await buildPdf(items, {
    title: o.title,
    subtitle: o.subtitle,
    generatedBy: o.generatedBy,
    includePhotos: o.includePhotos,
    onProgress: (done, total) => o.onProgress?.(done, total),
  })
  downloadBlob(blob, `${safeFilename(o.filename)}.pdf`)
}
