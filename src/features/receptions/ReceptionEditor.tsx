import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PhotoPicker } from '../../components/PhotoPicker'
import { palletResult, summarize, toNumber, type WeightConfig } from '../../lib/calculations'
import { GENERAL_PHOTO_LABELS, PRODUCTS, type PhotoDraft, type Product, type ReceptionDraft } from '../../types'
import {
  deleteReception,
  emptyDraft,
  findAgreement,
  listAgreements,
  loadReception,
  newId,
  saveReception,
  type AgreementWithSupplier,
} from './api'

const STEPS = ['Recepción', 'Palets', 'Calidad', 'Fotos'] as const

export function ReceptionEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<ReceptionDraft | null>(id ? null : emptyDraft())
  const [step, setStep] = useState(0)
  const [agreements, setAgreements] = useState<AgreementWithSupplier[]>([])
  const [loadedAgreement, setLoadedAgreement] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [processing, setProcessing] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listAgreements().then(setAgreements).catch(() => setAgreements([]))
  }, [])

  useEffect(() => {
    if (!id) return
    loadReception(id)
      .then(setDraft)
      .catch(() => setError('No se pudo cargar la recepción.'))
  }, [id])

  const cfg: WeightConfig = useMemo(
    () => ({
      minKgBox: toNumber(draft?.min_kg_box) ?? 0,
      tareBox: toNumber(draft?.tare_box) ?? 0,
      tarePallet: toNumber(draft?.tare_pallet) ?? 0,
      tareOther: toNumber(draft?.tare_other) ?? 0,
    }),
    [draft?.min_kg_box, draft?.tare_box, draft?.tare_pallet, draft?.tare_other],
  )

  if (!draft) return <div className="card muted">{error ?? 'Cargando…'}</div>

  const set = <K extends keyof ReceptionDraft>(key: K, value: ReceptionDraft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d))

  /** Al cambiar proveedor/producto/formato se buscan las condiciones pactadas. */
  function applyAgreement(next: ReceptionDraft) {
    const a = findAgreement(agreements, next.supplier_name, next.product, next.format)
    if (!a) {
      setLoadedAgreement(null)
      setDraft(next)
      return
    }
    setLoadedAgreement(`${a.suppliers?.name} · ${a.product}${a.format ? ' · ' + a.format : ''}`)
    setDraft({
      ...next,
      supplier_id: a.supplier_id,
      boxes_per_pallet: String(a.boxes_per_pallet),
      min_kg_box: String(a.min_kg_box),
      tare_box: String(a.tare_box),
      tare_pallet: String(a.tare_pallet),
      tare_other: String(a.tare_other),
      pallets: next.pallets.map((p) => ({ ...p, boxes: String(a.boxes_per_pallet) })),
    })
  }

  function setHeader<K extends 'supplier_name' | 'product' | 'format'>(key: K, value: ReceptionDraft[K]) {
    applyAgreement({ ...draft!, [key]: value, supplier_id: key === 'supplier_name' ? null : draft!.supplier_id })
  }

  function setPalletCount(n: number) {
    const count = Math.max(1, Math.min(60, n || 1))
    const pallets = draft!.pallets.slice(0, count)
    while (pallets.length < count) pallets.push({ boxes: draft!.boxes_per_pallet, gross: '' })
    set('pallets', pallets)
  }

  const results = draft.pallets.map((p) => palletResult(p.boxes, p.gross, cfg))
  const summary = summarize(results)

  const addPhotos = (added: PhotoDraft[]) => setDraft((d) => (d ? { ...d, photos: [...d.photos, ...added] } : d))
  const trackBusy = (b: boolean) => setProcessing((n) => n + (b ? 1 : -1))
  const removePhoto = (pid: string) => set('photos', draft.photos.filter((p) => p.id !== pid))

  async function save(status: 'draft' | 'closed', thenReport = false) {
    if (!draft!.supplier_name.trim()) {
      setError('Indica el proveedor.')
      setStep(0)
      return
    }
    setSaving(true)
    setError(null)
    try {
      // Guardar sin cerrar nunca reabre una recepción ya cerrada.
      const finalStatus = draft!.status === 'closed' ? 'closed' : status
      const savedId = await saveReception({ ...draft!, status: finalStatus })
      navigate(thenReport ? `/receptions/${savedId}/report` : '/', { replace: true })
    } catch (e) {
      setError(`No se pudo guardar: ${(e as { message?: string }).message ?? 'error desconocido'}`)
      setSaving(false)
    }
  }

  async function remove() {
    if (!draft!.id || !confirm('¿Eliminar esta recepción y todas sus fotos? No se puede deshacer.')) return
    try {
      await deleteReception(draft!.id)
      navigate('/', { replace: true })
    } catch {
      setError('No se pudo eliminar.')
    }
  }

  return (
    <div>
      <div className="steps no-print">
        {STEPS.map((label, i) => (
          <button key={label} className={i === step ? 'active' : ''} onClick={() => setStep(i)}>
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {error && <div className="result bad">{error}</div>}

      {step === 0 && (
        <div className="card">
          <h2>Datos de recepción</h2>
          <div className={'banner' + (loadedAgreement ? ' ok' : '')}>
            {loadedAgreement ? `✓ Condiciones cargadas: ${loadedAgreement}` : 'Sin condiciones de proveedor cargadas'}
          </div>
          <div className="grid">
            <label>
              Producto
              <select value={draft.product} onChange={(e) => setHeader('product', e.target.value as Product)}>
                {PRODUCTS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Proveedor
              <input
                list="suppliers-list"
                value={draft.supplier_name}
                onChange={(e) => setHeader('supplier_name', e.target.value)}
                placeholder="Proveedor"
              />
              <datalist id="suppliers-list">
                {[...new Set(agreements.map((a) => a.suppliers?.name).filter(Boolean))].map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </label>
            <label>
              Formato / referencia
              <input value={draft.format} onChange={(e) => setHeader('format', e.target.value)} placeholder="Ej. Caja 12 kg" />
            </label>
            <label>
              Lote
              <input value={draft.lot} onChange={(e) => set('lot', e.target.value)} placeholder="Lote" />
            </label>
            <label>
              Origen
              <input value={draft.origin} onChange={(e) => set('origin', e.target.value)} placeholder="País / zona" />
            </label>
            <label>
              Matrícula / camión
              <input value={draft.truck} onChange={(e) => set('truck', e.target.value)} placeholder="Matrícula" />
            </label>
            <label>
              Fecha y hora
              <input type="datetime-local" value={draft.received_at} onChange={(e) => set('received_at', e.target.value)} />
            </label>
            <label>
              Nº de palets
              <input
                type="number"
                min={1}
                max={60}
                value={draft.pallets.length}
                onChange={(e) => setPalletCount(parseInt(e.target.value, 10))}
              />
            </label>
            <label>
              Cajas por palet
              <input
                type="number"
                min={1}
                value={draft.boxes_per_pallet}
                onChange={(e) => {
                  set('boxes_per_pallet', e.target.value)
                  set('pallets', draft.pallets.map((p) => ({ ...p, boxes: e.target.value })))
                }}
              />
            </label>
            <label>
              Mínimo kg/caja
              <input type="number" step="0.1" value={draft.min_kg_box} onChange={(e) => set('min_kg_box', e.target.value)} />
            </label>
            <label>
              Tara caja (kg/unidad)
              <input type="number" step="0.01" value={draft.tare_box} onChange={(e) => set('tare_box', e.target.value)} />
            </label>
            <label>
              Tara palet (kg)
              <input type="number" step="0.1" value={draft.tare_pallet} onChange={(e) => set('tare_pallet', e.target.value)} />
            </label>
            <label>
              Tara otros (kg)
              <input type="number" step="0.1" value={draft.tare_other} onChange={(e) => set('tare_other', e.target.value)} />
            </label>
          </div>
          <p className="muted">
            El mínimo neto de cada palet es: nº de cajas × kg mínimo/caja. Ejemplo: 80 cajas × 12 kg = 960 kg netos.
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <h2>Pesaje individual de palets</h2>
          <p className="muted">Tara total = (cajas × tara/caja) + tara palet + otras taras. Neto = bruto − tara.</p>
          {draft.pallets.map((p, i) => {
            const r = results[i]
            return (
              <div className="pallet" key={i}>
                <div className="pallet-head">
                  <span>Palet {i + 1}</span>
                  <span className="badge">{!r.valid ? 'Pendiente' : r.ok ? 'OK' : 'BAJO MÍNIMO'}</span>
                </div>
                <div className="pgrid">
                  <label>
                    Nº cajas
                    <input
                      type="number"
                      min={1}
                      value={p.boxes}
                      onChange={(e) => set('pallets', draft.pallets.map((x, j) => (j === i ? { ...x, boxes: e.target.value } : x)))}
                    />
                  </label>
                  <label>
                    Peso bruto (kg)
                    <input
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      value={p.gross}
                      placeholder="Ej. 1015"
                      onChange={(e) => set('pallets', draft.pallets.map((x, j) => (j === i ? { ...x, gross: e.target.value } : x)))}
                    />
                  </label>
                  <label>
                    Tara total (kg)
                    <input readOnly value={r.tare.toFixed(2)} />
                  </label>
                </div>
                <div className={'result' + (r.valid ? (r.ok ? ' ok' : ' bad') : '')}>
                  {r.valid
                    ? `Neto: ${r.net!.toFixed(1)} kg · Mínimo: ${r.minimum.toFixed(1)} kg · ${r.net! - r.minimum >= 0 ? '+' : ''}${(r.net! - r.minimum).toFixed(1)} kg`
                    : `Mínimo neto: ${r.minimum.toFixed(1)} kg`}
                </div>
              </div>
            )
          })}
          <div className={'result ' + (summary.belowMin ? 'bad' : 'ok')}>
            Palets pesados: {summary.weighed}/{summary.total} · Por debajo del mínimo: {summary.belowMin} · Neto total:{' '}
            {summary.netTotal.toFixed(1)} kg
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h2>Control de calidad</h2>
          <div className="grid">
            <label>
              Temperatura (°C)
              <input type="number" step="0.1" value={draft.temperature} onChange={(e) => set('temperature', e.target.value)} />
            </label>
            <label>
              Firmeza
              <input value={draft.firmness} onChange={(e) => set('firmness', e.target.value)} placeholder="Firme / media / blanda" />
            </label>
            <label>
              °Brix
              <input type="number" step="0.1" value={draft.brix} onChange={(e) => set('brix', e.target.value)} />
            </label>
          </div>

          <h3>Defectos detectados</h3>
          {draft.defects.map((d, i) => (
            <div className="pallet" key={d.id}>
              <div className="pallet-head">
                <span>Defecto {i + 1}</span>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    const rest = draft.defects.filter((x) => x.id !== d.id)
                    setDraft({
                      ...draft,
                      defects: rest.length ? rest : [{ id: newId(), name: '', percent: '' }],
                      photos: draft.photos.filter((p) => p.defectId !== d.id),
                    })
                  }}
                >
                  Eliminar
                </button>
              </div>
              <div className="grid">
                <label>
                  Tipo de defecto
                  <input
                    value={d.name}
                    placeholder="Ej. golpe, podrido, moho, sobremaduro"
                    onChange={(e) => set('defects', draft.defects.map((x) => (x.id === d.id ? { ...x, name: e.target.value } : x)))}
                  />
                </label>
                <label>
                  Porcentaje (%)
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    value={d.percent}
                    placeholder="Ej. 4.5"
                    onChange={(e) => set('defects', draft.defects.map((x) => (x.id === d.id ? { ...x, percent: e.target.value } : x)))}
                  />
                </label>
              </div>
              <label style={{ marginTop: 10 }}>Fotografías del defecto</label>
              <PhotoPicker kind="defect" defectId={d.id} photos={draft.photos} onAdd={addPhotos} onRemove={removePhoto} onBusy={trackBusy} />
            </div>
          ))}
          <div className="actions">
            <button type="button" className="btn secondary" onClick={() => set('defects', [...draft.defects, { id: newId(), name: '', percent: '' }])}>
              + Añadir defecto
            </button>
          </div>

          {draft.product === 'Aguacate' && (
            <>
              <h3>Aguacate · materia seca laboratorio</h3>
              <div className="grid">
                <label>
                  Referencia laboratorio
                  <input value={draft.lab_ref} onChange={(e) => set('lab_ref', e.target.value)} placeholder="LAB-2026-001" />
                </label>
                <label>
                  Resultado (%)
                  <input type="number" step="0.1" value={draft.dry_matter} onChange={(e) => set('dry_matter', e.target.value)} />
                </label>
              </div>
              <p className="muted">Puede quedar pendiente y completarse después.</p>
            </>
          )}
          <label style={{ marginTop: 12 }}>
            Observaciones
            <textarea value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Incidencias, aspecto, daños, maduración..." />
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h2>Fotografías generales</h2>
          <p className="muted">Las fotos de defectos se hacen en Calidad, asociadas a cada defecto.</p>
          <div className="photo-grid">
            {(Object.keys(GENERAL_PHOTO_LABELS) as (keyof typeof GENERAL_PHOTO_LABELS)[]).map((k) => (
              <div className="photo-box" key={k}>
                <b>{GENERAL_PHOTO_LABELS[k]}</b>
                <PhotoPicker kind={k} photos={draft.photos} onAdd={addPhotos} onRemove={removePhoto} onBusy={trackBusy} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="actions no-print sticky-actions">
        {step > 0 && (
          <button className="btn secondary" onClick={() => setStep(step - 1)}>
            ← Atrás
          </button>
        )}
        {step < STEPS.length - 1 && (
          <button className="btn" onClick={() => setStep(step + 1)}>
            Siguiente →
          </button>
        )}
        <button className="btn secondary" disabled={saving || processing > 0} onClick={() => save('draft')}>
          {saving ? 'Guardando…' : processing > 0 ? 'Procesando fotos…' : 'Guardar borrador'}
        </button>
        {step === STEPS.length - 1 && (
          <button className="btn ok" disabled={saving || processing > 0} onClick={() => save('closed', true)}>
            Cerrar y ver informe
          </button>
        )}
        {draft.id && (
          <button className="btn danger" onClick={remove}>
            Eliminar
          </button>
        )}
      </div>
    </div>
  )
}
