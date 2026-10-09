import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { exportRegisterXlsx } from '../../lib/excel'
import { useMasters } from '../../lib/masters'
import { supabase } from '../../lib/supabase'
import type { Profile, ReceptionSummary } from '../../types'
import { deleteReception, listReceptions, type HistoryFilters } from './api'
import { exportReceptionsPdf } from './pdfExport'
import { loadRegister } from './register'

const NO_FILTERS: HistoryFilters = { search: '', status: '', inspectorId: '', from: '', to: '' }
const MAX_PDF = 100

export function HistoryPage() {
  const { profile } = useAuth()
  const { products } = useMasters()
  const [filters, setFilters] = useState<HistoryFilters>(NO_FILTERS)
  const [rows, setRows] = useState<ReceptionSummary[] | null>(null)
  const [inspectors, setInspectors] = useState<Pick<Profile, 'id' | 'full_name'>[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [includePhotos, setIncludePhotos] = useState(true)
  const [progress, setProgress] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name')
      .then(({ data }) => setInspectors(data ?? []))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      listReceptions(filters)
        .then((r) => {
          setRows(r)
          setError(null)
          // se descartan de la selección las que ya no aparecen
          setSelected((prev) => new Set([...prev].filter((id) => r.some((x) => x.id === id))))
        })
        .catch(() => setError('No se pudo cargar el historial.'))
    }, 250)
    return () => clearTimeout(t)
  }, [filters, reload])

  const set = <K extends keyof HistoryFilters>(k: K, v: HistoryFilters[K]) => setFilters((f) => ({ ...f, [k]: v }))
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS)
  const busy = progress !== null

  /** Si hay selección se usan solo esas recepciones; si no, todas las que muestra el listado. */
  const targetIds = useMemo(() => {
    const all = rows?.map((r) => r.id) ?? []
    return selected.size ? all.filter((id) => selected.has(id)) : all
  }, [rows, selected])
  const scopeLabel = selected.size ? `${selected.size} seleccionada${selected.size === 1 ? '' : 's'}` : 'todas las visibles'

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allSelected = !!rows?.length && rows.every((r) => selected.has(r.id))

  function describeFilters(count: number, total: number): string[] {
    const inspector = inspectors.find((i) => i.id === filters.inspectorId)?.full_name
    return [
      selected.size
        ? `Recepciones seleccionadas: ${count}`
        : `Recepciones incluidas: ${count}${total > count ? ` (de ${total}; máximo ${MAX_PDF} por informe)` : ''}`,
      `Periodo: ${filters.from || 'inicio'} a ${filters.to || 'hoy'}`,
      ...(filters.status ? [`Estado: ${filters.status === 'closed' ? 'cerradas' : 'borradores'}`] : []),
      ...(inspector ? [`Inspector: ${inspector}`] : []),
      ...(filters.search ? [`Búsqueda: ${filters.search}`] : []),
    ]
  }

  async function downloadPdf(ids: string[], single = false) {
    if (!ids.length) return
    const subset = ids.slice(0, MAX_PDF)
    const first = rows?.find((r) => r.id === subset[0])
    setProgress('Preparando…')
    try {
      await exportReceptionsPdf({
        ids: subset,
        products,
        generatedBy: profile?.full_name || 'Usuario',
        includePhotos,
        title: single ? 'Informe de control de recepción' : 'Informe de recepciones',
        subtitle: single ? undefined : describeFilters(subset.length, ids.length),
        filename: single
          ? `informe-${first?.supplier_name || 'recepcion'}-${first?.lot || 'sin-lote'}-${(first?.received_at ?? '').slice(0, 10)}`
          : `informe-recepciones-${new Date().toISOString().slice(0, 10)}`,
        onProgress: (done, total) => setProgress(done >= total ? 'Generando archivo…' : `Cargando recepción ${done + 1} de ${total}…`),
      })
    } catch {
      setError('No se pudo generar el PDF.')
    }
    setProgress(null)
  }

  async function downloadExcel() {
    if (!targetIds.length) return
    setProgress('Preparando Excel…')
    try {
      const data = await loadRegister(targetIds)
      await exportRegisterXlsx(data, `registro-recepciones-${new Date().toISOString().slice(0, 10)}`, profile?.full_name || 'Usuario')
    } catch {
      setError('No se pudo generar el Excel.')
    }
    setProgress(null)
  }

  async function remove(r: ReceptionSummary) {
    if (!confirm(`¿Eliminar la recepción de ${r.supplier_name || 'sin proveedor'} (lote ${r.lot || '-'}) y todas sus fotos? No se puede deshacer.`)) return
    setProgress('Eliminando…')
    try {
      await deleteReception(r.id)
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(r.id)
        return next
      })
      setReload((n) => n + 1)
    } catch {
      setError('No se pudo eliminar la recepción.')
    }
    setProgress(null)
  }

  async function removeSelected() {
    if (!selected.size) return
    if (!confirm(`¿Eliminar ${selected.size} recepciones seleccionadas con todas sus fotos? No se puede deshacer.`)) return
    setProgress('Eliminando…')
    try {
      for (const id of selected) await deleteReception(id)
      setSelected(new Set())
    } catch {
      setError('No se pudieron eliminar todas las recepciones.')
    }
    setReload((n) => n + 1)
    setProgress(null)
  }

  return (
    <div className="card">
      <div className="row-between">
        <h2>Historial de recepciones</h2>
        <Link className="btn" to="/receptions/new">
          + Nueva recepción
        </Link>
      </div>

      <input placeholder="Buscar por proveedor o lote…" value={filters.search} onChange={(e) => set('search', e.target.value)} />
      <div className="grid filters">
        <label>
          Estado
          <select value={filters.status} onChange={(e) => set('status', e.target.value as HistoryFilters['status'])}>
            <option value="">Todos</option>
            <option value="closed">Cerradas</option>
            <option value="draft">Borradores</option>
          </select>
        </label>
        <label>
          Inspector
          <select value={filters.inspectorId} onChange={(e) => set('inspectorId', e.target.value)}>
            <option value="">Todos</option>
            {inspectors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.full_name || 'Sin nombre'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Desde
          <input type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} />
        </label>
      </div>
      {filtered && (
        <div className="actions">
          <button className="btn secondary" onClick={() => setFilters(NO_FILTERS)}>
            Quitar filtros
          </button>
        </div>
      )}

      <div className="toolbar">
        <label className="check">
          <input
            type="checkbox"
            checked={allSelected}
            disabled={!rows?.length}
            onChange={(e) => setSelected(e.target.checked ? new Set(rows?.map((r) => r.id)) : new Set())}
          />
          Seleccionar todas
        </label>
        <span className="muted">
          {rows ? `${rows.length} ${rows.length === 1 ? 'recepción' : 'recepciones'}` : ''}
          {selected.size ? ` · ${selected.size} seleccionada${selected.size === 1 ? '' : 's'}` : ''}
        </span>
      </div>
      <div className="actions">
        <button className="btn ok" onClick={downloadExcel} disabled={busy || !targetIds.length}>
          Excel · {scopeLabel}
        </button>
        <button className="btn ok" onClick={() => downloadPdf(targetIds)} disabled={busy || !targetIds.length}>
          PDF · {scopeLabel}
        </button>
        {selected.size > 0 && (
          <button className="btn danger" onClick={removeSelected} disabled={busy}>
            Eliminar seleccionadas
          </button>
        )}
        <label className="check">
          <input type="checkbox" checked={includePhotos} onChange={(e) => setIncludePhotos(e.target.checked)} />
          Incluir fotografías en el PDF
        </label>
      </div>
      {progress && <div className="result">{progress}</div>}
      {targetIds.length > MAX_PDF && <p className="muted">El PDF incluye como máximo {MAX_PDF} recepciones; el Excel incluye todas.</p>}

      {error && <div className="result bad">{error}</div>}
      {rows === null && !error && <p className="muted">Cargando…</p>}
      {rows?.length === 0 && <p className="muted">No hay recepciones.</p>}
      <div className="list">
        {rows?.map((r) => (
          <div className="list-item" key={r.id}>
            <input
              className="row-check"
              type="checkbox"
              aria-label="Seleccionar recepción"
              checked={selected.has(r.id)}
              onChange={() => toggle(r.id)}
            />
            <Link to={`/receptions/${r.id}/report`} className="grow">
              <strong>{r.supplier_name || 'Sin proveedor'}</strong> · {r.product}
              <br />
              <span className="muted">
                {new Date(r.received_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })} · Lote{' '}
                {r.lot || '—'} · {r.profiles?.full_name || 'Inspector'}
              </span>
            </Link>
            <div className="list-actions">
              <span className={'badge' + (r.status === 'closed' ? ' badge-ok' : '')}>
                {r.status === 'closed' ? 'Cerrada' : 'Borrador'}
              </span>
              <button className="btn secondary" onClick={() => downloadPdf([r.id], true)} disabled={busy}>
                PDF
              </button>
              <Link className="btn secondary" to={`/receptions/${r.id}`}>
                Modificar
              </Link>
              <button className="btn danger" onClick={() => remove(r)} disabled={busy}>
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
