import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { palletResult, summarize, toNumber } from '../../lib/calculations'
import { GENERAL_PHOTO_LABELS, type ReceptionDraft } from '../../types'
import { useMasters } from '../../lib/masters'
import { useAuth } from '../../auth/AuthContext'
import { buildPdf, downloadBlob, safeFilename } from '../../lib/pdf'
import { loadReception } from './api'

export function ReportPage() {
  const { id } = useParams()
  const [d, setD] = useState<ReceptionDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { products, loaded: mastersLoaded } = useMasters()
  const { profile } = useAuth()
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfFailed, setPdfFailed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    loadReception(id)
      .then(setD)
      .catch(() => setError('No se pudo cargar el informe.'))
  }, [id])

  // El PDF se prepara en cuanto se abre el informe: así "Compartir" lo tiene listo al instante
  // (los navegadores móviles exigen compartir justo al pulsar el botón).
  useEffect(() => {
    if (!d || !mastersLoaded) return
    let cancelled = false
    setPdfFile(null)
    setPdfFailed(false)
    buildPdf(
      [{ draft: d, inspector: d.inspector_name ?? '', hasDryMatter: products.find((p) => p.id === d.product_id)?.has_dry_matter ?? false }],
      { title: 'Informe de control de recepción', generatedBy: profile?.full_name || 'Usuario', includePhotos: true },
    )
      .then((blob) => {
        if (cancelled) return
        const name = safeFilename(`informe-${d.supplier_name}-${d.lot || 'sin-lote'}-${d.received_at.slice(0, 10)}`) + '.pdf'
        setPdfFile(new File([blob], name, { type: 'application/pdf' }))
      })
      .catch(() => !cancelled && setPdfFailed(true))
    return () => {
      cancelled = true
    }
  }, [d, mastersLoaded, products, profile?.full_name])

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
  const hasDryMatter = products.find((p) => p.id === d.product_id)?.has_dry_matter ?? false
  const dryMatter =
    hasDryMatter ? (d.dry_matter ? `${d.dry_matter} %` : 'Pendiente laboratorio') : 'No aplica'

  const shareText = [
    `FrutaCheck QA - ${d.product}`,
    `Proveedor: ${dash(d.supplier_name)}`,
    `Lote: ${dash(d.lot)}`,
    `Fecha: ${dateText}`,
    `Palets bajo mínimo: ${summary.belowMin}/${summary.weighed}`,
  ].join('\n')

  const subject = `Informe FrutaCheck QA - ${d.supplier_name || d.product} - lote ${d.lot || 'sin lote'}`

  function downloadPdf() {
    if (pdfFile) downloadBlob(pdfFile, pdfFile.name)
  }

  const isMobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))

  /**
   * En móvil (y con "Compartir…") el PDF va adjunto mediante la hoja de compartir del dispositivo.
   * En ordenador, WhatsApp abre WhatsApp Web (pantalla con el código QR) y el correo abre el programa
   * de correo; el PDF se descarga para adjuntarlo.
   */
  async function sendPdf(channel: 'share' | 'email' | 'whatsapp') {
    if (!pdfFile) return
    setNotice(null)
    const data = { files: [pdfFile], title: subject, text: shareText }
    if ((channel === 'share' || isMobile) && navigator.canShare?.(data)) {
      try {
        await navigator.share(data)
        if (channel !== 'share') setNotice(`En la lista elige ${channel === 'email' ? 'tu aplicación de correo' : 'WhatsApp'}; el PDF ya va adjunto.`)
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return // el usuario canceló
      }
    }
    // Ordenador (o navegador sin compartir archivos): se descarga el PDF y se abre el correo / WhatsApp.
    downloadBlob(pdfFile, pdfFile.name)
    setNotice(
      channel === 'whatsapp'
        ? 'Se ha descargado el PDF. En WhatsApp Web entra con el código QR y adjúntalo en la conversación (clip → Documento).'
        : 'Se ha descargado el PDF: adjúntalo al correo.',
    )
    if (channel === 'email') window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${shareText}\n\nAdjunto el informe en PDF.`)}`
    else if (channel === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener')
  }

  return (
    <div>
      <div className="card no-print">
        <div className="actions">
          <Link className="btn secondary" to={`/receptions/${d.id}`}>
            ← Editar
          </Link>
          <button className="btn ok" onClick={downloadPdf} disabled={!pdfFile}>
            {pdfFile ? 'Descargar PDF' : pdfFailed ? 'PDF no disponible' : 'Preparando PDF…'}
          </button>
          <button className="btn" onClick={() => sendPdf('whatsapp')} disabled={!pdfFile}>
            Enviar por WhatsApp
          </button>
          <button className="btn" onClick={() => sendPdf('email')} disabled={!pdfFile}>
            Enviar por email
          </button>
          <button className="btn secondary" onClick={() => sendPdf('share')} disabled={!pdfFile}>
            Compartir…
          </button>
          <button className="btn secondary" onClick={() => window.print()}>
            Imprimir
          </button>
        </div>
        {notice && <div className="result">{notice}</div>}
        {pdfFailed && <div className="result bad">No se pudo preparar el PDF. Recarga la página.</div>}
        <p className="muted">
          En el móvil, "Enviar" abre la hoja de compartir con el PDF ya adjunto (informe completo con fotografías). En el ordenador, WhatsApp abre WhatsApp Web (código QR) y el correo abre tu programa de correo; el PDF se descarga para adjuntarlo. "Compartir…" usa siempre la hoja de compartir del dispositivo.
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
            <tr><th>Formato</th><td>{dash(d.format)}</td><th>Calibre</th><td>{dash(d.caliber)}</td></tr>
            <tr><th>Estado</th><td colSpan={3}>{d.status === 'closed' ? 'Cerrada' : 'Borrador'}</td></tr>
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
