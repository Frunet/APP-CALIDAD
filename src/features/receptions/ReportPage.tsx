import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { palletResult, summarize, toNumber } from '../../lib/calculations'
import { GENERAL_PHOTO_LABELS, type ReceptionDraft } from '../../types'
import { loadReception } from './api'

export function ReportPage() {
  const { id } = useParams()
  const [d, setD] = useState<ReceptionDraft | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    loadReception(id)
      .then(setD)
      .catch(() => setError('No se pudo cargar el informe.'))
  }, [id])

  if (!d) return <div className="card muted">{error ?? 'Cargando…'}</div>

  const cfg = {
    minKgBox: toNumber(d.min_kg_box) ?? 0,
    tareBox: toNumber(d.tare_box) ?? 0,
    tarePallet: toNumber(d.tare_pallet) ?? 0,
    tareOther: toNumber(d.tare_other) ?? 0,
  }
  const results = d.pallets.map((p) => palletResult(p.boxes, p.gross, cfg))
  const summary = summarize(results)
  const dash = (v: string) => v || '—'
  const dateText = new Date(d.received_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
  const dryMatter =
    d.product === 'Aguacate' ? (d.dry_matter ? `${d.dry_matter} %` : 'Pendiente laboratorio') : 'No aplica'

  const shareText = [
    `FrutaCheck QA - ${d.product}`,
    `Proveedor: ${dash(d.supplier_name)}`,
    `Lote: ${dash(d.lot)}`,
    `Fecha: ${dateText}`,
    `Palets bajo mínimo: ${summary.belowMin}/${summary.weighed}`,
  ].join('\n')

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'FrutaCheck QA', text: shareText })
      } catch {
        /* cancelado */
      }
    } else {
      alert('Este navegador no permite compartir. Usa "Imprimir / PDF" y comparte el archivo.')
    }
  }

  return (
    <div>
      <div className="card no-print">
        <div className="actions">
          <Link className="btn secondary" to={`/receptions/${d.id}`}>
            ← Editar
          </Link>
          <button className="btn ok" onClick={() => window.print()}>
            Imprimir / Guardar PDF
          </button>
          <button className="btn" onClick={share}>
            Compartir
          </button>
          <a className="btn" href={`mailto:?subject=${encodeURIComponent('Informe FrutaCheck QA - ' + d.lot)}&body=${encodeURIComponent(shareText + '\n\nAdjunta el PDF generado.')}`}>
            Email
          </a>
          <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        </div>
        <p className="muted">
          En el móvil, "Imprimir / Guardar PDF" abre el diálogo del sistema: elige "Guardar como PDF" y compártelo por email o WhatsApp.
        </p>
      </div>

      <div className="report">
        <div className="report-head">
          <div>
            <h1 style={{ margin: 0 }}>FrutaCheck QA</h1>
            <div>Informe de control de recepción</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <b>{d.product}</b>
            <br />
            {dateText}
          </div>
        </div>

        <h2>Datos de recepción</h2>
        <table>
          <tbody>
            <tr><th>Proveedor</th><td>{dash(d.supplier_name)}</td><th>Lote</th><td>{dash(d.lot)}</td></tr>
            <tr><th>Origen</th><td>{dash(d.origin)}</td><th>Camión</th><td>{dash(d.truck)}</td></tr>
            <tr><th>Formato</th><td>{dash(d.format)}</td><th>Estado</th><td>{d.status === 'closed' ? 'Cerrada' : 'Borrador'}</td></tr>
          </tbody>
        </table>

        <h2>Resumen de peso por palet</h2>
        <table>
          <thead>
            <tr><th>Palet</th><th>Cajas</th><th>Bruto (kg)</th><th>Neto (kg)</th><th>Mínimo neto (kg)</th><th>Media caja (kg)</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{r.boxes}</td>
                <td>{dash(d.pallets[i].gross)}</td>
                <td>{r.valid ? r.net!.toFixed(1) : '—'}</td>
                <td>{r.minimum.toFixed(1)}</td>
                <td>{r.avgPerBox !== null ? r.avgPerBox.toFixed(2) : '—'}</td>
                <td>{r.valid ? (r.ok ? 'OK' : 'BAJO MÍNIMO') : 'Pendiente'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          <b>Total:</b> {summary.weighed}/{summary.total} palets pesados · {summary.belowMin} bajo mínimo · neto total{' '}
          {summary.netTotal.toFixed(1)} kg.
        </p>
        <p>
          <b>Tara por palet:</b> (cajas × {d.tare_box} kg/caja) + {d.tare_pallet} kg palet + {d.tare_other} kg otros. Mínimo{' '}
          {d.min_kg_box} kg/caja.
        </p>

        <h2>Control de calidad</h2>
        <table>
          <tbody>
            <tr><th>Temperatura</th><td>{d.temperature ? `${d.temperature} °C` : '—'}</td><th>Firmeza</th><td>{dash(d.firmness)}</td></tr>
            <tr>
              <th>°Brix</th><td>{dash(d.brix)}</td>
              <th>Materia seca</th><td>{dryMatter}{d.lab_ref ? ` · Ref. ${d.lab_ref}` : ''}</td>
            </tr>
          </tbody>
        </table>

        <h2>Defectos detectados</h2>
        <table>
          <thead><tr><th>Defecto</th><th>Porcentaje</th><th>Fotografías</th></tr></thead>
          <tbody>
            {d.defects.map((x) => (
              <tr key={x.id}>
                <td>{x.name || 'Sin especificar'}</td>
                <td>{x.percent || '0'} %</td>
                <td>{d.photos.filter((p) => p.defectId === x.id).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="report-photos">
          {d.defects.map((x, i) => {
            const ph = d.photos.filter((p) => p.defectId === x.id)
            return (
              <div className="report-photo" key={x.id}>
                <b>Defecto {i + 1}: {x.name || 'Sin especificar'} · {x.percent || '0'} %</b>
                {ph.length ? ph.map((p) => <img key={p.id} src={p.url} alt="" />) : <p className="muted">Sin fotografía</p>}
              </div>
            )
          })}
        </div>

        <p><b>Observaciones:</b> {dash(d.notes)}</p>

        <h2>Fotografías generales</h2>
        <div className="report-photos">
          {(Object.keys(GENERAL_PHOTO_LABELS) as (keyof typeof GENERAL_PHOTO_LABELS)[]).map((k) => {
            const ph = d.photos.filter((p) => p.kind === k)
            return (
              <div className="report-photo" key={k}>
                <b>{GENERAL_PHOTO_LABELS[k]} · {ph.length} foto(s)</b>
                {ph.length ? ph.map((p) => <img key={p.id} src={p.url} alt="" />) : <p className="muted">Sin foto</p>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
