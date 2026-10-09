import type { Cell, Worksheet } from 'exceljs'
import type { RegisterReception } from '../features/receptions/register'
import { palletResult, summarize } from './calculations'
import { downloadBlob } from './pdf'

const asDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function styleSheet(ws: Worksheet, widths: number[]) {
  ws.columns.forEach((c, i) => {
    c.width = widths[i] ?? 14
  })
  const head = ws.getRow(1)
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173F5F' } }
  head.alignment = { vertical: 'middle', wrapText: true }
  head.height = 30
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } }
}

function redIf(cell: Cell, bad: boolean) {
  if (bad) cell.font = { bold: true, color: { argb: 'FFB42318' } }
}

/** Registro en Excel: una hoja por recepción, otra por palet y otra por defecto. */
export async function exportRegisterXlsx(rows: RegisterReception[], filename: string, generatedBy: string): Promise<void> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = generatedBy
  wb.created = new Date()

  const dateFmt = { numFmt: 'dd/mm/yyyy hh:mm' }
  const kg = { numFmt: '#,##0.0' }

  const ws = wb.addWorksheet('Recepciones')
  ws.columns = [
    { header: 'Fecha', key: 'fecha', style: dateFmt },
    { header: 'Estado', key: 'estado' },
    { header: 'Inspector', key: 'inspector' },
    { header: 'Proveedor', key: 'proveedor' },
    { header: 'Producto', key: 'producto' },
    { header: 'Calibre', key: 'calibre' },
    { header: 'Formato', key: 'formato' },
    { header: 'Lote', key: 'lote' },
    { header: 'Origen', key: 'origen' },
    { header: 'Camión', key: 'camion' },
    { header: 'Nº palets', key: 'palets' },
    { header: 'Palets pesados', key: 'pesados' },
    { header: 'Palets bajo mínimo', key: 'bajo' },
    { header: 'Cajas totales', key: 'cajas' },
    { header: 'Neto total (kg)', key: 'neto', style: kg },
    { header: 'Mínimo total (kg)', key: 'minimo', style: kg },
    { header: 'Diferencia (kg)', key: 'dif', style: kg },
    { header: 'Media kg/caja', key: 'media', style: { numFmt: '0.00' } },
    { header: 'Mín. kg/caja', key: 'minCaja', style: { numFmt: '0.00' } },
    { header: 'Temperatura (°C)', key: 'temp', style: { numFmt: '0.0' } },
    { header: 'Firmeza', key: 'firmeza' },
    { header: '°Brix', key: 'brix', style: { numFmt: '0.0' } },
    { header: 'Materia seca (%)', key: 'ms', style: { numFmt: '0.0' } },
    { header: 'Ref. laboratorio', key: 'lab' },
    { header: 'Defectos', key: 'defectos' },
    { header: 'Nº fotos', key: 'fotos' },
    { header: 'Observaciones', key: 'obs' },
  ]

  const wp = wb.addWorksheet('Palets')
  wp.columns = [
    { header: 'Fecha', key: 'fecha', style: dateFmt },
    { header: 'Proveedor', key: 'proveedor' },
    { header: 'Producto', key: 'producto' },
    { header: 'Lote', key: 'lote' },
    { header: 'Palet', key: 'palet' },
    { header: 'Cajas', key: 'cajas' },
    { header: 'Bruto (kg)', key: 'bruto', style: kg },
    { header: 'Tara (kg)', key: 'tara', style: kg },
    { header: 'Neto (kg)', key: 'neto', style: kg },
    { header: 'Mínimo (kg)', key: 'minimo', style: kg },
    { header: 'Media kg/caja', key: 'media', style: { numFmt: '0.00' } },
    { header: 'Estado', key: 'estado' },
  ]

  const wd = wb.addWorksheet('Defectos')
  wd.columns = [
    { header: 'Fecha', key: 'fecha', style: dateFmt },
    { header: 'Proveedor', key: 'proveedor' },
    { header: 'Producto', key: 'producto' },
    { header: 'Lote', key: 'lote' },
    { header: 'Defecto', key: 'defecto' },
    { header: 'Porcentaje (%)', key: 'pct', style: { numFmt: '0.0' } },
  ]

  for (const r of rows) {
    const cfg = { minKgBox: r.min_kg_box, tareBox: r.tare_box, tarePallet: r.tare_pallet, tareOther: r.tare_other }
    const results = r.pallets.map((p) => palletResult(p.boxes, p.gross_kg ?? '', cfg))
    const sum = summarize(results)
    const weighed = results.filter((x) => x.valid)
    const boxesWeighed = weighed.reduce((a, x) => a + x.boxes, 0)
    const minWeighed = weighed.reduce((a, x) => a + x.minimum, 0)
    const date = asDate(r.received_at)
    const defects = r.defects.filter((d) => d.name || d.percent !== null)

    const row = ws.addRow({
      fecha: date,
      estado: r.status === 'closed' ? 'Cerrada' : 'Borrador',
      inspector: r.inspector,
      proveedor: r.supplier_name,
      producto: r.product,
      calibre: r.caliber,
      formato: r.format,
      lote: r.lot,
      origen: r.origin,
      camion: r.truck,
      palets: r.pallets.length,
      pesados: sum.weighed,
      bajo: sum.belowMin,
      cajas: r.pallets.reduce((a, p) => a + p.boxes, 0),
      neto: weighed.length ? sum.netTotal : null,
      minimo: weighed.length ? minWeighed : null,
      dif: weighed.length ? sum.netTotal - minWeighed : null,
      media: boxesWeighed ? sum.netTotal / boxesWeighed : null,
      minCaja: r.min_kg_box,
      temp: r.temperature,
      firmeza: r.firmness,
      brix: r.brix,
      ms: r.dry_matter,
      lab: r.lab_ref,
      defectos: defects.map((d) => `${d.name || 'Sin especificar'}${d.percent !== null ? ` ${d.percent}%` : ''}`).join('; '),
      fotos: r.photoCount,
      obs: r.notes,
    })
    redIf(row.getCell('bajo'), sum.belowMin > 0)
    redIf(row.getCell('dif'), weighed.length > 0 && sum.netTotal < minWeighed)

    r.pallets.forEach((p, i) => {
      const res = results[i]
      const pr = wp.addRow({
        fecha: date,
        proveedor: r.supplier_name,
        producto: r.product,
        lote: r.lot,
        palet: p.position,
        cajas: p.boxes,
        bruto: p.gross_kg,
        tara: res.tare,
        neto: res.valid ? res.net : null,
        minimo: res.minimum,
        media: res.avgPerBox,
        estado: res.valid ? (res.ok ? 'OK' : 'BAJO MÍNIMO') : 'Pendiente',
      })
      redIf(pr.getCell('estado'), res.valid && !res.ok)
    })
    for (const d of defects) {
      wd.addRow({
        fecha: date,
        proveedor: r.supplier_name,
        producto: r.product,
        lote: r.lot,
        defecto: d.name || 'Sin especificar',
        pct: d.percent,
      })
    }
  }

  styleSheet(ws, [17, 10, 18, 24, 12, 9, 16, 14, 14, 12, 9, 10, 11, 10, 13, 13, 12, 11, 10, 12, 12, 8, 11, 14, 36, 8, 40])
  styleSheet(wp, [17, 24, 12, 14, 7, 8, 11, 10, 11, 11, 11, 14])
  styleSheet(wd, [17, 24, 12, 14, 26, 12])

  const buf = await wb.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`,
  )
}
