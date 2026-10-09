import { palletResult, summarize, toNumber } from './calculations'
import { GENERAL_PHOTO_LABELS, type ReceptionDraft } from '../types'

export interface PdfReception {
  draft: ReceptionDraft
  inspector: string
  hasDryMatter: boolean
}

export interface PdfOptions {
  title: string
  /** Líneas bajo el título (filtros aplicados, etc.). */
  subtitle?: string[]
  generatedBy: string
  includePhotos: boolean
  onProgress?: (done: number, total: number) => void
}

const BRAND: [number, number, number] = [23, 63, 95]
const LIGHT: [number, number, number] = [238, 242, 246]
const BAD: [number, number, number] = [180, 35, 24]
const MARGIN = 14
const PAGE_W = 210
const PAGE_H = 297
const CONTENT_W = PAGE_W - MARGIN * 2

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
}
const dash = (v: string | null | undefined) => (v && v.trim() ? v : '-')

interface LoadedPhoto {
  caption: string
  data: string
  w: number
  h: number
}

async function loadPhoto(url: string, caption: string): Promise<LoadedPhoto | null> {
  try {
    const blob = await (await fetch(url)).blob()
    const [data, bmp] = await Promise.all([
      new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result as string)
        r.onerror = reject
        r.readAsDataURL(blob)
      }),
      createImageBitmap(blob),
    ])
    const out = { caption, data, w: bmp.width, h: bmp.height }
    bmp.close()
    return out
  } catch {
    return null
  }
}

/** Descarga las fotos por tandas para no saturar la red. */
async function loadPhotos(items: { url: string; caption: string }[]): Promise<LoadedPhoto[]> {
  const out: LoadedPhoto[] = []
  for (let i = 0; i < items.length; i += 4) {
    const batch = await Promise.all(items.slice(i, i + 4).map((p) => loadPhoto(p.url, p.caption)))
    for (const b of batch) if (b) out.push(b)
  }
  return out
}

export async function buildPdf(items: PdfReception[], opts: PdfOptions): Promise<Blob> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const autoTable = autoTableModule.default
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  let y = MARGIN
  let firstPage = true

  const newPage = () => {
    if (firstPage) firstPage = false
    else doc.addPage()
    y = MARGIN
  }
  const ensure = (h: number) => {
    if (y + h > PAGE_H - MARGIN - 6) {
      doc.addPage()
      y = MARGIN
    }
  }
  const heading = (text: string) => {
    ensure(14)
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...BRAND)
    doc.text(text, MARGIN, y + 4)
    doc.setDrawColor(...BRAND).setLineWidth(0.4).line(MARGIN, y + 6, PAGE_W - MARGIN, y + 6)
    doc.setTextColor(0, 0, 0)
    y += 9
  }
  const para = (text: string, size = 9) => {
    doc.setFont('helvetica', 'normal').setFontSize(size).setTextColor(60, 60, 60)
    const lines = doc.splitTextToSize(text, CONTENT_W) as string[]
    ensure(lines.length * (size * 0.45) + 2)
    doc.text(lines, MARGIN, y + 3)
    y += lines.length * (size * 0.45) + 3
    doc.setTextColor(0, 0, 0)
  }
  const tableDefaults = { margin: { left: MARGIN, right: MARGIN }, styles: { fontSize: 9, cellPadding: 1.8 } }

  // ---------- Portada / resumen (solo con varias recepciones) ----------
  if (items.length > 1) {
    newPage()
    doc.setFillColor(...BRAND).rect(0, 0, PAGE_W, 30, 'F')
    doc.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(20).text('FrutaCheck QA', MARGIN, 14)
    doc.setFont('helvetica', 'normal').setFontSize(11).text(opts.title, MARGIN, 23)
    doc.setTextColor(0, 0, 0)
    y = 38
    doc.setFontSize(9).setTextColor(60, 60, 60)
    for (const line of [...(opts.subtitle ?? []), `Generado: ${fmtDate(new Date().toISOString())} por ${opts.generatedBy}`]) {
      doc.text(line, MARGIN, y)
      y += 5
    }
    doc.setTextColor(0, 0, 0)
    y += 3

    const sums = items.map((it) => {
      const d = it.draft
      const cfg = {
        minKgBox: toNumber(d.min_kg_box) ?? 0,
        tareBox: toNumber(d.tare_box) ?? 0,
        tarePallet: toNumber(d.tare_pallet) ?? 0,
        tareOther: toNumber(d.tare_other) ?? 0,
      }
      return summarize(d.pallets.map((p) => palletResult(p.boxes, p.gross, cfg)))
    })
    const total = sums.reduce(
      (a, s) => ({ pallets: a.pallets + s.weighed, below: a.below + s.belowMin, net: a.net + s.netTotal }),
      { pallets: 0, below: 0, net: 0 },
    )
    heading('Resumen')
    autoTable(doc, {
      ...tableDefaults,
      startY: y,
      theme: 'grid',
      body: [
        ['Recepciones', String(items.length), 'Palets pesados', String(total.pallets)],
        ['Palets bajo mínimo', String(total.below), 'Peso neto total', `${total.net.toFixed(1)} kg`],
      ],
      columnStyles: {
        0: { fillColor: LIGHT, fontStyle: 'bold' },
        2: { fillColor: LIGHT, fontStyle: 'bold' },
      },
    })
    y = lastY() + 6

    heading('Listado de recepciones')
    autoTable(doc, {
      ...tableDefaults,
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: BRAND },
      head: [['Fecha', 'Proveedor', 'Producto', 'Calibre', 'Lote', 'Palets', 'Bajo mín.', 'Neto (kg)', 'Estado']],
      body: items.map((it, i) => [
        fmtDate(it.draft.received_at),
        dash(it.draft.supplier_name),
        dash(it.draft.product),
        dash(it.draft.caliber),
        dash(it.draft.lot),
        String(it.draft.pallets.length),
        String(sums[i].belowMin),
        sums[i].netTotal.toFixed(1),
        it.draft.status === 'closed' ? 'Cerrada' : 'Borrador',
      ]),
      didParseCell: (h) => {
        if (h.section === 'body' && h.column.index === 6 && Number(h.cell.raw) > 0) {
          h.cell.styles.textColor = BAD
          h.cell.styles.fontStyle = 'bold'
        }
      },
    })
  }

  // ---------- Una sección por recepción ----------
  for (let n = 0; n < items.length; n++) {
    opts.onProgress?.(n, items.length)
    const { draft: d, inspector, hasDryMatter } = items[n]
    newPage()

    doc.setFillColor(...BRAND).rect(0, 0, PAGE_W, 22, 'F')
    doc.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(15)
    doc.text('FrutaCheck QA', MARGIN, 10)
    doc.setFont('helvetica', 'normal').setFontSize(10)
    doc.text('Informe de control de recepción', MARGIN, 17)
    doc.text(`${dash(d.product)}${d.caliber ? ' · Calibre ' + d.caliber : ''}`, PAGE_W - MARGIN, 10, { align: 'right' })
    doc.text(fmtDate(d.received_at), PAGE_W - MARGIN, 17, { align: 'right' })
    doc.setTextColor(0, 0, 0)
    y = 28

    heading('Datos de recepción')
    autoTable(doc, {
      ...tableDefaults,
      startY: y,
      theme: 'grid',
      body: [
        ['Proveedor', dash(d.supplier_name), 'Lote', dash(d.lot)],
        ['Producto', dash(d.product), 'Calibre', dash(d.caliber)],
        ['Formato', dash(d.format), 'Origen', dash(d.origin)],
        ['Camión', dash(d.truck), 'Inspector', dash(inspector)],
        ['Fecha', fmtDate(d.received_at), 'Estado', d.status === 'closed' ? 'Cerrada' : 'Borrador'],
      ],
      columnStyles: {
        0: { fillColor: LIGHT, fontStyle: 'bold', cellWidth: 28 },
        2: { fillColor: LIGHT, fontStyle: 'bold', cellWidth: 28 },
      },
    })
    y = lastY() + 3
    para(
      `Condiciones: ${d.boxes_per_pallet} cajas/palet · mínimo ${d.min_kg_box} kg/caja · tara caja ${d.tare_box} kg · tara palet ${d.tare_pallet} kg · otras taras ${d.tare_other} kg. ` +
        `Tara total del palet = cajas x tara/caja + tara palet + otras taras.`,
      8,
    )

    const cfg = {
      minKgBox: toNumber(d.min_kg_box) ?? 0,
      tareBox: toNumber(d.tare_box) ?? 0,
      tarePallet: toNumber(d.tare_pallet) ?? 0,
      tareOther: toNumber(d.tare_other) ?? 0,
    }
    const results = d.pallets.map((p) => palletResult(p.boxes, p.gross, cfg))
    const sum = summarize(results)

    heading('Pesaje por palet')
    autoTable(doc, {
      ...tableDefaults,
      startY: y,
      theme: 'grid',
      headStyles: { fillColor: BRAND },
      head: [['Palet', 'Cajas', 'Bruto (kg)', 'Tara (kg)', 'Neto (kg)', 'Mínimo (kg)', 'Media caja', 'Estado']],
      body: results.map((r, i) => [
        String(i + 1),
        String(r.boxes),
        dash(d.pallets[i].gross),
        r.tare.toFixed(1),
        r.valid ? r.net!.toFixed(1) : '-',
        r.minimum.toFixed(1),
        r.avgPerBox !== null ? r.avgPerBox.toFixed(2) : '-',
        r.valid ? (r.ok ? 'OK' : 'BAJO MÍNIMO') : 'Pendiente',
      ]),
      foot: [['Total', '', '', '', sum.netTotal.toFixed(1), '', '', `${sum.belowMin} bajo mín.`]],
      footStyles: { fillColor: LIGHT, textColor: [0, 0, 0], fontStyle: 'bold' },
      didParseCell: (h) => {
        if (h.section === 'body' && h.column.index === 7 && h.cell.raw === 'BAJO MÍNIMO') {
          h.cell.styles.textColor = BAD
          h.cell.styles.fontStyle = 'bold'
        }
      },
    })
    y = lastY() + 6

    heading('Control de calidad')
    const dry = hasDryMatter
      ? [
          'Materia seca',
          d.dry_matter ? `${d.dry_matter} %` : 'Pendiente laboratorio',
          'Ref. laboratorio',
          dash(d.lab_ref),
        ]
      : ['Materia seca', 'No aplica', '', '']
    autoTable(doc, {
      ...tableDefaults,
      startY: y,
      theme: 'grid',
      body: [
        ['Temperatura', d.temperature ? `${d.temperature} °C` : '-', 'Firmeza', dash(d.firmness)],
        ['°Brix', dash(d.brix), dry[0], dry[1]],
        ...(hasDryMatter ? [[dry[2], dry[3], '', '']] : []),
        [{ content: 'Observaciones', styles: { fillColor: LIGHT, fontStyle: 'bold' } }, { content: dash(d.notes), colSpan: 3 }],
      ],
      columnStyles: {
        0: { fillColor: LIGHT, fontStyle: 'bold', cellWidth: 32 },
        2: { fillColor: LIGHT, fontStyle: 'bold', cellWidth: 32 },
      },
    })
    y = lastY() + 6

    heading('Defectos detectados')
    const defectRows = d.defects.filter((x) => x.name || x.percent || d.photos.some((p) => p.defectId === x.id))
    if (defectRows.length) {
      autoTable(doc, {
        ...tableDefaults,
        startY: y,
        theme: 'grid',
        headStyles: { fillColor: BRAND },
        head: [['Defecto', 'Porcentaje', 'Fotografías']],
        body: defectRows.map((x) => [dash(x.name), `${x.percent || '0'} %`, String(d.photos.filter((p) => p.defectId === x.id).length)]),
      })
      y = lastY() + 4
    } else {
      para('No se han registrado defectos.')
    }

    // ---------- Fotografías ----------
    if (opts.includePhotos) {
      const wanted: { url: string; caption: string }[] = []
      defectRows.forEach((x, i) => {
        d.photos
          .filter((p) => p.defectId === x.id)
          .forEach((p, j) => wanted.push({ url: p.url, caption: `Defecto ${i + 1}: ${dash(x.name)} (${x.percent || '0'} %) · foto ${j + 1}` }))
      })
      ;(Object.keys(GENERAL_PHOTO_LABELS) as (keyof typeof GENERAL_PHOTO_LABELS)[]).forEach((k) => {
        d.photos
          .filter((p) => p.kind === k)
          .forEach((p, j) => wanted.push({ url: p.url, caption: `${GENERAL_PHOTO_LABELS[k]} · foto ${j + 1}` }))
      })

      if (wanted.length) {
        const photos = await loadPhotos(wanted.filter((w) => w.url))
        ensure(90) // el título no debe quedar solo al final de una página
        heading(`Fotografías (${photos.length})`)
        const gap = 6
        const cellW = (CONTENT_W - gap) / 2
        const maxH = 68
        for (let i = 0; i < photos.length; i += 2) {
          const row = photos.slice(i, i + 2)
          const scaled = row.map((p) => {
            const k = Math.min(cellW / p.w, maxH / p.h)
            return { w: p.w * k, h: p.h * k }
          })
          const rowH = Math.max(...scaled.map((s) => s.h)) + 10
          ensure(rowH)
          row.forEach((p, c) => {
            const x = MARGIN + c * (cellW + gap)
            doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(60, 60, 60)
            doc.text(doc.splitTextToSize(p.caption, cellW) as string[], x, y + 3)
            doc.addImage(p.data, 'JPEG', x, y + 6, scaled[c].w, scaled[c].h)
            doc.setDrawColor(200, 200, 200).rect(x, y + 6, scaled[c].w, scaled[c].h)
          })
          doc.setTextColor(0, 0, 0)
          y += rowH
        }
      } else {
        para('Sin fotografías.')
      }
    }
  }

  opts.onProgress?.(items.length, items.length)

  // Pie de página con numeración
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(130, 130, 130)
    doc.text('FrutaCheck QA', MARGIN, PAGE_H - 7)
    doc.text(`Página ${i} de ${pages}`, PAGE_W - MARGIN, PAGE_H - 7, { align: 'right' })
  }
  doc.setProperties({ title: opts.title, author: opts.generatedBy, creator: 'FrutaCheck QA' })
  return doc.output('blob')
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export function safeFilename(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'informe'
}
